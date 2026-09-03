# MasterBox Platform

MasterBox is a real-time conversation platform monorepo. This repository is the canonical integration point for all current product surfaces.

## Components

- `backend/` — Node.js/Express API, GraphQL, Prisma/PostgreSQL, Redis, Meta integrations, realtime and LiveKit
- `admin/` — Next.js operations console
- `super-admin/` — Next.js platform administration console
- `flutter/` — Flutter mobile and Web/H5 client
- `chat-embed/` — dependency-free browser embed client
- `docs/` — architecture and legacy integration records

## Start locally

```bash
docker compose -f backend/docker-compose.yml up -d
cd backend && npm install && npm run prisma:generate && npm run dev
```

Run the admin console with `cd admin && npm install && npm run dev`. Run Flutter H5 with `cd flutter && flutter pub get && flutter run -d chrome`.

Copy the relevant `.env.example` files to untracked `.env` files. Never commit credentials, API keys, JWT secrets, signing keys or generated build directories.

## Documentation

- [Architecture](docs/architecture.md)
- [Legacy inventory and integration policy](docs/legacy-inventory.md)
- [Product prototype references](docs/product-prototypes.md)
- [Historical development notes](docs/historical-changelog.md)
- [Backend](backend/README.md)
- [Admin](admin/README.md)
- [Flutter](flutter/README.md)
- [Chat embed](chat-embed/README.md)
