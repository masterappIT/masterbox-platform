# MasterBox Platform Architecture

## Runtime boundaries

```text
Admin / Super Admin / Flutter / Chat Embed
                    |
                    v
              Backend API
       GraphQL + REST + WebSocket
          |          |          |
      PostgreSQL    Redis     LiveKit
```

- `admin/` and `super-admin/` call the backend using configured GraphQL/API URLs.
- `flutter/` supports mobile and Web/H5. Production builds must provide `GRAPHQL_ENDPOINT` and `REALTIME_ENDPOINT` with `--dart-define`.
- `chat-embed/` is a browser client. Integration credentials stay on a trusted host server; never put API keys in browser code.
- `backend/` is the only service that owns persistence and external Meta/LiveKit integration.

## Local startup

```bash
docker compose -f backend/docker-compose.yml up -d
cd backend && npm install && npm run prisma:generate && npm run dev
cd admin && npm install && npm run dev
cd flutter && flutter pub get && flutter run -d chrome
```

The Flutter H5 app defaults to local backend URLs. Use deployment-specific values for non-local environments:

```bash
flutter run -d chrome \
  --dart-define=GRAPHQL_ENDPOINT=https://api.example.com/graphql \
  --dart-define=REALTIME_ENDPOINT=https://api.example.com
```

## Integration rules

1. Keep one canonical implementation per component.
2. Align GraphQL schema, REST routes, authentication, tenant boundaries and WebSocket contracts before changing clients.
3. Treat legacy projects as read-only references; migrate behavior intentionally rather than copying directories.
4. Keep secrets and generated artifacts outside Git.
5. Add an API/integration test before declaring a cross-component feature complete.
