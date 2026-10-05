import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { prisma } from '../lib/db/prisma.js';
import { getJwtSecret } from '../lib/auth/jwtSecret.js';
import { requirePlatformAdmin, requirePlatformAdminRole, isPlatformAdminAccount } from '../middleware/platformAdminAuth.js';

const router = express.Router();
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const CHALLENGE_TTL = '5m';
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of value.replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) return null;
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

function verifyTotp(secret, code) {
  const key = decodeBase32(secret);
  if (!key || !/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -1; offset <= 1; offset += 1) {
    const message = Buffer.alloc(8);
    message.writeBigInt64BE(BigInt(counter + offset));
    const digest = crypto.createHmac('sha1', key).update(message).digest();
    const position = digest[19] & 15;
    const number = (digest.readUInt32BE(position) & 0x7fffffff) % 1000000;
    const expected = Buffer.from(String(number).padStart(6, '0'));
    if (crypto.timingSafeEqual(expected, Buffer.from(code))) return true;
  }
  return false;
}

const audit = (action, actorAccountId = null, metadata = {}) => prisma.auditLog.create({ data: { action, actorAccountId, resourceType: 'platform_admin_auth', metadata } }).catch(() => {});
const issueToken = (account, role) => jwt.sign({ user_id: account.id, account_id: account.id, role, scope: 'platform-admin', mfa: true }, getJwtSecret(), { expiresIn: '15m' });
const accountResponse = (account, profile) => ({ id: account.id, displayName: profile.displayName, mobile: profile.mobile, role: profile.role, isActive: profile.isActive, mfaEnabled: profile.mfaEnabled, lastLoginAt: profile.lastLoginAt });

router.post('/auth/login', async (req, res, next) => {
  const id = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const key = `${req.ip}:${id.toLowerCase()}`;
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (attempt && now - attempt.startedAt < LOGIN_WINDOW_MS && attempt.count >= MAX_LOGIN_ATTEMPTS) return res.status(429).json({ error: 'Too many login attempts' });
  if (!id || !password) {
    await audit('login_failure', null, { reason: 'missing_credentials' });
    return res.status(400).json({ error: 'ID and password are required' });
  }
  try {
    const account = await prisma.account.findUnique({ where: { id }, select: { id: true, email: true, password: true, role: true, platformAdminProfile: { select: { role: true, isActive: true, displayName: true, mobile: true, mfaEnabled: true, totpSecret: true, lastLoginAt: true } } } });
    const valid = account && isPlatformAdminAccount(account) && await bcrypt.compare(password, account.password);
    if (!valid) {
      const current = loginAttempts.get(key);
      loginAttempts.set(key, current && now - current.startedAt < LOGIN_WINDOW_MS ? { ...current, count: current.count + 1 } : { startedAt: now, count: 1 });
      await audit('login_failure', account?.id || null, { reason: 'invalid_credentials' });
      return res.status(401).json({ error: 'Invalid platform administrator credentials' });
    }
    loginAttempts.delete(key);
    const profile = account.platformAdminProfile;
    if (!profile) return res.status(403).json({ error: 'Platform administrator profile is not configured' });
    if (profile.mfaEnabled) {
      const challengeToken = jwt.sign({ sub: account.id, purpose: 'platform-admin-mfa' }, getJwtSecret(), { expiresIn: CHALLENGE_TTL });
      return res.json({ mfaRequired: true, challengeToken, expiresIn: 300, account: accountResponse(account, profile) });
    }
    const token = issueToken(account, profile.role);
    await prisma.platformAdminProfile.update({ where: { accountId: account.id }, data: { lastLoginAt: new Date() } });
    await audit('login_success', account.id, { mfa: 'disabled' });
    return res.json({ token, expiresIn: 900, account: accountResponse(account, profile) });
  } catch (error) { return next(error); }
});

router.post('/auth/mfa/verify', async (req, res) => {
  try {
    const payload = jwt.verify(req.body?.challengeToken || '', getJwtSecret());
    if (payload.purpose !== 'platform-admin-mfa' || typeof payload.sub !== 'string') return res.status(401).json({ error: 'Invalid challenge token' });
    const account = await prisma.account.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, role: true, platformAdminProfile: { select: { role: true, isActive: true, displayName: true, mobile: true, mfaEnabled: true, totpSecret: true, lastLoginAt: true } } } });
    const valid = account && isPlatformAdminAccount(account) && account.platformAdminProfile?.mfaEnabled && verifyTotp(account.platformAdminProfile.totpSecret || '', String(req.body?.code || ''));
    if (!valid) { await audit('login_failure', account?.id || null, { reason: 'invalid_mfa' }); return res.status(401).json({ error: 'Invalid MFA code' }); }
    const token = issueToken(account, account.platformAdminProfile.role);
    await prisma.platformAdminProfile.update({ where: { accountId: account.id }, data: { lastLoginAt: new Date() } });
    await audit('login_success', account.id, { mfa: 'totp' });
    return res.json({ token, expiresIn: 900, account: accountResponse(account, account.platformAdminProfile) });
  } catch { return res.status(401).json({ error: 'Invalid or expired challenge token' }); }
});

