# whatsapp-gateway

Connects ordinary WhatsApp numbers to MasterBox by scanning a QR code with the phone, the way WhatsApp Web
does. Each channel gets its own [whatsapp-web.js](https://wwebjs.dev) client: a headless Chromium logged in
as a linked device of that phone.

```
手機 WhatsApp（掃 QR 連結裝置）
        │
whatsapp-gateway（每個頻道一個 Client）
        │  內部 HTTP + WHATSAPP_GATEWAY_SECRET
backend（存訊息、權限、推播、即時更新）
        │
admin／Flutter
```

This is not Meta's API. WhatsApp's terms don't allow unofficial clients, and a number can be banned for
using one. Cloud API channels (connected through Meta) are not affected by this service.

## What it does

- `PUT /channels/:id` starts a channel's client; the admin polls the backend for the QR code.
- Once a phone scans, it reports the number to the backend, which accepts it or answers `logout`
  (a channel that scans again must keep its number; one number can only be in one channel).
- It copies the last `HISTORY_DAYS` of one-to-one chats, then reports every new message,
  including those sent from the phone itself. Groups, status updates and channels are skipped.
- The backend sends replies through `POST /channels/:id/messages` and downloads customers' files from
  `GET /channels/:id/messages/:messageId/media`.
- Logins are kept in `DATA_PATH`; after a restart every number reconnects by itself.
  A phone that is offline for 14 days, or that removes the linked device, logs the channel out.

Every request needs `Authorization: Bearer $WHATSAPP_GATEWAY_SECRET`, and the gateway reports to
`$BACKEND_URL/internal/whatsapp-web/events` with the same header.

## Environment

| Variable | |
|---|---|
| `WHATSAPP_GATEWAY_SECRET` | Shared with the backend, at least 32 characters. Required. |
| `BACKEND_URL` | Where the backend is, such as `http://api:8080`. |
| `DATA_PATH` | Where logins are kept. `/data/wwebjs` in the image; mount a volume there. |
| `PORT` | Default 4100. |
| `HISTORY_DAYS` | How far back chats are copied after connecting. Default 365. |
| `HISTORY_MESSAGES_PER_CHAT` | At most this many messages per chat. Default 500. |
| `QR_MAX_RETRIES` | QR codes offered before giving up (about 20 seconds each). Default 6. |
| `PUPPETEER_EXECUTABLE_PATH` | Chromium to use; set in the image. |

The backend needs `WHATSAPP_GATEWAY_URL` and the same `WHATSAPP_GATEWAY_SECRET`.

## Running locally

```bash
cd whatsapp-gateway
PUPPETEER_SKIP_DOWNLOAD=true npm ci
WHATSAPP_GATEWAY_SECRET=local-development-secret-at-least-32-chars \
BACKEND_URL=http://localhost:4000 \
PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
npm start
```

and start the backend with `WHATSAPP_GATEWAY_URL=http://localhost:4100` and the same secret. In the admin,
社群平台管理 → 新增社群 → WhatsApp shows the QR code.

## Production (HostKVM)

The deploy workflow builds `ghcr.io/masterappit/masterbox:<sha>-whatsapp-gateway` with the other images and
passes its digest to the server's deploy script, which runs it as `masterbox-whatsapp-gateway`. The server side is
in MasterApp-infra: `apps/masterbox/compose.yaml` and `docs/masterbox-deploy.md`.

- It is only on the `masterbox-whatsapp` network with the API: no published port, not reachable through Caddy.
- `WHATSAPP_GATEWAY_SECRET` is in `/srv/apps/masterbox/whatsapp-gateway.env`, read by both the gateway and the API.
- Logins are kept in `/srv/apps/masterbox/wwebjs`, mounted at `/data/wwebjs`, and survive deploys.
- Memory is limited to 1.5 GB, about 3 connected numbers at 300–500 MB each; raise `mem_limit` for more.
- A deploy waits for the gateway's `/health`, and rolls back with the rest of the release if it never answers.
