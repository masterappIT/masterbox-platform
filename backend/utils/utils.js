import { prisma } from '../lib/db/prisma.js';
import { ApolloError } from 'apollo-server-errors';
import { pubsub } from '../config/redis.js';
import { replyContentsOf, splitReply, storedAttachment } from '../lib/messaging/outbound.js';
import { describeUrl } from '../lib/storage/index.js';
import { storeInboundAttachments } from '../lib/messaging/inbound.js';
import { messagePreview, encodeCursor } from '../lib/messaging/conversationText.js';
import { makeBody, legacyContents, bodyView } from '../lib/messaging/messageBody.js';
import { templateView, templateMessage } from '../lib/messaging/whatsappTemplates.js';
import { lastCustomerMessageAt } from '../lib/messaging/conversations.js';
import { channelAccountIds } from '../lib/messaging/access.js';
import { notifyCustomerMessage } from '../lib/push/notifications.js';
import { connectorFor, capabilitiesOf } from '../lib/connectors/index.js';

export { metaFailureReason } from '../lib/connectors/shared/meta.js';

export const errorTypes = {
  MISS_REQUEUED_PRAMS: 'MISS_REQUEUED_PRAMS',
  ID_NOT_FOUND: 'ID_NOT_FOUND',
  FIND_FIELD_DETAIL_FAILED: 'FIND_FIELD_DETAIL_FAILED',
};

export const objectIdGenerator = (id) => {
  if (typeof id !== 'string' || !id.trim()) throw new ApolloError('Invalid id', 'BAD_USER_INPUT');
  return id;
};

export const trialDateGenerator = (trialDays) => new Date(Date.now() + trialDays * 86400000);
export const channelPlatforms = ['fb', 'ig', 'whatsapp', 'line', 'wechat'];
export const SEND_MESSAGE = 'sendMessage';

const recipientRooms = message => (message.recipients || []).flatMap(r => r.chatRoomIds || []);
/**
 * A stored message as the API shows it.
 * @param {string} [viewerId] - the account looking at it, for isMine; without it isMine is null
 */
export const messageView = (message, requestedRoom, viewerId) => {
  // contents and text stay as clients built before body have always read them.
  const text = legacyContents(message.contents);
  const rooms = recipientRooms(message);
  const encryptionMode = message.encryptionMode || message.encryption_mode || 'server';
  return {
    id: message.id || message._id?.toString(), _id: message.id || message._id?.toString(),
    platform: message.platform, contents: text, text, recipients: rooms,
    body: bodyView(message.contents, encryptionMode),
    to_chat_room_id: requestedRoom || rooms[0] || null,
    channel_id: message.recipients?.[0]?.channelId || message.channel_id || null,
    encryption_mode: encryptionMode, disappearing_after_seconds: message.disappearingAfterSeconds || null, expiresAt: message.expiresAt || null, readAt: message.readAt || null, sentAt: message.createdAt || message.created_at || null,
    // Sent by the account looking at it, rather than by the customer or a colleague.
    isMine: viewerId ? Boolean(message.createdBy) && message.createdBy === viewerId : null,
    inbound: !message.createdBy,
    delivery_error: message.deliveryError || null,
    preview: messagePreview(message.contents, message.encryptionMode),
    cursor: message.id && message.createdAt ? encodeCursor(message.createdAt, message.id) : null,
  };
};

// Everyone who works in the channel follows its conversations, not just whoever sent the message.
export const publishMessage = async (message) => {
  const channelId = message.recipients?.[0]?.channelId;
  if (!channelId) return;
  const accountIds = await channelAccountIds(message.companyId, channelId);
  // Each account gets its own copy, so isMine is right for whoever reads it.
  await Promise.all(accountIds.map(accountId => pubsub.publish(`${SEND_MESSAGE}-${accountId}`, { sendMessage: messageView(message, undefined, accountId) })));
};

// --- Replying --------------------------------------------------------------------------------------------------
// One flow for every source: check what the agent sent, check the source's reply rule, then let its connector send.

