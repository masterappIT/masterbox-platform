import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db/prisma.js';

const getHeader = (value) => Array.isArray(value) ? value[0] : value;

export async function authenticateIntegration(req, res, next) {
  const appId = getHeader(req.headers['x-app-id']);
  const apiKey = getHeader(req.headers['x-api-key']);
  if (!appId || !apiKey) return res.status(401).json({ error: 'Missing integration credentials' });
  try {
    const integration = await prisma.thirdPartyIntegration.findUnique({ where: { appId } });
    if (!integration || !integration.active || !(await bcrypt.compare(apiKey, integration.apiKeyHash))) {
      return res.status(401).json({ error: 'Invalid integration credentials' });
    }
    req.integration = integration;
    req.tenant = { companyId: integration.companyId };
    await prisma.thirdPartyIntegration.update({ where: { id: integration.id }, data: { lastUsedAt: new Date() } });
    return next();
  } catch (error) {
    return next(error);
  }
}

export function generateIntegrationKey() {
  const secret = crypto.randomBytes(32).toString('base64url');
  return { secret, prefix: secret.slice(0, 8) };
}

export function hashDeepLinkToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
