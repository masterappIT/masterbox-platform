// One whatsapp-web.js Client per MasterBox channel. Each is a linked device of the phone that scanned its QR code,
// and its login is kept in DATA_PATH, so the gateway reconnects every number by itself after a restart.
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import pkg from 'whatsapp-web.js';
import { report } from './backend.js';
import { toMasterboxMessage, customerOf, chatIdOf, isCustomerChat, sendOptions } from './messages.js';

const { Client, LocalAuth, MessageMedia } = pkg;

export const DATA_PATH = process.env.DATA_PATH || path.resolve('.wwebjs');
// How far back the chats are copied after connecting, and how many messages per chat at most.
const HISTORY_DAYS = Number(process.env.HISTORY_DAYS || 365);
const HISTORY_MESSAGES_PER_CHAT = Number(process.env.HISTORY_MESSAGES_PER_CHAT || 500);
const HISTORY_BATCH = 10;
// WhatsApp offers a new QR code about every 20 seconds; after this many the session stops waiting.
const QR_MAX_RETRIES = Number(process.env.QR_MAX_RETRIES || 6);

const sessions = new Map();

const now = () => new Date().toISOString();

/** What the backend and admin are shown about a channel's connection. */
const view = (session) => ({
  channel_id: session.channelId,
  state: session.state,
  qr: session.state === 'qr' ? session.qr : null,
  phone: session.phone || null,
  name: session.name || null,
  progress: session.progress,
  error: session.error || null,
  updated_at: session.updatedAt,
});

/** The channel's connection, or null when the gateway isn't running it. */
export const status = (channelId) => {
  const session = sessions.get(channelId);
  return session ? view(session) : null;
};

const setState = async (session, state, fields = {}) => {
  Object.assign(session, { state, updatedAt: now() }, fields);
  const answer = await report(session.channelId, { type: 'status', status: view(session) }).catch((error) => {
    console.error(`[${session.channelId}] status not reported:`, error.message);
    return {};
  });
  await follow(session, answer);
  return answer;
};

// The backend can turn a number away, such as the wrong phone scanning a reconnect code, or a channel deleted meanwhile.
const follow = async (session, answer) => {
  if (answer?.gone) {
    console.info(`[${session.channelId}] channel no longer exists; removing its login`);
    await remove(session.channelId);
  } else if (answer?.action === 'logout') {
    console.info(`[${session.channelId}] backend rejected this number: ${answer.reason}`);
    await logoutClient(session);
    Object.assign(session, { state: 'rejected', error: answer.message || answer.reason, phone: null, name: null, updatedAt: now() });
  }
};

const sessionDir = (channelId) => path.join(DATA_PATH, `session-${channelId}`);
// Chromium may still be writing its profile as it shuts down, so removing it is retried for a few seconds.
const forgetLogin = (channelId) => fs.promises.rm(sessionDir(channelId), { recursive: true, force: true, maxRetries: 10, retryDelay: 500 })
  .catch((error) => console.error(`[${channelId}] login files not removed:`, error.message));

const createClient = (channelId) => new Client({
  authStrategy: new LocalAuth({ clientId: channelId, dataPath: DATA_PATH }),
  qrMaxRetries: QR_MAX_RETRIES,
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-zygote'],
  },
});

/**
 * Starts the channel's client, or returns the one already running. A channel that was logged out
 * or whose QR code expired starts over with a new code.
 * @param {string} channelId - the MasterBox channel id
 */
export const start = async (channelId) => {
  if (!/^[\w-]+$/.test(channelId)) throw Object.assign(new Error('Invalid channel id'), { status: 400 });
  const existing = sessions.get(channelId);
  if (existing?.client && !['logged_out', 'qr_timeout', 'failed', 'rejected', 'disconnected'].includes(existing.state)) return view(existing);
  if (existing?.client) await destroyClient(existing);

  const session = existing || { channelId };
  Object.assign(session, { client: createClient(channelId), state: 'starting', qr: null, error: null, progress: null, updatedAt: now(), sentIds: new Set() });
  sessions.set(channelId, session);
  wire(session);
  session.client.initialize().catch(async (error) => {
    console.error(`[${channelId}] failed to start:`, error.message);
    if (session.client) await setState(session, 'failed', { error: '無法啟動 WhatsApp 連線，請稍後再試' });
  });
  return view(session);
};