/** A conversation's channel and the connector it sends through. A channel removed from the database still has its platform. */
const roomConnector = async (room) => {
  const channel = await prisma.companyChannel.findUnique({ where: { id: room.channelId } });
  const connector = connectorFor(channel || { platform: room.platform });
  if (!connector.replies) throw new ApolloError(connector.notReady(channel), 'SEND_FAILED');
  return { channel, connector };
};

/**
 * The channel and customer a reply in this conversation goes between, checked before anything is sent.
 * @returns {{ channel, connector, customerId }}
 */
const replyTarget = async (room, { channel, connector }) => {
  if (channel?.deletedAt) throw new ApolloError('此頻道已移除，重新連結後才能回覆', 'SEND_FAILED');
  if (channel && !channel.enabled) throw new ApolloError('此頻道已停用，請到社群平台管理啟用後再回覆', 'SEND_FAILED');
  const notReady = connector.notReady(channel);
  if (notReady) throw new ApolloError(notReady, 'SEND_FAILED');
  // The recipient comes from the stored conversation rather than the client.
  const customerId = connector.recipient(room);
  if (!customerId) throw new ApolloError('找不到這段對話的客戶，無法送出訊息', 'SEND_FAILED');
  return { channel, connector, customerId };
};

/** The file an agent attached, checked against storage and what the source accepts. */
const replyAttachment = async (connector, attachments) => {
  if (!attachments.length) return {};
  if (attachments.length > 1) throw new ApolloError('一次只能傳送一個附件', 'SEND_FAILED');
  const file = await describeUrl(attachments[0]?.payload?.url ?? attachments[0]?.url);
  if (!file) throw new ApolloError('找不到這個附件，請重新選擇檔案', 'SEND_FAILED');
  const check = connector.checkAttachment({ mime: file.mime_type, size: file.size });
  if (!check.ok) throw new ApolloError(check.reason, 'SEND_FAILED');
  return { attachment: storedAttachment(file), sendType: check.sendType };
};

/**
 * Works out how a reply goes to the customer, before anything is sent.
 * @returns {{ parts, send, failed }} parts in the order they are sent; send(part) returns the platform's message id
 *   or throws, and failed(error) says why in words an agent can act on
 */
const prepareReply = async (room, contents) => {
  const source = await roomConnector(room);
  const { connector, channel } = source;
  const capabilities = capabilitiesOf(channel || { platform: room.platform });

  // 1. What the agent sent.
  const { text, attachments } = replyContentsOf(contents);
  const { attachment, sendType } = await replyAttachment(connector, attachments);
  const parts = splitReply({ text, attachment, sendType }, { caption: capabilities.includes('caption') });
  if (!parts.length) throw new ApolloError('訊息內容不可空白', 'SEND_FAILED');

  // 2. The source's rules: the channel can send, and the reply is allowed now.
  const { customerId } = await replyTarget(room, source);
  const rule = connector.replyRule(room, {
    lastCustomerMessageAt: capabilities.includes('reply_window') ? await lastCustomerMessageAt(room) : null,
  });
  if (rule.blockReason) throw new ApolloError(rule.blockReason, 'SEND_FAILED', { templateRequired: rule.templateRequired });

  // 3. The source sends it.
  const target = { channel, customerId, messagingTag: rule.messagingTag };
  return {
    parts,
    send: part => connector.send(target, part),
    failed: error => connector.failureReason(error, channel),
  };
};

/** Stores a message the company sent and tells everyone in the channel. */
const storeReply = async (room, accountId, contents, externalId) => {
  const message = await prisma.message.create({
    data: {
      companyId: room.companyId,
      createdBy: accountId,
      platform: room.platform,
      contents,
      externalId,
      recipients: { create: [{ channelId: room.channelId, chatRoomIds: [room.chatRoomId || room.id] }] },
    },
    include: { recipients: true },
  });
  await prisma.chatRoom.update({ where: { id: room.id }, data: { updatedAt: new Date() } });
  await publishMessage(message);
  return message;
};

/**
 * Sends an agent's reply. Only what the platform accepted is stored, so nothing here can look sent when it wasn't.
 * A reply with a file may go as two messages; when only the file went out, the error says so and carries `sentAttachment`.
 * @returns the last stored message
 */
