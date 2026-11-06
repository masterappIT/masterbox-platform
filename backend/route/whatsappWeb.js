// Events from whatsapp-gateway. Mounted before the app's own body parser: a batch of history is bigger than its limit.
import express from 'express';
import { isFromGateway } from '../lib/messaging/whatsappGateway.js';
import { handleGatewayEvent } from '../lib/messaging/whatsappWeb.js';

const router = express.Router();

router.use((req, res, next) => (isFromGateway(req.get('authorization')) ? next() : res.status(401).json({ error: 'Unauthorized' })));
router.use(express.json({ limit: '20mb' }));

router.post('/events', async (req, res) => {
  try {
    const { status, body } = await handleGatewayEvent(req.body);
    res.status(status).json(body);
  } catch (error) {
    console.error(`WhatsApp gateway event ${req.body?.type} for ${req.body?.channelId} failed:`, error.message);
    res.status(500).json({ error: 'Event not stored' });
  }
});

export default router;
