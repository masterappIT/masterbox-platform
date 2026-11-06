// Which phones hear about a customer's message, and what the notification says.
import { ApolloError } from 'apollo-server-errors';
import { prisma } from '../db/prisma.js';
import { channelAccountIds } from '../messaging/access.js';
import { countUnreadRooms } from '../messaging/conversations.js';
import { apnsSender } from './apns.js';
import { notificationRecipients, notificationFor } from './notificationContent.js';

export { notificationRecipients, notificationFor };

// Android has no push yet. The platform is stored so adding it needs no new table.
export const DEVICE_PLATFORMS = ['ios'];
// APNs tokens are hex, 32 bytes today, though Apple says not to count on the length. They go into the request path.
const DEVICE_TOKEN = /^[0-9a-f]{32,200}$/;

let configError;

/** Whether this server can send push notifications. A broken setup is logged once and treated as not set up. */
export const pushConfigured = () => {
  try {
    return Boolean(apnsSender());
  } catch (error) {
    if (!configError) {
      configError = error;
      console.error('Push notifications are off:', error.message);
    }
    return false;
  }
};

const cleanToken = (token) => {
  const value = typeof token === 'string' ? token.trim().toLowerCase() : '';
  if (!DEVICE_TOKEN.test(value)) throw new ApolloError('裝置推播代碼無效', 'BAD_USER_INPUT');
  return value;
};

/** Notifications for the account's customers go to this phone, and no longer to whoever used it before. */
export const registerDevice = async (account, { token, platform }) => {
  const value = cleanToken(token);
  if (!DEVICE_PLATFORMS.includes(platform)) throw new ApolloError('目前只支援 iOS 推播', 'BAD_USER_INPUT');
  await prisma.deviceToken.upsert({
    where: { token: value },
    update: { accountId: account.account_id, companyId: account.company_id, platform },
    create: { token: value, accountId: account.account_id, companyId: account.company_id, platform },
  });
};

/** The phone stops getting the account's notifications, as when signing out or turning them off. */
export const unregisterDevice = async (account, { token }) => {
  await prisma.deviceToken.deleteMany({ where: { token: cleanToken(token), accountId: account.account_id } });
};

/** The conversation a customer's message belongs to, in the channel it came through. */
const findMessageRoom = (companyId, channelId, roomKey) => prisma.chatRoom.findFirst({
  where: { companyId, channelId, OR: [{ chatRoomId: roomKey }, { id: roomKey }] },
  include: { channel: { select: { name: true } } },
});

/**
 * Whether a customer's message in the conversation is for this account right now, by the same rule as its
 * notifications, so an open app tells the same people a closed one does. A conversation not stored yet has no agent.
 * @param {{ accountIdsFor?: typeof channelAccountIds }} [deps] - for tests
 */
export const messageNotifiesAccount = async (account, { chatRoomId, channelId }, { accountIdsFor = channelAccountIds } = {}) => {
  const room = await findMessageRoom(account.company_id, channelId, chatRoomId);
  return notificationRecipients(room ?? {}, await accountIdsFor(account.company_id, channelId)).includes(account.account_id);
};

/**
 * The number on the app icon for each account: its conversations with unread messages, this one included.
 * An account whose count can't be worked out gets none, so its icon keeps what it showed.
 */
const unreadBadges = async (companyId, accountIds, unreadFor) => new Map((await Promise.all(accountIds.map(async (accountId) => {
  try {
    return [accountId, await unreadFor({ account_id: accountId, company_id: companyId })];
  } catch {
    return null;
  }
}))).filter(Boolean));

/**
 * Tells the phones of the accounts that work in the conversation about a customer's message.
 * Never throws: a notification that can't go out mustn't lose the message.
 * @param message - the stored message, with its recipients
 * @param {{ sender?: { send }, accountIdsFor?: typeof channelAccountIds, unreadFor?: typeof countUnreadRooms }} [deps] - for tests
 */
export const notifyCustomerMessage = async (message, { sender, accountIdsFor = channelAccountIds, unreadFor = countUnreadRooms } = {}) => {
  try {
    const push = sender ?? (pushConfigured() ? apnsSender() : null);
    const recipient = message?.recipients?.[0];
    const roomKey = recipient?.chatRoomIds?.[0];
    if (!push || message?.createdBy || !roomKey || !recipient.channelId) return 0;
    const room = await findMessageRoom(message.companyId, recipient.channelId, roomKey);
    if (!room) return 0;
    const accountIds = notificationRecipients(room, await accountIdsFor(room.companyId, room.channelId));
    if (!accountIds.length) return 0;
    // The company is checked again so a token can't carry another company's customers.
    const devices = await prisma.deviceToken.findMany({ where: { accountId: { in: accountIds }, companyId: room.companyId, platform: 'ios' } });
    if (!devices.length) return 0;
    const payload = notificationFor({ room, channelName: room.channel?.name, message });
    const badges = await unreadBadges(room.companyId, [...new Set(devices.map(({ accountId }) => accountId))], unreadFor);
    const results = await Promise.all(devices.map(async (device) => {
      const badge = badges.get(device.accountId);
      const notification = badge === undefined ? payload : { ...payload, aps: { ...payload.aps, badge } };
      try {
        return { device, result: await push.send(device.token, notification) };
      } catch (error) {
        return { device, result: { ok: false, unregistered: false, reason: error.message } };
      }
    }));
    const gone = results.filter(({ result }) => result.unregistered).map(({ device }) => device.token);
    if (gone.length) await prisma.deviceToken.deleteMany({ where: { token: { in: gone } } });
    const failed = results.filter(({ result }) => !result.ok && !result.unregistered);
    if (failed.length) console.error(`Push not delivered to ${failed.length} device(s):`, failed[0].result.reason);
    return results.filter(({ result }) => result.ok).length;
  } catch (error) {
    console.error('Push notification failed:', error.message);
    return 0;
  }
};
