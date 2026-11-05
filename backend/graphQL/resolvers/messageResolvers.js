import { ApolloError } from 'apollo-server-errors';
import { prisma } from '../../lib/db/prisma.js';
import { pubsub } from '../../config/redis.js';
import { handleSendMessage, messageView, publishMessage, SEND_MESSAGE } from '../../utils/utils.js';
import { withAuth } from '../../middleware/auth.js';

const validateEncryption = (mode, contents, errorCode = 'SEND_FAILED') => {
  if (!['server', 'e2ee'].includes(mode)) throw new ApolloError('encryption_mode must be server or e2ee', errorCode);
  if (mode !== 'e2ee') return;
  if (typeof contents !== 'string' || !contents.trim()) throw new ApolloError('e2ee messages require serialized ciphertext', errorCode);
  let metadata;
  try { metadata = JSON.parse(contents); } catch { throw new ApolloError('e2ee contents must be valid JSON ciphertext metadata', errorCode); }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || typeof metadata.ciphertext !== 'string' || !metadata.ciphertext.trim() || typeof metadata.nonce !== 'string' || !metadata.nonce.trim()) {
    throw new ApolloError('e2ee contents require ciphertext and nonce metadata', errorCode);
  }
};

const validateDisappearing = (seconds, errorCode = 'SEND_FAILED') => {
  if (seconds != null && (!Number.isInteger(seconds) || seconds < 1 || seconds > 2592000)) {
    throw new ApolloError('disappearing_after_seconds must be between 1 and 2592000', errorCode);
  }
};

const visibleMessageWhere = (companyId, target) => ({
  companyId,
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  ...(target ? { recipients: { some: { chatRoomIds: { has: target } } } } : {}),
});
export default {
  Mutation: {
    async appSendMessage(_, { MessageInput: input }, { account, isAuth }) {
      withAuth(Boolean(isAuth || account));
      const accountId = account?.account_id;
      if (!accountId) throw new ApolloError('Invalid account', 'SEND_FAILED');
      const accountRecord = await prisma.account.findUnique({ where: { id: accountId } });
      const companyId = accountRecord?.companyId;
      if (!companyId) throw new ApolloError('Invalid account', 'SEND_FAILED');
      const roomId = input.to_chat_room_id;
      try {
        const encryptionMode = input.encryption_mode || 'server';
        const disappearingAfterSeconds = input.disappearing_after_seconds;
        validateEncryption(encryptionMode, input.contents);
        validateDisappearing(disappearingAfterSeconds);
        if (encryptionMode === 'e2ee' && typeof input.contents !== 'string') throw new ApolloError('e2ee messages require serialized ciphertext', 'SEND_FAILED');
        // The app client uses the Prisma-backed account/company data and may not have a channel id.
        if ((input.platform || '').toLowerCase() === 'app') {
          const room = await prisma.chatRoom.findFirst({ where: { companyId, OR: [{ id: roomId }, { chatRoomId: roomId }] } });
          if (!room) throw new ApolloError('Chat room not found', 'SEND_FAILED');
          const message = await prisma.message.create({
            data: { companyId, createdBy: accountId, platform: room.platform,
              contents: input.contents, encryptionMode, disappearingAfterSeconds, expiresAt: null, recipients: { create: [{ channelId: room.channelId, chatRoomIds: [room.chatRoomId || room.id] }] } },
            include: { recipients: true },
          });
          await publishMessage(message);
          return messageView(message, room.chatRoomId || room.id);
        }
        const message = await handleSendMessage(account.account_id, roomId, input.contents, input.platform, input.info_Content, input.channel_id);
        return messageView(message, roomId);
      } catch (error) {
        if (error instanceof ApolloError) throw error;
        throw new ApolloError(error.message || 'setMessage failed', 'SEND_FAILED');
      }
    },
    async markMessageRead(_, { messageId }, { account, isAuth }) {
      withAuth(Boolean(isAuth || account));
      if (!account?.company_id) throw new ApolloError('Invalid account', 'READ_FAILED');
      const message = await prisma.message.findFirst({ where: { id: messageId, companyId: account.company_id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, include: { recipients: true } });
      if (!message) throw new ApolloError('Message not found', 'READ_FAILED');
      const readAt = new Date();
      const updated = await prisma.message.update({ where: { id: message.id }, data: { readAt: message.readAt || readAt, expiresAt: message.readAt || !message.disappearingAfterSeconds ? message.expiresAt : new Date(readAt.getTime() + message.disappearingAfterSeconds * 1000) }, include: { recipients: true } });
      await publishMessage(updated);
      return messageView(updated);
    },
  },
  Query: {
    Message: () => null,
    async getUserSubscribedChannels(_, __, { account, isAuth }) {
      withAuth(Boolean(isAuth || account));
      if (!account?.company_id) return [];
      // account_channels has no company check of its own, so scope by the company as well.
      const channels = await prisma.companyChannel.findMany({
        where: { companyId: account.company_id, accounts: { some: { accountId: account.account_id } } },
        orderBy: { name: 'asc' },
      });
      return channels.map(channel => ({ channel_id: channel.id, platform: channel.platform, name: channel.name }));
    },
    async chatRooms(_, __, { account, isAuth }) {
      withAuth(Boolean(isAuth || account));
      if (!account?.company_id) return [];
      const rooms = await prisma.chatRoom.findMany({ where: { companyId: account.company_id }, orderBy: { updatedAt: 'desc' } });
      return rooms.map(room => ({ id: room.id, title: room.chatRoomId || room.id, platform: room.platform, channel_id: room.channelId, chat_room_id: room.chatRoomId || room.id, users: Array.isArray(room.users) ? room.users : [], updatedAt: room.updatedAt }));
    },
    async messages(_, { conversationId, roomId }, { account, isAuth }) {
      withAuth(Boolean(isAuth || account));
      if (!account?.company_id) return [];
      const target = conversationId || roomId;
      const messages = await prisma.message.findMany({ where: visibleMessageWhere(account.company_id, target), include: { recipients: true }, orderBy: { createdAt: 'asc' } });
      return messages.map(message => messageView(message, target));
    },
  },
  Subscription: {
    sendMessage: {
      subscribe: (_, __, { account, isAuth }) => {
        withAuth(Boolean(isAuth || account));
        return pubsub.asyncIterator(`${SEND_MESSAGE}-${account.account_id}`);
      },
    },
  },
};
