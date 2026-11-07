// WhatsApp channels connected by scanning a QR code: creating them, following their connection, and storing
// what whatsapp-gateway reports. The gateway keeps the connection; this side keeps the messages and decides
// which number may connect to which channel.
import { ApolloError } from 'apollo-server-errors';
import { prisma } from '../db/prisma.js';
import { saveInboundMessage, saveConversationHistory, saveCompanyMessage, markMessageFailed } from '../../utils/utils.js';
import { isWebChannel, webExternalId, startSession, sessionStatus, removeSession, requestPairingCode, GatewayError } from './whatsappGateway.js';

// Files in older history are not downloaded; the conversation shows [圖片] and so on instead.
const HISTORY_MEDIA_DAYS = Number(process.env.WHATSAPP_WEB_HISTORY_MEDIA_DAYS || 30);
const DEFAULT_NAME = 'WhatsApp（待連結）';
const STATES = ['starting', 'qr', 'authenticated', 'syncing', 'ready', 'disconnected', 'logged_out', 'qr_timeout', 'rejected', 'failed'];

const digits = (phone) => String(phone || '').replace(/\D/g, '');

/** The connection as the GraphQL WhatsappWebConnection type has it. */
export const connectionView = (channel, live) => {
  const saved = channel.info?.wa_web || {};
  const source = live || saved;
  return {
    channel_id: channel.id,
    // offline: the gateway isn't running it, such as after the QR code was abandoned.
    state: live ? live.state : saved.state && !['starting', 'qr', 'authenticated'].includes(saved.state) ? saved.state : 'offline',
    qr: live?.qr || null,
    phone: source.phone || channel.accessInfo?.phone || null,
    name: source.name || null,
    progress: source.progress || null,
    error: source.error || null,
    updated_at: source.updated_at || null,
  };
};

const gatewayFailed = (error) => {
  if (error instanceof GatewayError) throw new ApolloError(error.message, 'WHATSAPP_GATEWAY_UNAVAILABLE');
  throw error;
};

const companyWebChannel = async (companyId, channelId) => {
  const channel = await prisma.companyChannel.findUnique({ where: { id: channelId } });
  if (!channel || channel.companyId !== companyId || channel.deletedAt || !isWebChannel(channel)) throw new ApolloError('找不到這個掃碼連結的 WhatsApp 頻道', 'NOT_FOUND');
  return channel;
};

/**
 * Starts connecting a WhatsApp number by QR code. Without a channel id a new channel is made, named
 * WhatsApp（待連結）until a phone scans; with one, an existing channel scans again.
 * @param {{ company_id: string, account_id: string }} admin
 */
export const connectWhatsappWeb = async (admin, channelId) => {
  let channel;
  if (channelId) {
    channel = await companyWebChannel(admin.company_id, channelId);
  } else {
    channel = await prisma.$transaction(async (tx) => {
      const created = await tx.companyChannel.create({
        data: { companyId: admin.company_id, platform: 'whatsapp', source: 'whatsapp_web', name: DEFAULT_NAME, accessInfo: { provider: 'web', connected_by: admin.account_id }, info: { wa_web: { state: 'starting' } } },
      });
      // Live messages reach the accounts in account_channels, so whoever connected it must be one.
      await tx.accountChannel.create({ data: { accountId: admin.account_id, channelId: created.id } });
      return tx.companyChannel.update({ where: { id: created.id }, data: { accessInfo: { ...created.accessInfo, id: webExternalId(created.id) } } });
    });
  }
  const live = await startSession(channel.id).catch(async (error) => {
    // A new channel that never got a QR code is of no use to anyone.
    if (!channelId) await prisma.companyChannel.delete({ where: { id: channel.id } }).catch(() => {});
    return gatewayFailed(error);
  });
  return connectionView(channel, live);
};

/** The connection right now, with the newest QR code while it waits for a scan. */
export const whatsappWebConnection = async (admin, channelId) => {
  const channel = await companyWebChannel(admin.company_id, channelId);
  const live = await sessionStatus(channel.id).catch(() => null);
  return connectionView(channel, live);
};

export const whatsappWebPairingCode = async (admin, channelId, phone) => {
  const channel = await companyWebChannel(admin.company_id, channelId);
  if (channel.accessInfo?.phone && digits(channel.accessInfo.phone) !== digits(phone)) {
    throw new ApolloError(`這個頻道只能重新連結原本的號碼 ${channel.accessInfo.phone}`, 'BAD_USER_INPUT');
  }
  const result = await requestPairingCode(channel.id, phone).catch(gatewayFailed);
  return result.code;
};

