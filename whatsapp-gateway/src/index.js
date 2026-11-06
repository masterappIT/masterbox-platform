// whatsapp-gateway: keeps a WhatsApp Web connection for each channel connected by scanning a QR code.
// Only the MasterBox backend talks to it, over the internal network with a shared secret; it is never exposed publicly.
import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import * as sessions from './sessions.js';

const PORT = Number(process.env.PORT || 4100);
const SECRET = process.env.WHATSAPP_GATEWAY_SECRET;
if (!SECRET || SECRET.length < 32) {
  console.error('WHATSAPP_GATEWAY_SECRET must be set to at least 32 characters');
  process.exit(1);
}

const authorized = (header) => {
  const expected = Buffer.from(`Bearer ${SECRET}`);
  const received = Buffer.from(String(header || ''));
  return expected.length === received.length && timingSafeEqual(expected, received);
};

const app = express();
app.disable('x-powered-by');
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use((req, res, next) => (authorized(req.get('authorization')) ? next() : res.status(401).json({ error: 'Unauthorized' })));
app.use(express.json({ limit: '1mb' }));

const handle = (work) => async (req, res) => {
  try {
    await work(req, res);
  } catch (error) {
    if (!error.status || error.status >= 500) console.error(`${req.method} ${req.path}:`, error.message);
    res.status(error.status || 500).json({ error: error.message });
  }
};

app.put('/channels/:id', handle(async (req, res) => res.json(await sessions.start(req.params.id))));

app.get('/channels/:id', handle(async (req, res) => {
  const status = sessions.status(req.params.id);
  if (!status) return res.status(404).json({ error: 'Not running' });
  res.json(status);
}));

app.delete('/channels/:id', handle(async (req, res) => {
  await sessions.remove(req.params.id);
  res.status(204).end();
}));

app.post('/channels/:id/pairing-code', handle(async (req, res) => res.json({ code: await sessions.pairingCode(req.params.id, req.body?.phone) })));

app.post('/channels/:id/messages', handle(async (req, res) => res.json(await sessions.send(req.params.id, req.body || {}))));

app.get('/channels/:id/messages/:messageId/media', handle(async (req, res) => {
  const file = await sessions.media(req.params.id, req.params.messageId);
  res.set('Content-Type', file.mimetype || 'application/octet-stream');
  if (file.filename) res.set('X-Filename', encodeURIComponent(file.filename));
  res.send(file.buffer);
}));

const server = app.listen(PORT, async () => {
  console.info(`whatsapp-gateway listening on ${PORT}`);
  const restored = await sessions.restoreAll();
  console.info(`Restoring ${restored} WhatsApp channel(s)`);
});

// Logged rather than fatal: a crash would drop every connected number at once.
process.on('unhandledRejection', (error) => console.error('Unhandled rejection:', error?.message || error));

const stop = async () => {
  server.close();
  await sessions.shutdown();
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
