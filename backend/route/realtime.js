import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/db/prisma.js';
import { pubsub } from '../config/redis.js';
import { getJwtSecret } from '../lib/auth/jwtSecret.js';

const router = express.Router();

const SIGNAL_TYPES = new Set(['call.accepted', 'call.started', 'call.ended', 'call.declined', 'call.missed', 'call.ice-candidate', 'call.offer', 'call.answer', 'call.media-state']);
const LIVEKIT_DEFAULT_TTL = 300;
const tokenFrom = req => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

function livekitToken({ apiKey, apiSecret, identity, roomName, ttlSeconds }) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: apiKey,
    sub: identity,
    iat: now,
    nbf: now,
    exp: now + ttlSeconds,
    video: { room: roomName, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true },
  })).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', apiSecret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

async function authenticate(req, res, next) {
  try {
    const token = tokenFrom(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const payload = jwt.verify(token, getJwtSecret());
    const accountId = payload.account_id || payload.user_id;
    const account = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, companyId: true } });
    if (!account) return res.status(401).json({ error: 'Invalid account' });
    req.account = account;
    next();
  } catch { res.status(401).json({ error: 'Invalid/expired token' }); }
}
async function scopedCall(req, id) {
  const call = await prisma.callSession.findFirst({
    where: { id, companyId: req.account.companyId },
    include: { participants: { select: { accountId: true } } },
  });
  if (!call || !call.participants.some(participant => participant.accountId === req.account.id)) return null;
  return call;
}
router.use(authenticate);
router.post('/calls/:id/livekit-token', async (req, res, next) => {
  try {
    const call = await scopedCall(req, req.params.id);
    if (!call) return res.status(404).json({ error: 'Call not found' });
    const apiKey = process.env.LIVEKIT_API_KEY?.trim();
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
    const serverUrl = process.env.LIVEKIT_URL?.trim();
    if (!apiKey || !apiSecret || !serverUrl) return res.status(503).json({ error: 'LiveKit is not configured' });
    const requestedTtl = req.body?.ttlSeconds;
    const ttlSeconds = requestedTtl === undefined ? Number(process.env.LIVEKIT_TOKEN_TTL_SECONDS || LIVEKIT_DEFAULT_TTL) : Number(requestedTtl);
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 900) return res.status(400).json({ error: 'ttlSeconds must be an integer between 60 and 900' });
    const roomName = `call_${call.id}`;
    res.json({ token: livekitToken({ apiKey, apiSecret, identity: req.account.id, roomName, ttlSeconds }), roomName, serverUrl, expiresIn: ttlSeconds });
  } catch (e) { next(e); }
});
router.post('/calls', async (req, res, next) => {
  try {
    const { roomId, kind = 'voice', participantIds = [], metadata } = req.body || {};
    if (!roomId || !['voice', 'video'].includes(kind)) return res.status(400).json({ error: 'roomId and valid kind are required' });
    const room = await prisma.chatRoom.findFirst({ where: { id: roomId, companyId: req.account.companyId } });
    if (!room) return res.status(404).json({ error: 'Chat room not found' });
    const ids = [...new Set([req.account.id, ...participantIds])];
    const valid = await prisma.account.count({ where: { id: { in: ids }, companyId: req.account.companyId } });
    if (valid !== ids.length) return res.status(400).json({ error: 'Invalid participant' });
    const call = await prisma.callSession.create({ data: { companyId: req.account.companyId, roomId, initiatedBy: req.account.id, kind, metadata, participants: { create: ids.map(accountId => ({ accountId })) } }, include: { participants: true } });
    await pubsub.publish(`call:${call.id}`, { callEvent: { type: 'call.created', call } });
    res.status(201).json(call);
  } catch (e) { next(e); }
});
router.post('/calls/:id/events', async (req, res, next) => {
  try {
    const call = await scopedCall(req, req.params.id);
    if (!call) return res.status(404).json({ error: 'Call not found' });
    const { type, payload = {} } = req.body || {};
    if (!type || !SIGNAL_TYPES.has(type) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return res.status(400).json({ error: 'type and object payload are required' });
    if (['call.offer', 'call.answer', 'call.ice-candidate'].includes(type) && JSON.stringify(payload).length > 32768) return res.status(413).json({ error: 'signaling payload too large' });
    const event = await prisma.callSignalEvent.create({ data: { callId: call.id, senderId: req.account.id, eventType: type, payload } });
    if (type === 'call.started' || type === 'call.ended' || type === 'call.declined') await prisma.callSession.update({ where: { id: call.id }, data: { status: type === 'call.started' ? 'active' : type === 'call.ended' ? 'ended' : 'declined', ...(type === 'call.started' ? { startedAt: new Date() } : { endedAt: new Date() }) } });
    await pubsub.publish(`call:${call.id}`, { callEvent: event });
    res.status(201).json(event);
  } catch (e) { next(e); }
});


router.get('/calls/:id', async (req, res, next) => {
  try {
    const call = await scopedCall(req, req.params.id);
    if (!call) return res.status(404).json({ error: 'Call not found' });
    const details = await prisma.callSession.findUnique({ where: { id: call.id }, include: { participants: true, events: { orderBy: { createdAt: 'asc' } } } });
    res.json(details);
  } catch (e) { next(e); }
});

export default router;