/**
 * Stops connecting. A channel no phone ever connected is removed; one that was connected before is left as it was.
 * @returns {boolean} true when the channel was removed
 */
export const cancelWhatsappWeb = async (admin, channelId) => {
  const channel = await companyWebChannel(admin.company_id, channelId);
  if (channel.accessInfo?.phone) return false;
  await removeSession(channel.id).catch(() => {});
  await prisma.companyChannel.delete({ where: { id: channel.id } });
  return true;
};

/**
 * Names the channel and gives it its agents, after a phone connected.
 * @param {string[]} [agentIds] - accounts of the company that work in this channel, added to whoever already does
 */
export const updateWhatsappWebChannel = async (admin, channelId, { name, agentIds = [] }) => {
  const channel = await companyWebChannel(admin.company_id, channelId);
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new ApolloError('請輸入社群名稱', 'BAD_USER_INPUT');
  const agents = agentIds.length
    ? await prisma.account.findMany({ where: { id: { in: agentIds }, companyId: admin.company_id }, select: { id: true } })
    : [];
  if (agents.length !== new Set(agentIds).size) throw new ApolloError('找不到部分專員，請重新選擇', 'BAD_USER_INPUT');
  return prisma.$transaction(async (tx) => {
    if (agents.length) await tx.accountChannel.createMany({ data: agents.map(({ id }) => ({ accountId: id, channelId: channel.id })), skipDuplicates: true });
    return tx.companyChannel.update({ where: { id: channel.id }, data: { name: trimmed.slice(0, 100) } });
  });
};

// ----- Events from whatsapp-gateway -----

/**
 * Brings back the conversations of channels the company removed that had this number: they move to the channel
 * the phone just connected, with their agents and name, and the removed channels are dropped.
 * @returns {string} the channel's name
 */
const takeOverRemoved = async (channel, removed, name) => {
  const ids = removed.map(({ id }) => id);
  const latest = [...removed].sort((a, b) => b.deletedAt - a.deletedAt)[0];
  await prisma.$transaction(async (tx) => {
    const agents = await tx.accountChannel.findMany({ where: { channelId: { in: ids } }, select: { accountId: true } });
    if (agents.length) await tx.accountChannel.createMany({ data: agents.map(({ accountId }) => ({ accountId, channelId: channel.id })), skipDuplicates: true });
    await tx.chatRoom.updateMany({ where: { channelId: { in: ids } }, data: { channelId: channel.id } });
    await tx.messageRecipient.updateMany({ where: { channelId: { in: ids } }, data: { channelId: channel.id } });
    await tx.companyChannel.deleteMany({ where: { id: { in: ids } } });
  });
  console.info(`WhatsApp channel ${channel.id} took over the conversations of removed channels ${ids.join(', ')}`);
  return name === DEFAULT_NAME ? latest.name : name;
};

/**
 * Records a change in a channel's connection. When a phone connects, its number is checked: a channel that
 * scans again must stay on the same number, and a number can only be in one channel.
 * @returns {{ action?: 'logout', reason?: string, message?: string }} what the gateway should do
 */
const onStatus = async (channel, status) => {
  if (!STATES.includes(status?.state)) return {};
  const accessInfo = { ...channel.accessInfo };
  let rejection = null;
  let { name } = channel;

  if (status.phone && ['syncing', 'ready'].includes(status.state) && digits(status.phone) !== digits(accessInfo.phone)) {
    if (accessInfo.phone) {
      rejection = { reason: 'wrong_number', message: `這個頻道只能重新連結原本的號碼 ${accessInfo.phone}，請用該手機掃碼` };
    } else {
      const others = (await prisma.companyChannel.findMany({ where: { platform: 'whatsapp', id: { not: channel.id } } }))
        .filter((other) => isWebChannel(other) && digits(other.accessInfo?.phone) === digits(status.phone));
      // A channel another company removed doesn't hold on to the number.
      const owner = others.find((other) => !other.deletedAt);
      if (owner) {
        rejection = { reason: 'already_connected', message: owner.companyId === channel.companyId ? `這個號碼已經連結在「${owner.name}」` : '這個號碼已經連結在其他公司' };
      } else {
        accessInfo.phone = status.phone;
        const removed = others.filter((other) => other.companyId === channel.companyId);
        if (removed.length) name = await takeOverRemoved(channel, removed, name);
        if (name === DEFAULT_NAME) name = status.name || status.phone;
      }
    }
  }

  const saved = rejection
    ? { state: 'rejected', error: rejection.message, updated_at: new Date().toISOString() }
    : { state: status.state, phone: status.phone || null, name: status.name || null, error: status.error || null, progress: status.progress || null, updated_at: status.updated_at || new Date().toISOString() };
  await prisma.companyChannel.update({ where: { id: channel.id }, data: { name, accessInfo, info: { ...(channel.info || {}), wa_web: saved } } });
  if (rejection) console.warn(`WhatsApp channel ${channel.id} rejected ${status.phone}: ${rejection.reason}`);
  return rejection ? { action: 'logout', ...rejection } : {};
};

