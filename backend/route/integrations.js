import crypto from 'node:crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db/prisma.js';
import { authenticateIntegration, hashDeepLinkToken } from '../middleware/integrationAuth.js';

const router = express.Router();
router.use(authenticateIntegration);

router.post('/conversations', async (req, res, next) => {
  try {
    const { externalId, subject, metadata } = req.body || {};
    if (!externalId) return res.status(400).json({ error: 'externalId is required' });
    const conversation = await prisma.integrationConversation.upsert({
      where: { integrationId_externalId: { integrationId: req.integration.id, externalId } },
      create: { companyId: req.tenant.companyId, integrationId: req.integration.id, externalId, subject, metadata },
      update: { subject, metadata },
    });
    res.status(200).json(conversation);
  } catch (error) { next(error); }
});

router.get('/conversations/:id', async (req, res, next) => {
  try {
    const conversation = await prisma.integrationConversation.findFirst({
      where: { id: req.params.id, companyId: req.tenant.companyId, integrationId: req.integration.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conversation);
  } catch (error) { next(error); }
});

router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { externalId, direction, content } = req.body || {};
    const conversation = await prisma.integrationConversation.findFirst({ where: { id: req.params.id, companyId: req.tenant.companyId, integrationId: req.integration.id }, select: { id: true } });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!direction || !content) return res.status(400).json({ error: 'direction and content are required' });
    const message = await prisma.integrationMessage.create({ data: { conversationId: conversation.id, externalId, direction, content } });
    res.status(201).json(message);
  } catch (error) { next(error); }
});

router.post('/deep-link-sessions', async (req, res, next) => {
  try {
    const { conversationId, ttlSeconds = 900 } = req.body || {};
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 86400) return res.status(400).json({ error: 'ttlSeconds must be between 60 and 86400' });
    if (conversationId) {
      const found = await prisma.integrationConversation.findFirst({ where: { id: conversationId, companyId: req.tenant.companyId, integrationId: req.integration.id }, select: { id: true } });
      if (!found) return res.status(404).json({ error: 'Conversation not found' });
    }
    const token = crypto.randomBytes(32).toString('base64url');
    await prisma.deepLinkSession.create({ data: { companyId: req.tenant.companyId, integrationId: req.integration.id, conversationId, tokenHash: hashDeepLinkToken(token), expiresAt: new Date(Date.now() + ttlSeconds * 1000) } });
    res.status(201).json({ token, expiresIn: ttlSeconds });
  } catch (error) { next(error); }
});

// Internal provisioning helper; never returns the persisted hash.
export async function createIntegration({ companyId, appId, name }) {
  const secret = crypto.randomBytes(32).toString('base64url');
  const integration = await prisma.thirdPartyIntegration.create({ data: { companyId, appId, name, apiKeyPrefix: secret.slice(0, 8), apiKeyHash: await bcrypt.hash(secret, 12) } });
  return { integration, secret };
}

export default router;
