import crypto from 'node:crypto';
import express from 'express';
import { prisma } from '../lib/db/prisma.js';
import { authenticateIntegration, hashDeepLinkToken } from '../middleware/integrationAuth.js';

const router = express.Router();
router.post('/exchange', authenticateIntegration, async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'token is required' });
    const record = await prisma.embedToken.findFirst({ where: { tokenHash: hashDeepLinkToken(token), companyId: req.tenant.companyId, expiresAt: { gt: new Date() }, consumedAt: null } });
    if (!record) return res.status(401).json({ error: 'Invalid or expired embed token' });
    await prisma.embedToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    res.json({ companyId: record.companyId, scopes: record.scopes, expiresAt: record.expiresAt });
  } catch (e) { next(e); }
});
router.post('/', authenticateIntegration, async (req, res, next) => {
  try {
    const ttlSeconds = Number(req.body?.ttlSeconds || 900);
    const scopes = Array.isArray(req.body?.scopes) ? req.body.scopes : ['embed'];
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 86400) return res.status(400).json({ error: 'ttlSeconds must be between 60 and 86400' });
    const token = crypto.randomBytes(32).toString('base64url');
    await prisma.embedToken.create({ data: { companyId: req.tenant.companyId, integrationId: req.integration.id, tokenHash: hashDeepLinkToken(token), scopes, expiresAt: new Date(Date.now() + ttlSeconds * 1000) } });
    res.status(201).json({ token, expiresIn: ttlSeconds });
  } catch (e) { next(e); }
});
export default router;