/** A message on the number: from a customer, or sent from the phone itself. */
const onMessage = async (channel, message) => {
  if (!channel.accessInfo?.phone || !message?.externalId || !message.chatId) return {};
  if (message.fromMe) {
    await saveCompanyMessage({ channel, chatRoomId: message.chatId, customer: message.customer, contents: message.contents, externalId: message.externalId, sentAt: message.sentAt, accountId: channel.accessInfo.connected_by });
  } else {
    await saveInboundMessage({ externalChannelId: webExternalId(channel.id), platform: 'whatsapp', chatRoomId: message.chatId, contents: message.contents, customer: message.customer, externalId: message.externalId });
  }
  return {};
};

const withoutOldMedia = (message, cutoff) => {
  if (new Date(message.sentAt).getTime() >= cutoff || !message.contents?.attachments) return message;
  const attachments = message.contents.attachments.map(({ wa_web_media: _skip, ...attachment }) => attachment);
  return { ...message, contents: { ...message.contents, attachments } };
};

// Each channel's history is stored one batch at a time, in the background: downloading its files can take minutes.
const historyQueues = new Map();

const onHistory = (channel, conversations) => {
  if (!channel.accessInfo?.phone || !Array.isArray(conversations)) return {};
  const cutoff = Date.now() - HISTORY_MEDIA_DAYS * 86400000;
  const batch = conversations.map(({ chatId, customer, messages }) => ({
    chatRoomId: chatId,
    customer,
    // What was sent from the phone counts as the company's reply.
    messages: (messages || []).map((message) => ({ ...withoutOldMedia(message, cutoff), fromCompany: Boolean(message.fromMe) })),
  }));
  const previous = historyQueues.get(channel.id) || Promise.resolve();
  const next = previous.then(async () => {
    // Read again: the channel may have been disabled or removed while earlier batches were stored.
    const current = await prisma.companyChannel.findUnique({ where: { id: channel.id } });
    if (!current?.enabled || current.deletedAt) return;
    const stored = await saveConversationHistory(current, batch, current.accessInfo?.connected_by);
    console.info(`WhatsApp history for channel ${channel.id}: ${stored} messages from ${batch.length} chats`);
  }).catch((error) => console.error(`WhatsApp history for channel ${channel.id} not stored:`, error.message));
  historyQueues.set(channel.id, next);
  next.finally(() => { if (historyQueues.get(channel.id) === next) historyQueues.delete(channel.id); });
  return {};
};

/**
 * Handles one event from the gateway.
 * @returns {{ status: number, body: object }} 410 when the channel no longer exists, so the gateway forgets it
 */
export const handleGatewayEvent = async (event) => {
  const channel = event?.channelId ? await prisma.companyChannel.findUnique({ where: { id: event.channelId } }) : null;
  if (!isWebChannel(channel) || channel.deletedAt) return { status: 410, body: { error: 'Unknown channel' } };
  // A new channel whose QR code ran out before any phone scanned it was abandoned, such as by closing the browser.
  if (event.type === 'status' && event.status?.state === 'qr_timeout' && !channel.accessInfo?.phone) {
    await prisma.companyChannel.delete({ where: { id: channel.id } }).catch(() => {});
    return { status: 410, body: { error: 'Channel was never connected' } };
  }
  switch (event.type) {
    case 'status': return { status: 200, body: await onStatus(channel, event.status) };
    case 'message': return { status: 200, body: await onMessage(channel, event.message) };
    case 'history': return { status: 202, body: onHistory(channel, event.conversations) };
    case 'ack':
      if (event.failed && event.externalId) await markMessageFailed(event.externalId, 'WhatsApp 無法送達這則訊息');
      return { status: 200, body: {} };
    default: return { status: 400, body: { error: 'Unknown event type' } };
  }
};