export const handleSendMessage = async (accountId, roomId, contents, channelId) => {
  if (!accountId) throw new ApolloError('A PostgreSQL account is required', 'SEND_FAILED');
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new ApolloError('Invalid account', 'SEND_FAILED');
  const room = await prisma.chatRoom.findFirst({
    where: { companyId: account.companyId, ...(channelId ? { channelId } : {}), OR: [{ id: roomId }, { chatRoomId: roomId }] },
  });
  if (!room) throw new ApolloError('Chat room not found', 'SEND_FAILED');
  const { parts, send, failed } = await prepareReply(room, contents);

  let message = null;
  for (const part of parts) {
    let externalId;
    try {
      externalId = await send(part);
    } catch (error) {
      const reason = failed(error);
      if (!message) throw new ApolloError(reason, 'SEND_FAILED');
      throw new ApolloError(`附件已送出，但文字沒有送出：${reason}`, 'SEND_FAILED', { sentAttachment: true });
    }
    const body = makeBody({ text: part.text, attachments: part.attachment ? [part.attachment] : [] });
    message = await storeReply({ ...room, companyId: account.companyId }, account.id, body, externalId);
  }
  return message;
};

/** A room's channel, checked to have the templates capability and a business account to read them from. */
const templateChannel = async (room) => {
  const source = await prisma.companyChannel.findUnique({ where: { id: room.channelId } })
    .then(channel => ({ channel, connector: connectorFor(channel || { platform: room.platform }) }));
  if (!capabilitiesOf(source.channel || { platform: room.platform }).includes('templates')) {
    if (source.connector.noTemplatesReason) throw new ApolloError(source.connector.noTemplatesReason, 'TEMPLATES_UNAVAILABLE');
    throw new ApolloError('只有 WhatsApp 對話可以使用 WhatsApp 範本', 'BAD_USER_INPUT');
  }
  const target = await replyTarget(room, source);
  const unavailable = target.connector.templatesUnavailable(target.channel);
  if (unavailable) throw new ApolloError(unavailable, 'TEMPLATES_UNAVAILABLE');
  return target;
};

/** The channel's approved templates, ready for the agent to fill in. */
export const listWhatsappTemplates = async (room) => {
  const { connector, channel } = await templateChannel(room);
  try {
    const templates = await connector.templates(channel);
    return templates.map(templateView).sort((a, b) => Number(b.supported) - Number(a.supported) || a.name.localeCompare(b.name));
  } catch (error) {
    throw new ApolloError(`無法讀取 WhatsApp 範本：${connector.failureReason(error, channel)}`, 'TEMPLATES_UNAVAILABLE');
  }
};

/**
 * Sends an approved template, which WhatsApp allows outside the 24-hour window too. The conversation keeps the filled-in text.
 * @param {{ templateId: string, values: { key, value }[], headerMediaUrl?: string }} input
 * @returns the stored message
 */
export const sendWhatsappTemplate = async (accountId, room, { templateId, values, headerMediaUrl }) => {
  const target = await templateChannel(room);
  const { connector, channel, customerId } = target;
  let templates;
  try {
    templates = await connector.templates(channel);
  } catch (error) {
    throw new ApolloError(`無法讀取 WhatsApp 範本：${connector.failureReason(error, channel)}`, 'SEND_FAILED');
  }
  // Read again rather than trusting the client: the template may have been paused or changed since the list was shown.
  const template = templates.find(({ id }) => String(id) === String(templateId));
  if (!template) throw new ApolloError('找不到這個範本，可能已被停用或尚未核准，請重新選擇', 'SEND_FAILED');
  const view = templateView(template);

  let headerMedia;
  if (headerMediaUrl) {
    const file = await describeUrl(headerMediaUrl);
    if (!file) throw new ApolloError('找不到標題的檔案，請重新上傳', 'SEND_FAILED');
    const check = connector.checkAttachment({ mime: file.mime_type, size: file.size });
    if (!check.ok) throw new ApolloError(check.reason, 'SEND_FAILED');
    headerMedia = { url: file.url, filename: file.filename, kind: file.kind, mimeType: file.mime_type, file };
  }
  const built = templateMessage(view, values, { to: customerId, headerMedia });
  if (built.error) throw new ApolloError(built.error, 'BAD_USER_INPUT');

  let externalId;
  try {
    externalId = await connector.sendTemplate(target, built.payload);
  } catch (error) {
    throw new ApolloError(connector.failureReason(error, channel), 'SEND_FAILED');
  }
  const body = makeBody({
    text: built.text,
    template: { id: view.id, name: view.name, language: view.language },
    attachments: headerMedia ? [storedAttachment(headerMedia.file)] : [],
  });
  return storeReply(room, accountId, body, externalId);
};

