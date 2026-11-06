import { prisma } from '../lib/db/prisma.js';
import { ApolloError } from 'apollo-server-errors';
import { pubsub } from '../config/redis.js';
import { sendFacebookMessage } from '../controller/meta_facebook.js';
import { sendWhatsappMessage, whatsappMessageId } from '../controller/meta_whatsapp.js';
import { replyContentsOf, replyParts, metaPayload, partContents, storedAttachment } from '../lib/messaging/outbound.js';
import { checkAttachment } from '../lib/storage/attachmentRules.js';
import { describeUrl } from '../lib/storage/index.js';
import { storeInboundAttachments } from '../lib/messaging/inbound.js';

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

const textOf = value => typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
const recipientRooms = message => (message.recipients || []).flatMap(r => r.chatRoomIds || []);
export const messageView = (message, requestedRoom) => {
  const text = textOf(message.contents);
  const rooms = recipientRooms(message);
  return {
    id: message.id || message._id?.toString(), _id: message.id || message._id?.toString(),
    platform: message.platform, contents: text, text, recipients: rooms,
    to_chat_room_id: requestedRoom || rooms[0] || null,
    channel_id: message.recipients?.[0]?.channelId || message.channel_id || null,
    encryption_mode: message.encryptionMode || message.encryption_mode || 'server', disappearing_after_seconds: message.disappearingAfterSeconds || null, expiresAt: message.expiresAt || null, readAt: message.readAt || null, sentAt: message.createdAt || message.created_at || null,
    isMine: undefined,
    inbound: !message.createdBy,
    delivery_error: message.deliveryError || null,
  };
};

// Everyone assigned to the channel follows its conversations, not just whoever sent the message.
export const publishMessage = async (message) => {
  const channelId = message.recipients?.[0]?.channelId;
  if (!channelId) return;
  const accounts = await prisma.accountChannel.findMany({ where: { channelId }, select: { accountId: true } });
  const view = messageView(message);
  await Promise.all(accounts.map(({ accountId }) => pubsub.publish(`${SEND_MESSAGE}-${accountId}`, { sendMessage: view })));
};

const sendFailed = (error) => {
  let body = error.responseBody;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = undefined; } }
  console.log('Meta send failed:', body?.error || error.message);
  return metaFailureReason(body?.error || { message: error.message });
};

// Turns Meta's error (from a send response or a status webhook) into something an agent can act on.
export const metaFailureReason = (error) => {
  if (error?.code === 190) return '頻道授權已失效，請到頻道管理重新串接';
  if (error?.code === 131047 || error?.error_subcode === 2018278) return '已超過 24 小時回覆期限，Meta 不允許傳送這則訊息';
  return `Meta 無法送出這則訊息：${error?.message || error?.title || '未知錯誤'}`;
};

// The file an agent attached, checked against storage and the platform's limits.
const replyAttachment = async (platform, attachments) => {
  if (!attachments.length) return {};
  if (attachments.length > 1) throw new ApolloError('一次只能傳送一個附件', 'SEND_FAILED');
  const file = await describeUrl(attachments[0]?.payload?.url);
  if (!file) throw new ApolloError('找不到這個附件，請重新選擇檔案', 'SEND_FAILED');
  const check = checkAttachment(platform, { mime: file.mime_type, size: file.size });
  if (!check.ok) throw new ApolloError(check.reason, 'SEND_FAILED');
  return { attachment: storedAttachment(file), sendType: check.sendType };
};

/**
 * Works out how a reply goes to the customer, before anything is sent.
 * @returns {{ parts, send }} parts in the order they are sent; send(part) returns the platform's message id or throws
 */
const prepareReply = async (room, contents) => {
  if (!['fb', 'ig', 'whatsapp'].includes(room.platform)) throw new ApolloError(`尚未支援回覆 ${room.platform} 訊息`, 'SEND_FAILED');
  const { text, attachments } = replyContentsOf(contents);
  const { attachment, sendType } = await replyAttachment(room.platform, attachments);
  const parts = replyParts(room.platform, { text, attachment, sendType });
  if (!parts.length) throw new ApolloError('訊息內容不可空白', 'SEND_FAILED');

  const channel = await prisma.companyChannel.findUnique({ where: { id: room.channelId } });
  const { access_token: token, page_id: pageId, phone_number_id: phoneNumberId } = channel?.accessInfo || {};
  if (channel && !channel.enabled) throw new ApolloError('此頻道已停用，請到社群平台管理啟用後再回覆', 'SEND_FAILED');
  if (!token) throw new ApolloError('此頻道尚未完成 Meta 串接，無法送出訊息', 'SEND_FAILED');

  // The recipient comes from the stored conversation rather than the client.
  const customerId = (Array.isArray(room.users) ? room.users[0]?.id : null) || (room.platform === 'whatsapp' ? room.chatRoomId : null);
  if (!customerId) throw new ApolloError('找不到這段對話的客戶，無法送出訊息', 'SEND_FAILED');

  const send = async (part) => {
    const payload = metaPayload(room.platform, customerId, part);
    if (room.platform === 'whatsapp') {
      const result = await sendWhatsappMessage(payload, phoneNumberId, token);
      return whatsappMessageId(result.messages[0].id);
    }
    const result = await sendFacebookMessage(pageId, payload, token);
    return result.message_id;
  };
  return { parts, send };
};

