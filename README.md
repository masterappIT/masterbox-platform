# MasterBox Platform

MasterBox real-time conversation platform monorepo.

## Components

- `backend/` — Node.js, Express, GraphQL, Prisma, PostgreSQL, Redis and LiveKit integration
- `admin/` — Next.js administration frontend
- `flutter/` — Flutter mobile client
- `embed/` — third-party JavaScript embed client
- `super-admin/` — platform administration frontend

## Local services

```bash
docker compose -f backend/docker-compose.yml up -d
```

Copy environment examples into local, untracked `.env` files before starting services. Never commit credentials, API keys, JWT secrets, or LiveKit secrets.