// Marks a reply the platform accepted but later could not deliver.
export const markMessageFailed = async (externalId, reason) => {
  const message = await prisma.message.findUnique({ where: { externalId } });
  if (!message) return null;
  const updated = await prisma.message.update({ where: { id: message.id }, data: { deliveryError: reason }, include: { recipients: true } });
  await publishMessage(updated);
  return updated;
};

/**
 * A message from the platform as it is stored: our own copy of its files, in the unified shape.
 * Files are copied first, since the platform's links expire and some need the channel's token.
 */
const inboundBody = async (contents, channel) => {
  const saved = typeof contents === 'string' ? contents : await storeInboundAttachments(contents, channel);
  return connectorFor(channel).normalize(saved);
};

// Removed channels are left out: their webhooks still arrive until the page or number is disconnected at Meta.
const findChannelByExternalId = async (externalId, where) => {
  const channels = await prisma.companyChannel.findMany({ where: { ...where, deletedAt: null } });
  return channels.find(({ accessInfo }) => accessInfo && [accessInfo.id, accessInfo.page_id, accessInfo.phone_number_id].includes(externalId));
};

const definedFields = (object) => Object.fromEntries(Object.entries(object || {}).filter(([, value]) => value !== undefined && value !== null && value !== ''));

// The conversation's users with the customer's latest profile, or null when nothing changed.
// A lookup that found nothing keeps the name and picture stored before; Meta's picture links expire, so newer ones replace them.
const usersWithCustomer = (users, customer) => {
  if (!customer?.id) return null;
  const stored = Array.isArray(users) ? users : [];
  const current = stored.find(user => user?.id === customer.id);
  const merged = { ...current, ...definedFields(customer) };
  if (current && Object.keys(merged).every(key => merged[key] === current[key])) return null;
  return [merged, ...stored.filter(user => user?.id !== customer.id)];
};

// The platform's conversation id may not have been available earlier, so also match on the customer.
const findCustomerRoom = (channel, chatRoomId, customer) => prisma.chatRoom.findFirst({
  where: { companyId: channel.companyId, channelId: channel.id, OR: [{ chatRoomId }, ...(customer?.id ? [{ users: { array_contains: [{ id: customer.id }] } }] : [])] },
});

// Stores a customer's message from a platform webhook and tells the channel's accounts about it.
export const saveInboundMessage = async ({ externalChannelId, platform, chatRoomId, contents, customer, externalId }) => {
  // A disabled channel takes in nothing; the message stays in the platform's own inbox.
  const channel = await findChannelByExternalId(externalChannelId, { platform, enabled: true });
  if (!channel) return null;
  // The platform retried a message that is already stored; don't download its files again.
  if (externalId && await prisma.message.findUnique({ where: { externalId }, select: { id: true } })) return null;
  const stored = await inboundBody(contents, channel);

  const room = await findCustomerRoom(channel, chatRoomId, customer);
  const users = usersWithCustomer(room?.users, customer);
  const roomId = room?.chatRoomId || room?.id || chatRoomId;
  if (room) await prisma.chatRoom.update({ where: { id: room.id }, data: { updatedAt: new Date(), ...(users ? { users } : {}) } });
  else await prisma.chatRoom.create({ data: { companyId: channel.companyId, platform, channelId: channel.id, chatRoomId, users: users || [] } });

  try {
    const message = await prisma.message.create({
      data: { companyId: channel.companyId, platform, contents: stored, externalId, recipients: { create: [{ channelId: channel.id, chatRoomIds: [roomId] }] } },
      include: { recipients: true },
    });
    await publishMessage(message);
    // Phones are told in the background, so a slow push service doesn't hold up Meta's webhook.
    notifyCustomerMessage(message);
    return message;
  } catch (error) {
    // The platform retried a message that is already stored.
    if (error.code === 'P2002') return null;
    throw error;
  }
};

