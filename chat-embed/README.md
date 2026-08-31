# MasterBox embeddable chat client

A small, dependency-free browser module for third-party chat surfaces. It is intentionally standalone: it does not change any MasterBox app or backend files.

## Usage

The browser client must receive an ephemeral token from a trusted host server. Permanent integration API keys are used only by that server and are never accepted or stored by this module.

```js
import { MasterBoxChat } from '@masterbox/chat-embed';

const chat = new MasterBoxChat({
  baseUrl: 'https://chat.example.com',
  conversationId: 'conversation-id',
  tokenProvider: () => fetch('/your-server/masterbox-token', { credentials: 'include' })
    .then((response) => response.json()), // { accessToken, expiresAt, scopes? }
});

chat.on('error', console.error);
chat.on('message.created', ({ message }) => render(message));
chat.connect();
```

`tokenProvider` should refresh before `expiresAt`; the client also retries once after a 401 and reconnects WebSockets with bounded backoff. Call `disconnect()` to disable automatic reconnection.

## Backend contract

The implemented backend exposes the following integration-protected routes:

- `POST /api/embed` with `{ ttlSeconds?, scopes? }` → `{ token, expiresIn }`. Call this only on a trusted host server with `X-App-Id` and `X-Api-Key`.
- `POST /api/embed/exchange` with `{ token }` → `{ companyId, scopes, expiresAt }`. The token is one-time and short-lived; this route also requires integration credentials.

The current backend does not implement `/api/embed/messages` or `/api/embed/socket`. Configure `messagesPath`/`wsPath` only when those browser-authenticated transport routes are provided by the deployment. Never put `X-Api-Key` in browser code.

## Validation

```sh
node --check src/index.js
```