/**
 * Sends an agent's reply. Only what Meta accepted is stored, so nothing here can look sent when it wasn't.
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
  const { parts, send } = await prepareReply(room, contents);

  let message = null;
  for (const part of parts) {
    let externalId;
    try {
      externalId = await send(part);
    } catch (error) {
      const reason = sendFailed(error);
      if (!message) throw new ApolloError(reason, 'SEND_FAILED');
      throw new ApolloError(`附件已送出，但文字沒有送出：${reason}`, 'SEND_FAILED', { sentAttachment: true });
    }
    message = await prisma.message.create({
      data: {
        companyId: account.companyId,
        createdBy: account.id,
        platform: room.platform,
        contents: partContents(contents, part),
        externalId,
        recipients: { create: [{ channelId: room.channelId, chatRoomIds: [room.chatRoomId || room.id] }] },
      },
      include: { recipients: true },
    });
    await prisma.chatRoom.update({ where: { id: room.id }, data: { updatedAt: new Date() } });
    await publishMessage(message);
  }
  return message;
};

// Marks a reply the platform accepted but later could not deliver.
export const markMessageFailed = async (externalId, reason) => {
  const message = await prisma.message.findUnique({ where: { externalId } });
  if (!message) return null;
  const updated = await prisma.message.update({ where: { id: message.id }, data: { deliveryError: reason }, include: { recipients: true } });
  await publishMessage(updated);
  return updated;
};

const findChannelByExternalId = async (externalId, where) => {
  const channels = await prisma.companyChannel.findMany({ where });
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
  const stored = typeof contents === 'string' ? contents : JSON.stringify(await storeInboundAttachments(contents, channel));

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
    return message;
  } catch (error) {
    // The platform retried a message that is already stored.
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
    if (room && users) await prisma.chatRoom.update({ where: { id: room.id }, data: { users, updatedAt: room.updatedAt } });
    // A new conversation sorts by its last message, not by when it was imported.
    if (!room) await prisma.chatRoom.create({ data: { companyId: channel.companyId, platform: channel.platform, channelId: channel.id, chatRoomId, users: users || [], createdAt: lastAt, updatedAt: lastAt } });
    const roomId = room?.chatRoomId || room?.id || chatRoomId;

    // Only new messages get their files downloaded; connecting again leaves stored ones alone.
    const known = new Set((await prisma.message.findMany({ where: { externalId: { in: messages.map(({ externalId }) => externalId) } }, select: { externalId: true } })).map(({ externalId }) => externalId));
    const fresh = [];
    for (const message of messages.filter(({ externalId }) => !known.has(externalId))) {
      fresh.push({ ...message, contents: await storeInboundAttachments(message.contents, channel) });
    }
    if (!fresh.length) continue;
    const result = await prisma.message.createMany({
      data: fresh.map(({ externalId, sentAt, fromCompany, contents }) => ({
        companyId: channel.companyId, platform: channel.platform, contents: JSON.stringify(contents), externalId,
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
    platform: 'fb', name: name || id,
    accessInfo: { id, page_id: id, access_token }, info: {},
  })),
  ...instagramAccounts.map(({ id, name, username, page_id, access_token }) => ({
    platform: 'ig', name: username || name || id,
    accessInfo: { id, page_id, access_token }, info: {},
  })),
  ...whatsappAccounts.map(({ id, verified_name, display_phone_number, waid, access_token }) => ({
    platform: 'whatsapp', name: verified_name || display_phone_number || id,
    accessInfo: { id, phone_number_id: id, whatsapp_business_account_id: waid, access_token },
    info: { display_phone_number },
  })),
];

// Saves the channels from a Meta authorization. Authorizing again refreshes their tokens instead of adding copies.
// An external account can only belong to one company, because webhooks find their channel by its external id.
export const sortChannelSchema = async ({ companyId, accountId, ...accounts }) => {
  const records = channelRecords(accounts);
  const existing = await prisma.companyChannel.findMany({ where: { platform: { in: ['fb', 'ig', 'whatsapp'] } } });
  const saved = [], skipped = [];

  await prisma.$transaction(async (tx) => {
    for (const { platform, name, accessInfo, info } of records) {
      const owners = existing.filter(channel => channel.platform === platform && channel.accessInfo?.id === accessInfo.id);
      if (owners.some(channel => channel.companyId !== companyId)) {
        skipped.push(name);
        continue;
      }
      const channel = owners[0]
        ? await tx.companyChannel.update({ where: { id: owners[0].id }, data: { name, accessInfo, info } })
        : await tx.companyChannel.create({ data: { companyId, platform, name, accessInfo, info } });
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
