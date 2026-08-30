import jwt from 'jsonwebtoken';
import { prisma } from '../lib/db/prisma.js';
import { getJwtSecret } from '../lib/auth/jwtSecret.js';

const bearer = (value = '') => { const [scheme, token] = value.trim().split(/\s+/); return scheme?.toLowerCase() === 'bearer' ? token : undefined; };
const configured = (name) => new Set((process.env[name] || '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean));
export const isPlatformAdminAccount = (account) => {
  const ids = configured('PLATFORM_ADMIN_ACCOUNT_IDS'); const emails = configured('PLATFORM_ADMIN_EMAILS');
  return Boolean(account && account.role === 'admin' && (ids.has(account.id.toLowerCase?.() || account.id) || emails.has(account.email.toLowerCase())));
};
export function requirePlatformAdminRole(...roles) { return (req, res, next) => { if (!roles.length || roles.includes(req.platformAdmin?.role)) return next(); return res.status(403).json({ error: 'Insufficient platform administrator role' }); }; }
export async function requirePlatformAdmin(req, res, next) {
  const token = bearer(req.headers.authorization); if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, getJwtSecret()); const accountId = payload.account_id || payload.user_id;
    if (!accountId || payload.scope !== 'platform-admin' || payload.mfa !== true) return res.status(401).json({ error: 'Invalid authentication token' });
    const account = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, email: true, role: true, platformAdminProfile: { select: { role: true, mfaEnabled: true } } } });
    if (!isPlatformAdminAccount(account) || !account.platformAdminProfile || (account.platformAdminProfile.mfaEnabled && payload.mfa !== true)) return res.status(403).json({ error: 'Platform administrator access required' });
    req.platformAdmin = { id: account.id, email: account.email, role: account.platformAdminProfile.role };
    return next();
  } catch (error) { if (error?.message === 'JWT_SECRET must be configured') return res.status(503).json({ error: 'Authentication is not configured' }); return res.status(401).json({ error: 'Invalid or expired authentication token' }); }
}
