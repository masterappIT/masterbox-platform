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
  await pubsub.publish(`${SEND_MESSAGE}-${account.id}`, { sendMessage: message });
  return message;
};

export const sortChannelSchema = async () => {
  throw new ApolloError('Webhook channel persistence is disabled; use PostgreSQL channel APIs', 'WEBHOOK_DISABLED');
};

export const findChannelToken = async (channelId, platform) => {
  const channels = await prisma.companyChannel.findMany();
  const channel = channels.find(({ accessInfo }) => accessInfo && (accessInfo.id === channelId || accessInfo.page_id === channelId));
  if (!channel) return null;
  const accessInfo = channel.accessInfo || {};
  const token = accessInfo.access_token || accessInfo.user_access_token || null;
  return platform === 'instagram' || platform === 'whatsapp_business_account'
    ? { channel_id: accessInfo.page_id || accessInfo.id, access_token: token }
    : token;
};