router.use(requirePlatformAdmin);
const MIN_PLATFORM_ADMIN_PASSWORD_LENGTH = 8;
const pageArgs = (req) => ({ limit: Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100), offset: Math.max(Number.parseInt(req.query.offset, 10) || 0, 0) });
router.get('/admins', requirePlatformAdminRole('owner', 'operator', 'auditor'), async (req, res, next) => { try { const { limit, offset } = pageArgs(req); const where = { platformAdminProfile: { isNot: null } }; const [items, total] = await Promise.all([prisma.account.findMany({ where, skip: offset, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, platformAdminProfile: { select: { displayName: true, mobile: true, role: true, isActive: true, mfaEnabled: true, lastLoginAt: true, createdAt: true, updatedAt: true } } } }), prisma.account.count({ where })]); return res.json({ items: items.map(({ id, platformAdminProfile }) => ({ id, ...platformAdminProfile })), total, limit, offset }); } catch (error) { return next(error); } });
router.post('/admins', requirePlatformAdminRole('owner'), async (req, res, next) => { try { const id = typeof req.body?.id === 'string' ? req.body.id.trim() : ''; const password = typeof req.body?.password === 'string' ? req.body.password : ''; const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : ''; const role = ['owner', 'operator', 'auditor'].includes(req.body?.role) ? req.body.role : 'auditor'; if (!/^[A-Za-z0-9._-]{3,64}$/.test(id) || password.length < MIN_PLATFORM_ADMIN_PASSWORD_LENGTH || !displayName) return res.status(400).json({ error: 'ID、顯示名稱與至少 8 碼密碼為必填' }); const company = await prisma.company.findFirst({ select: { id: true } }); if (!company) return res.status(409).json({ error: '尚未建立可用的公司資料' }); const passwordHash = await bcrypt.hash(password, 12); const account = await prisma.account.create({ data: { id, email: `${id}@platform.local`, password: passwordHash, role: 'admin', companyId: company.id, platformAdminProfile: { create: { displayName, mobile: req.body?.mobile || null, role } } }, select: { id: true, platformAdminProfile: true } }); await audit('admin_created', req.platformAdmin.id, { adminId: id, role }); return res.status(201).json({ id: account.id, ...account.platformAdminProfile }); } catch (error) { if (error?.code === 'P2002') return res.status(409).json({ error: '管理員 ID 已存在' }); return next(error); } });
router.patch('/admins/:id', requirePlatformAdminRole('owner'), async (req, res, next) => { try { const id = req.params.id; const data = {}; if (typeof req.body?.displayName === 'string' && req.body.displayName.trim()) data.displayName = req.body.displayName.trim(); if (typeof req.body?.mobile === 'string') data.mobile = req.body.mobile.trim() || null; if (['owner', 'operator', 'auditor'].includes(req.body?.role)) data.role = req.body.role; if (typeof req.body?.isActive === 'boolean' && id !== req.platformAdmin.id) data.isActive = req.body.isActive; if (req.body?.password) { if (String(req.body.password).length < MIN_PLATFORM_ADMIN_PASSWORD_LENGTH) return res.status(400).json({ error: '密碼至少需要 8 碼' }); await prisma.account.update({ where: { id }, data: { password: await bcrypt.hash(req.body.password, 12) } }); } const profile = await prisma.platformAdminProfile.update({ where: { accountId: id }, data }); await audit('admin_updated', req.platformAdmin.id, { adminId: id, fields: Object.keys(data) }); return res.json({ id, ...profile }); } catch (error) { if (error?.code === 'P2025') return res.status(404).json({ error: '管理員不存在' }); return next(error); } });
router.get('/health', requirePlatformAdminRole('owner', 'operator', 'auditor'), async (_req, res) => { try { await prisma.$queryRaw`SELECT 1`; return res.json({ status: 'ok', database: 'ok', checkedAt: new Date().toISOString() }); } catch { return res.status(503).json({ status: 'degraded', database: 'unavailable', checkedAt: new Date().toISOString() }); } });
router.get('/tenants', requirePlatformAdminRole('owner', 'operator', 'auditor'), async (req, res, next) => { try { const { limit, offset } = pageArgs(req); const [items, total] = await Promise.all([prisma.company.findMany({ skip: offset, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, chineseName: true, englishName: true, email: true, country: true, subscriptionName: true, subscriptionStart: true, subscriptionEnd: true, createdAt: true, updatedAt: true } }), prisma.company.count()]); return res.json({ items, total, limit, offset }); } catch (error) { return next(error); } });
router.get('/subscriptions', requirePlatformAdminRole('owner', 'operator', 'auditor'), async (req, res, next) => { try { const { limit, offset } = pageArgs(req); const [items, total] = await Promise.all([prisma.company.findMany({ skip: offset, take: limit, orderBy: { subscriptionEnd: 'asc' }, select: { id: true, subscriptionName: true, subscriptionStart: true, subscriptionEnd: true } }), prisma.company.count()]); return res.json({ items, total, limit, offset }); } catch (error) { return next(error); } });
router.get('/plans', requirePlatformAdminRole('owner', 'operator', 'auditor'), async (_req, res, next) => { try { const plans = await prisma.company.findMany({ distinct: ['subscriptionName'], orderBy: { subscriptionName: 'asc' }, select: { subscriptionName: true } }); return res.json({ items: plans.map(({ subscriptionName }) => ({ name: subscriptionName })) }); } catch (error) { return next(error); } });
router.get('/audit-logs', requirePlatformAdminRole('owner', 'auditor'), async (req, res, next) => { try { const { limit, offset } = pageArgs(req); const [items, total] = await Promise.all([prisma.auditLog.findMany({ skip: offset, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, actorAccountId: true, action: true, resourceType: true, resourceId: true, metadata: true, createdAt: true } }), prisma.auditLog.count()]); return res.json({ items, total, limit, offset }); } catch (error) { return next(error); } });

export default router;
