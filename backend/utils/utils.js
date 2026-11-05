import { prisma } from '../lib/db/prisma.js';
import { ApolloError } from 'apollo-server-errors';
import { pubsub } from '../config/redis.js';
import { sendFacebookMessage } from '../controller/meta_facebook.js';
import { sendWhatsappMessage, whatsappMessageId } from '../controller/meta_whatsapp.js';

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

// The reply text from plain text, a JSON message (`text`), or a Meta payload (`message.text`).
const replyTextOf = (contents) => {
  let parsed;
  try { parsed = JSON.parse(contents); } catch { return contents; }
  if (!parsed || typeof parsed !== 'object') return contents;
  return parsed.text ?? parsed.message?.text ?? parsed.message?.body;
};

// Turns Meta's error (from a send response or a status webhook) into something an agent can act on.
export const metaFailureReason = (error) => {
  if (error?.code === 190) return '頻道授權已失效，請到頻道管理重新串接';
  if (error?.code === 131047 || error?.error_subcode === 2018278) return '已超過 24 小時回覆期限，Meta 不允許傳送這則訊息';
  return `Meta 無法送出這則訊息：${error?.message || error?.title || '未知錯誤'}`;
};

const sendFailed = (error) => {
  let body = error.responseBody;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = undefined; } }
  console.log('Meta send failed:', body?.error || error.message);
  return new ApolloError(metaFailureReason(body?.error || { message: error.message }), 'SEND_FAILED');
};

// Sends the reply to the customer and returns the platform's message id. Throws when it wasn't sent.
const deliverReply = async (room, contents) => {
  if (!['fb', 'ig', 'whatsapp'].includes(room.platform)) throw new ApolloError(`尚未支援回覆 ${room.platform} 訊息`, 'SEND_FAILED');
  const text = replyTextOf(contents);
  if (typeof text !== 'string' || !text.trim()) throw new ApolloError('訊息內容不可空白', 'SEND_FAILED');

  const channel = await prisma.companyChannel.findUnique({ where: { id: room.channelId } });
  const { access_token: token, page_id: pageId, phone_number_id: phoneNumberId } = channel?.accessInfo || {};
  if (channel && !channel.enabled) throw new ApolloError('此頻道已停用，請到社群平台管理啟用後再回覆', 'SEND_FAILED');
  if (!token) throw new ApolloError('此頻道尚未完成 Meta 串接，無法送出訊息', 'SEND_FAILED');

  // The recipient comes from the stored conversation rather than the client.
  const customerId = (Array.isArray(room.users) ? room.users[0]?.id : null) || (room.platform === 'whatsapp' ? room.chatRoomId : null);
  if (!customerId) throw new ApolloError('找不到這段對話的客戶，無法送出訊息', 'SEND_FAILED');

  try {
    if (room.platform === 'whatsapp') {
      const result = await sendWhatsappMessage({ messaging_product: 'whatsapp', recipient_type: 'individual', to: customerId, type: 'text', text: { body: text } }, phoneNumberId, token);
      return whatsappMessageId(result.messages[0].id);
    }
    const result = await sendFacebookMessage(pageId, { recipient: { id: customerId }, messaging_type: 'RESPONSE', message: { text } }, token);
    return result.message_id;
  } catch (error) {
    throw sendFailed(error);
  }
};

export const handleSendMessage = async (accountId, roomId, contents, channelId) => {
  if (!accountId) throw new ApolloError('A PostgreSQL account is required', 'SEND_FAILED');
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new ApolloError('Invalid account', 'SEND_FAILED');
  const room = await prisma.chatRoom.findFirst({
    where: { companyId: account.companyId, ...(channelId ? { channelId } : {}), OR: [{ id: roomId }, { chatRoomId: roomId }] },
  });
  if (!room) throw new ApolloError('Chat room not found', 'SEND_FAILED');
  // Only a reply Meta accepted is stored, so nothing here can look sent when it wasn't.
  const externalId = await deliverReply(room, contents);
  const message = await prisma.message.create({
    data: {
      companyId: account.companyId,
      createdBy: account.id,
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

// Stores a customer's message from a platform webhook and tells the channel's accounts about it.
export const saveInboundMessage = async ({ externalChannelId, platform, chatRoomId, contents, customer, externalId }) => {
  // A disabled channel takes in nothing; the message stays in the platform's own inbox.
  const channel = await findChannelByExternalId(externalChannelId, { platform, enabled: true });
  if (!channel) return null;

  // The platform's conversation id may not have been available earlier, so also match on the customer.
  const room = await prisma.chatRoom.findFirst({
    where: { companyId: channel.companyId, channelId: channel.id, OR: [{ chatRoomId }, ...(customer ? [{ users: { array_contains: [{ id: customer.id }] } }] : [])] },
  });
  const users = customer ? [customer] : [];
  const roomId = room?.chatRoomId || room?.id || chatRoomId;
  if (room) await prisma.chatRoom.update({ where: { id: room.id }, data: { updatedAt: new Date(), ...(customer && !room.users?.length ? { users } : {}) } });
  else await prisma.chatRoom.create({ data: { companyId: channel.companyId, platform, channelId: channel.id, chatRoomId, users } });

  try {
    const message = await prisma.message.create({
      data: { companyId: channel.companyId, platform, contents, externalId, recipients: { create: [{ channelId: channel.id, chatRoomIds: [roomId] }] } },
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