const wire = (session) => {
  const { client, channelId } = session;
  // One channel's failure must never stop the gateway, which holds every other number's connection.
  const on = (event, handler) => client.on(event, (...args) => {
    Promise.resolve().then(() => handler(...args)).catch((error) => console.error(`[${channelId}] ${event} handler failed:`, error.message));
  });

  on('qr', async (qr) => {
    session.qr = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
    // Only the first code is worth telling the backend about; the admin asks for the newest one.
    if (session.state !== 'qr') await setState(session, 'qr');
    else session.updatedAt = now();
  });

  on('authenticated', () => setState(session, 'authenticated', { qr: null }));

  on('auth_failure', async (message) => {
    console.warn(`[${channelId}] auth failure:`, message);
    await setState(session, 'logged_out', { error: '登入已失效，請重新掃碼' });
    await destroyClient(session);
    await forgetLogin(channelId);
  });

  on('ready', async () => {
    const { wid, pushname } = client.info || {};
    session.phone = wid?.user ? `+${wid.user}` : null;
    session.name = pushname || null;
    const answer = await setState(session, 'syncing', { progress: { chats_total: 0, chats_done: 0, messages: 0 } });
    if (answer?.gone || answer?.action) return;
    syncHistory(session).catch(async (error) => {
      console.error(`[${channelId}] history sync failed:`, error.message);
      if (session.state === 'syncing') await setState(session, 'ready', { error: '部分聊天記錄未能同步' });
    });
  });

  on('disconnected', async (reason) => {
    console.warn(`[${channelId}] disconnected:`, reason);
    if (session.state === 'rejected') return;
    const timedOut = /max qrcode retries/i.test(String(reason));
    const blocked = reason === 'TOS_BLOCK' || reason === 'SMB_TOS_BLOCK';
    const loggedOut = blocked || reason === 'LOGOUT' || reason === 'UNPAIRED' || reason === 'UNPAIRED_IDLE';
    await setState(session, timedOut ? 'qr_timeout' : loggedOut ? 'logged_out' : 'disconnected', {
      qr: null,
      error: timedOut ? 'QR 碼已過期'
        : blocked ? 'WhatsApp 已停用這個號碼'
          : loggedOut ? '手機已移除這個連結裝置，或超過 14 天未上線，請重新掃碼'
            : '連線中斷，正在重新連線',
    });
    await destroyClient(session);
    // A logged-out login can't be used again; keeping it would bring back a QR code after every restart.
    if (loggedOut || timedOut) await forgetLogin(channelId);
    // A dropped connection that is still logged in comes back by itself.
    if (!timedOut && !loggedOut && sessions.get(channelId) === session) setTimeout(() => start(channelId).catch(() => {}), 15000);
  });

  // message_create covers both what customers send and what is sent from the phone itself.
  on('message_create', async (msg) => {
    if (msg.fromMe) {
      // MasterBox stores its own replies when they are sent; give that a moment before treating this as sent from the phone.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (session.sentIds.delete(msg.id._serialized)) return;
    }
    const message = toMasterboxMessage(msg);
    if (!message) return;
    const contact = await msg.getContact().catch(() => null);
    // For the phone's own messages getContact is the phone; the customer is the chat.
    const customer = msg.fromMe ? customerOf(message.chatId, await chatContact(client, message.chatId)) : customerOf(message.chatId, contact);
    await report(channelId, { type: 'message', message: { ...message, customer } }).catch((error) => console.error(`[${channelId}] message ${message.externalId} not reported:`, error.message));
  });

  // WhatsApp couldn't deliver a reply.
  on('message_ack', (msg, ack) => {
    if (ack !== -1 || !msg.fromMe) return;
    report(channelId, { type: 'ack', externalId: msg.id._serialized, failed: true }).catch(() => {});
  });
};

const chatContact = (client, chatId) => client.getContactById(chatId).catch(() => null);

// Copies the recent conversations of a newly connected number. Run again after a reconnect, it fills in what
// arrived while the gateway was offline; the backend skips messages it already has.
const syncHistory = async (session) => {
  const { client, channelId } = session;
  const since = Date.now() / 1000 - HISTORY_DAYS * 86400;
  const chats = (await client.getChats()).filter((chat) => !chat.isGroup && isCustomerChat(chat.id._serialized) && (chat.timestamp || 0) >= since);
  session.progress = { chats_total: chats.length, chats_done: 0, messages: 0 };

  for (let i = 0; i < chats.length; i += HISTORY_BATCH) {
    if (session.state !== 'syncing' || sessions.get(channelId) !== session) return;
    const conversations = [];
    for (const chat of chats.slice(i, i + HISTORY_BATCH)) {
      const messages = (await chat.fetchMessages({ limit: HISTORY_MESSAGES_PER_CHAT }).catch(() => []))
        .filter((msg) => msg.timestamp >= since)
        .map(toMasterboxMessage)
        .filter(Boolean);
      if (!messages.length) continue;
      const chatId = chat.id._serialized;
      conversations.push({ chatId, customer: customerOf(chatId, await chat.getContact().catch(() => null)), messages });
    }
    if (conversations.length) {
      const answer = await report(channelId, { type: 'history', conversations });
      if (answer?.gone) return follow(session, answer);
    }
    session.progress = {
      chats_total: chats.length,
      chats_done: Math.min(chats.length, i + HISTORY_BATCH),
      messages: session.progress.messages + conversations.reduce((sum, { messages }) => sum + messages.length, 0),
    };
    session.updatedAt = now();
  }
  await setState(session, 'ready');
};