/**
 * Stores a message the company sent from somewhere other than MasterBox, such as from the phone of a WhatsApp
 * number connected by QR code. It counts as the company's reply, under the account that connected the channel.
 * @param {{ channel, chatRoomId: string, customer?: object, contents: object, externalId: string, sentAt?: string }} message
 * @returns the stored message, or null when it was already stored
 */
export const saveCompanyMessage = async ({ channel, chatRoomId, customer, contents, externalId, sentAt, accountId }) => {
  if (!channel?.enabled) return null;
  if (await prisma.message.findUnique({ where: { externalId }, select: { id: true } })) return null;
  const stored = await inboundBody(contents, channel);
  const room = await findCustomerRoom(channel, chatRoomId, customer);
  const users = usersWithCustomer(room?.users, customer);
  const roomId = room?.chatRoomId || room?.id || chatRoomId;
  if (room) await prisma.chatRoom.update({ where: { id: room.id }, data: { updatedAt: new Date(), ...(users ? { users } : {}) } });
  else await prisma.chatRoom.create({ data: { companyId: channel.companyId, platform: channel.platform, channelId: channel.id, chatRoomId, users: users || [] } });
  try {
    const message = await prisma.message.create({
      data: {
        companyId: channel.companyId, platform: channel.platform, contents: stored, externalId, createdBy: accountId || null,
        ...(sentAt ? { createdAt: new Date(sentAt) } : {}),
        recipients: { create: [{ channelId: channel.id, chatRoomIds: [roomId] }] },
      },
      include: { recipients: true },
    });
    await publishMessage(message);
    return message;
  } catch (error) {
    if (error.code === 'P2002') return null;
    throw error;
  }
};

/**
 * Stores conversations from before the channel was connected. Messages already stored are left alone,
 * so connecting the same channel again only adds what is new.
 * @param conversations [{ chatRoomId, customer, messages: [{ externalId, sentAt, fromCompany, contents }] }]
 * @param accountId who connected the channel; Meta doesn't say which agent sent the company's replies, so they are recorded under this account
 * @returns the number of messages stored
 */
export const saveConversationHistory = async (channel, conversations, accountId) => {
  let stored = 0;
  for (const { chatRoomId, customer, messages } of conversations) {
    if (!messages.length) continue;
    const room = await findCustomerRoom(channel, chatRoomId, customer);
    const users = usersWithCustomer(room?.users, customer);
    const lastAt = new Date(Math.max(...messages.map(({ sentAt }) => new Date(sentAt).getTime())));
    // A conversation keeps its place unless the import has newer messages.
    const updatedAt = room && lastAt > room.updatedAt ? lastAt : room?.updatedAt;
    if (room && (users || updatedAt !== room.updatedAt)) await prisma.chatRoom.update({ where: { id: room.id }, data: { ...(users ? { users } : {}), updatedAt } });
    // A new conversation sorts by its last message, not by when it was imported.
    if (!room) await prisma.chatRoom.create({ data: { companyId: channel.companyId, platform: channel.platform, channelId: channel.id, chatRoomId, users: users || [], createdAt: lastAt, updatedAt: lastAt } });
    const roomId = room?.chatRoomId || room?.id || chatRoomId;

    // Only new messages get their files downloaded; connecting again leaves stored ones alone.
    const known = new Set((await prisma.message.findMany({ where: { externalId: { in: messages.map(({ externalId }) => externalId) } }, select: { externalId: true } })).map(({ externalId }) => externalId));
    const fresh = [];
    for (const message of messages.filter(({ externalId }) => !known.has(externalId))) {
      fresh.push({ ...message, contents: await inboundBody(message.contents, channel) });
    }
    if (!fresh.length) continue;
    const result = await prisma.message.createMany({
      data: fresh.map(({ externalId, sentAt, fromCompany, contents }) => ({
        companyId: channel.companyId, platform: channel.platform, contents, externalId,
        createdAt: new Date(sentAt), createdBy: fromCompany ? accountId : null,
      })),
      skipDuplicates: true,
    });
    if (!result.count) continue;
    stored += result.count;
    // createMany can't add the recipients, so attach them to the messages it just made.
    const created = await prisma.message.findMany({ where: { externalId: { in: messages.map(({ externalId }) => externalId) }, recipients: { none: {} } }, select: { id: true } });
    await prisma.messageRecipient.createMany({ data: created.map(({ id }) => ({ messageId: id, channelId: channel.id, chatRoomIds: [roomId] })) });
  }
  return stored;
};

