import { createServer } from "http";
import express, { response } from "express";
import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer, ApolloServerPluginLandingPageDisabled } from "apollo-server-core";
// import { PubSub } from "graphql-subscriptions";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import typeDefs from "./graphQL/typeDefs/index.js";
import resolvers from "./graphQL/resolvers/index.js"
import auth, { requireAccount } from "./middleware/auth.js";
import cors from 'cors';
import 'dotenv/config.js';
import meta from './route/meta.js';
import integrations from './route/integrations.js';
import embed from './route/embed.js';
import platformAdmin from './route/platformAdmin.js';
import realtime from './route/realtime.js';
import { filesRouter, createUploadsRouter } from './route/uploads.js';
import { FILES_ROUTE } from './lib/storage/index.js';
import { pushConfigured } from './lib/push/notifications.js';
import pkg from 'body-parser';
// import { saveChannelSchema } from "./utils/utils.js";

const { urlencoded, json, } = pkg;



const PORT = process.env.PORT || 4000;

// Schema definition

// Create schema, which will be used separately by ApolloServer and
// the WebSocket server.
const schema = makeExecutableSchema({ typeDefs: typeDefs, resolvers: resolvers });
console.log(process.env.NODE_ENV)
// Create an Express app and HTTP server; we will attach the WebSocket
// server and the ApolloServer to this HTTP server.
// CORS options
const allowedCorsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === "https://www.facebook.com" || origin === "https://developers.facebook.com" || allowedCorsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS origin not allowed: ${origin}`));
    }
  },
  credentials: true
}

const app = express();
const httpServer = createServer(app);

app.use(cors(corsOptions));
// Parse application/x-www-form-urlencoded
app.use(urlencoded({ extended: true }));

// Parse application/json
// Meta's webhook signature covers the exact bytes it sent.
app.use(json({ verify: (req, _res, body) => { req.rawBody = body; } }));
//route for facebook webhook
app.use('/meta', meta);
// Authenticated server-to-server integration API. Credentials are app-scoped and tenant-isolated.
app.use('/api/integrations', integrations);
app.use('/api/embed', embed);
app.use('/api/realtime', realtime);
// Attachments: agents upload here before sending, and stored files are served from the API's domain.
app.use('/api/uploads', createUploadsRouter({ authenticate: requireAccount }));
app.use(FILES_ROUTE, filesRouter);
// Namespaced, read-only API for the standalone platform administrator.
app.use('/api/platform-admin', platformAdmin);
// Set up WebSocket server.
const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});
// Subscribers are identified by their token, so a bad one must reach the resolver as signed out.
const serverCleanup = useServer({
  schema,
  context: ({ connectionParams }) => auth({ req: { headers: { authorization: connectionParams?.authorization } } }).catch(() => ({ isAuth: false })),
}, wsServer);

// Set up GraphQL server.
const server = new ApolloServer({
  schema,
  context: auth,
  csrfPrevention: false,
  cors: corsOptions,
  introspection: process.env.NODE_ENV !== 'production',
  playground: false,
  cache: "bounded",
  plugins: [
    // Proper shutdown for the HTTP server.
    ApolloServerPluginDrainHttpServer({ httpServer }),
    // ApolloServerPluginLandingPageDisabled(),
    // Proper shutdown for the WebSocket server.
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },

  ],
});
await server.start();
server.applyMiddleware({ app, cors: corsOptions });



// Now that our HTTP server is fully set up, actually listen.
httpServer.listen(PORT, () => {
  console.log(
    `🚀 Query endpoint ready at http://localhost:${PORT}${server.graphqlPath}`
  );
  console.log(
    `🚀 Subscription endpoint ready at ws://localhost:${PORT}${server.graphqlPath}`
  );
  // A broken key is reported here rather than at the first customer message.
  console.log(pushConfigured() ? 'Push notifications are on' : 'Push notifications are off (no usable APNs key)');
});



