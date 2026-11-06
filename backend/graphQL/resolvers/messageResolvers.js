import { ApolloError } from 'apollo-server-errors';
import { prisma } from '../../lib/db/prisma.js';
import { pubsub } from '../../config/redis.js';
import { handleSendMessage, messageView, publishMessage, SEND_MESSAGE, listWhatsappTemplates, sendWhatsappTemplate } from '../../utils/utils.js';
import { withAuth, requireAdmin } from '../../middleware/auth.js';
import { findAccountRoom, roomViews, listRooms, listMessages, markRoomRead, companyTags, addRoomTag, removeRoomTag } from '../../lib/messaging/conversations.js';

const channelView = channel => ({ channel_id: channel.id, platform: channel.platform, name: channel.name, enabled: channel.enabled });

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

// The signed-in account, for the conversation list and everything in it.
const signedIn = ({ account, isAuth }) => {
  withAuth(Boolean(isAuth || account));
  if (!account?.company_id || !account?.account_id) throw new ApolloError('Invalid account', 'UNAUTHENTICATED');
  return account;
};

const oneRoomView = async (account, room) => (await roomViews(account, [room.id]))[0];

// Whoever replies has read the conversation. A failure here mustn't make a sent message look unsent.
const markReadAfterSending = async (account, message) => {
  const roomKey = message?.recipients?.[0]?.chatRoomIds?.[0];
  const channelId = message?.recipients?.[0]?.channelId;
  if (!roomKey || !channelId) return;
  try {
    const room = await prisma.chatRoom.findFirst({ where: { companyId: account.company_id, channelId, OR: [{ chatRoomId: roomKey }, { id: roomKey }] } });
    if (room) await markRoomRead(account, room);
  } catch (error) {
    console.log('Read position not saved after sending:', error.message);
  }
};

const visibleMessageWhere = (companyId, target) => ({
  companyId,
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  ...(target ? { recipients: { some: { chatRoomIds: { has: target } } } } : {}),
});
export default {
  Mutation: {
    async setChannelEnabled(_, { channel_id, enabled }, context) {
      const admin = requireAdmin(context);
      const channel = await prisma.companyChannel.findUnique({ where: { id: channel_id } });
      if (!channel || channel.companyId !== admin.company_id) throw new ApolloError('找不到這個頻道', 'NOT_FOUND');
      return channelView(await prisma.companyChannel.update({ where: { id: channel_id }, data: { enabled } }));
    },
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
          await prisma.chatRoom.update({ where: { id: room.id }, data: { updatedAt: new Date() } });
          await publishMessage(message);
          await markReadAfterSending(account, message);
          return messageView(message, room.chatRoomId || room.id, accountId);
        }
        const message = await handleSendMessage(account.account_id, roomId, input.contents, input.channel_id);
        await markReadAfterSending(account, message);
        return messageView(message, roomId, accountId);
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
      return messageView(updated, undefined, account.account_id);
    },
    async markChatRoomRead(_, { id, messageId }, context) {
      const account = signedIn(context);
      const room = await findAccountRoom(account, { id });
      await markRoomRead(account, room, messageId);
      return oneRoomView(account, room);
    },
    async addChatRoomTag(_, { id, name }, context) {
      const account = signedIn(context);
      const room = await findAccountRoom(account, { id });
      await addRoomTag(account, room, name);
      return oneRoomView(account, room);
    },
    async removeChatRoomTag(_, { id, tagId }, context) {
      const account = signedIn(context);
      const room = await findAccountRoom(account, { id });
      await removeRoomTag(account, room, tagId);
      return oneRoomView(account, room);
    },
    async sendWhatsappTemplate(_, { id, templateId, values, header_media_url }, context) {
      const account = signedIn(context);
      const room = await findAccountRoom(account, { id });
      const message = await sendWhatsappTemplate(account.account_id, room, { templateId, values: values || [], headerMediaUrl: header_media_url });
      await markReadAfterSending(account, message);
      return messageView(message, room.chatRoomId || room.id, account.account_id);
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
      return channels.map(channelView);
    },
    async chatRooms(_, __, { account, isAuth }) {
      withAuth(Boolean(isAuth || account));
      if (!account?.company_id) return [];
      const rooms = await prisma.chatRoom.findMany({ where: { companyId: account.company_id }, orderBy: { updatedAt: 'desc' }, select: { id: true } });
      // Older clients read the platform id as the title.
      return (await roomViews(account, rooms.map(({ id }) => id))).map(room => ({ ...room, title: room.chat_room_id }));
    },
    async chatRoomPage(_, { first, after, filter }, context) {
      return listRooms(signedIn(context), { first, after, filter: filter || {} });
    },
    async chatRoom(_, { id, chat_room_id, channel_id }, context) {
      const account = signedIn(context);
      try {
        return await oneRoomView(account, await findAccountRoom(account, { id, chatRoomId: chat_room_id, channelId: channel_id }));
      } catch (error) {
        if (error.extensions?.code === 'NOT_FOUND') return null;
        throw error;
      }
    },
    async messagePage(_, { id, first, before, after }, context) {
      const account = signedIn(context);
      const room = await findAccountRoom(account, { id });
      const page = await listMessages(account, room, { first, before, after });
      return { ...page, messages: page.messages.map(message => messageView(message, room.chatRoomId || room.id, account.account_id)) };
    },
    async customerTags(_, __, context) {
      return companyTags(signedIn(context));
    },
    async whatsappTemplates(_, { id }, context) {
      const account = signedIn(context);
      return listWhatsappTemplates(await findAccountRoom(account, { id }));
    },
    async messages(_, { conversationId, roomId }, { account, isAuth }) {
      withAuth(Boolean(isAuth || account));
      if (!account?.company_id) return [];
      const target = conversationId || roomId;
      const messages = await prisma.message.findMany({ where: visibleMessageWhere(account.company_id, target), include: { recipients: true }, orderBy: { createdAt: 'asc' } });
      return messages.map(message => messageView(message, target, account.account_id));
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