const channelRecords = ({ facebookPages = [], instagramAccounts = [], whatsappAccounts = [] }) => [
  ...facebookPages.map(({ id, name, access_token }) => ({
    platform: 'fb', source: 'messenger', name: name || id,
    accessInfo: { id, page_id: id, access_token }, info: {},
  })),
  ...instagramAccounts.map(({ id, name, username, page_id, access_token }) => ({
    platform: 'ig', source: 'instagram', name: username || name || id,
    accessInfo: { id, page_id, access_token }, info: {},
  })),
  ...whatsappAccounts.map(({ id, verified_name, display_phone_number, waid, access_token }) => ({
    platform: 'whatsapp', source: 'whatsapp_cloud', name: verified_name || display_phone_number || id,
    accessInfo: { id, phone_number_id: id, whatsapp_business_account_id: waid, access_token },
    info: { display_phone_number },
  })),
];

// Saves the channels from a Meta authorization. Authorizing again refreshes their tokens instead of adding copies,
// and brings back a channel the company removed, with its conversations.
// An external account can only belong to one company, because webhooks find their channel by its external id;
// a channel another company removed doesn't count.
export const saveMetaChannels = async ({ companyId, accountId, ...accounts }) => {
  const records = channelRecords(accounts);
  const existing = await prisma.companyChannel.findMany({ where: { platform: { in: ['fb', 'ig', 'whatsapp'] } } });
  const saved = [], skipped = [];

  await prisma.$transaction(async (tx) => {
    for (const { platform, source, name, accessInfo, info } of records) {
      const owners = existing.filter(channel => channel.platform === platform && channel.accessInfo?.id === accessInfo.id);
      if (owners.some(channel => channel.companyId !== companyId && !channel.deletedAt)) {
        skipped.push(name);
        continue;
      }
      // The company's live channel first, otherwise the one it removed most recently.
      const own = owners
        .filter(channel => channel.companyId === companyId)
        .sort((a, b) => Number(Boolean(a.deletedAt)) - Number(Boolean(b.deletedAt)) || (b.deletedAt?.getTime() || 0) - (a.deletedAt?.getTime() || 0))[0];
      const channel = own
        ? await tx.companyChannel.update({ where: { id: own.id }, data: { name, source, accessInfo, info, ...(own.deletedAt ? { deletedAt: null, enabled: true } : {}) } })
        : await tx.companyChannel.create({ data: { companyId, platform, source, name, accessInfo, info } });
      // Live messages reach the accounts in account_channels, so whoever connected it must be one.
      await tx.accountChannel.createMany({ data: [{ accountId, channelId: channel.id }], skipDuplicates: true });
      saved.push(channel);
    }
  });

  return { saved, skipped };
};

export const findChannelToken = async (channelId, platform) => {
  const channel = await findChannelByExternalId(channelId);
  if (!channel) return null;
  const accessInfo = channel.accessInfo || {};
  const token = accessInfo.access_token || accessInfo.user_access_token || null;
  return platform === 'instagram' || platform === 'whatsapp_business_account'
    ? { channel_id: accessInfo.page_id || accessInfo.id, access_token: token }
    : token;
};
