# MasterBox Backend

Express and Apollo GraphQL backend for MasterBox. It owns authentication, tenant data, Meta integrations, embed APIs, realtime events and LiveKit call integration.

## Development

```bash
docker compose -f docker-compose.yml up -d
npm install
npm run prisma:generate
npm run dev
```

Copy `.env.example` to an untracked `.env` and provide database, JWT, Redis, Meta and LiveKit settings. Never commit real credentials.

## Database

```bash
npm run prisma:validate
npm run prisma:migrate
npm run prisma:deploy
```

The development compose file is not a production security boundary; use managed secrets, restricted networks and production-grade service configuration when deploying.
