import { prisma } from '../lib/db/prisma.js';
import { ApolloError } from 'apollo-server-errors';
import { pubsub } from '../config/redis.js';

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

export const handleSendMessage = async (accountId, roomId, contents) => {
  if (!accountId) throw new ApolloError('A PostgreSQL account is required', 'SEND_FAILED');
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new ApolloError('Invalid account', 'SEND_FAILED');
  const room = await prisma.chatRoom.findFirst({
    where: { companyId: account.companyId, OR: [{ id: roomId }, { chatRoomId: roomId }] },
  });
  if (!room) throw new ApolloError('Chat room not found', 'SEND_FAILED');
  const message = await prisma.message.create({
    data: {
      companyId: account.companyId,
      createdBy: account.id,
      platform: room.platform,
      contents,
      recipients: { create: [{ channelId: room.channelId, chatRoomIds: [room.chatRoomId || room.id] }] },
    },
    include: { recipients: true },
  });
  await publishMessage(message);
  return message;
};

const findChannelByExternalId = async (externalId, where) => {
  const channels = await prisma.companyChannel.findMany({ where });
  return channels.find(({ accessInfo }) => accessInfo && [accessInfo.id, accessInfo.page_id, accessInfo.phone_number_id].includes(externalId));
};

// Stores a customer's message from a platform webhook and tells the channel's accounts about it.
export const saveInboundMessage = async ({ externalChannelId, platform, chatRoomId, contents, customer, externalId }) => {
  const channel = await findChannelByExternalId(externalChannelId, { platform });
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

export const sortChannelSchema = async () => {
  throw new ApolloError('Webhook channel persistence is disabled; use PostgreSQL channel APIs', 'WEBHOOK_DISABLED');
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
