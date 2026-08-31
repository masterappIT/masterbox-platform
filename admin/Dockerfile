FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
ARG GRAPHQL_CONNECTION_PRODUCTION
ARG GRAPHQL_WS_CONNECTION_PRODUCTION
ARG API_CONNECTION_PRODUCTION
ENV GRAPHQL_CONNECTION_PRODUCTION=$GRAPHQL_CONNECTION_PRODUCTION
ENV GRAPHQL_WS_CONNECTION_PRODUCTION=$GRAPHQL_WS_CONNECTION_PRODUCTION
ENV API_CONNECTION_PRODUCTION=$API_CONNECTION_PRODUCTION
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/package*.json ./
RUN npm install --include=dev --no-audit --no-fund
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js
EXPOSE 8080
CMD ["npm", "start", "--", "-p", "8080"]