const runningClient = (channelId) => {
  const session = sessions.get(channelId);
  if (!session?.client || !['ready', 'syncing'].includes(session.state)) {
    throw Object.assign(new Error('這個 WhatsApp 號碼目前沒有連線'), { status: 409 });
  }
  return session;
};

/**
 * Sends one part of an agent's reply.
 * @param {{ to: string, text?: string, media?: { url, mimetype, filename }, sendType?: string }} part
 * @returns {Promise<{ id: string, timestamp: number }>}
 */
export const send = async (channelId, { to, text, media, sendType }) => {
  const session = runningClient(channelId);
  if (!isCustomerChat(to)) throw Object.assign(new Error('Invalid recipient'), { status: 400 });
  const { content, options } = sendOptions({ text, media, sendType });
  const body = content === 'media'
    ? await MessageMedia.fromUrl(media.url, { unsafeMime: true, filename: media.filename })
    : content;
  if (content === 'media' && media.mimetype) body.mimetype = media.mimetype;
  const msg = await session.client.sendMessage(to, body, options);
  session.sentIds.add(msg.id._serialized);
  // Forget it if WhatsApp never echoes it back.
  setTimeout(() => session.sentIds.delete(msg.id._serialized), 60000).unref();
  return { id: msg.id._serialized, timestamp: msg.timestamp };
};

/** A file a customer sent, for the backend to keep a copy of. */
export const media = async (channelId, messageId) => {
  const session = runningClient(channelId);
  const msg = await session.client.getMessageById(messageId);
  if (!msg?.hasMedia || !isCustomerChat(chatIdOf(msg))) throw Object.assign(new Error('Message has no file'), { status: 404 });
  const file = await msg.downloadMedia();
  if (!file?.data) throw Object.assign(new Error('WhatsApp no longer has this file'), { status: 410 });
  return { buffer: Buffer.from(file.data, 'base64'), mimetype: file.mimetype, filename: file.filename };
};

/** A code to type on the phone instead of scanning, under Linked devices → Link with phone number. */
export const pairingCode = async (channelId, phone) => {
  const session = sessions.get(channelId);
  if (!session?.client || session.state !== 'qr') throw Object.assign(new Error('請先開始連結再取得配對碼'), { status: 409 });
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) throw Object.assign(new Error('請輸入含國碼的電話號碼'), { status: 400 });
  return session.client.requestPairingCode(digits);
};

const destroyClient = async (session) => {
  const { client } = session;
  session.client = null;
  await client?.destroy().catch(() => {});
};

const logoutClient = async (session) => {
  const { client } = session;
  session.client = null;
  await client?.logout().catch(() => {});
  await client?.destroy().catch(() => {});
  await forgetLogin(session.channelId);
};

/** Logs the number out, which removes this linked device from the phone, and forgets the channel. */
export const remove = async (channelId) => {
  const session = sessions.get(channelId);
  sessions.delete(channelId);
  if (session) await logoutClient(session);
  else await forgetLogin(channelId);
};

/** Reconnects every number that was logged in before the gateway stopped. */
export const restoreAll = async () => {
  await fs.promises.mkdir(DATA_PATH, { recursive: true });
  const dirs = (await fs.promises.readdir(DATA_PATH, { withFileTypes: true })).filter((entry) => entry.isDirectory() && entry.name.startsWith('session-'));
  for (const { name } of dirs) {
    const channelId = name.slice('session-'.length);
    console.info(`Restoring WhatsApp channel ${channelId}`);
    await start(channelId).catch((error) => console.error(`[${channelId}] not restored:`, error.message));
  }
  return dirs.length;
};

export const shutdown = async () => {
  await Promise.all([...sessions.values()].map(destroyClient));
};
