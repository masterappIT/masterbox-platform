// Who hears about a customer's message and what the notification says. Kept apart from the database code so it
// can be checked on its own.
import { customerOf, messagePreview } from '../messaging/conversationText.js';

const TITLE_MAX = 100;
const BODY_MAX = 180;

/**
 * Who hears about a customer's message: the conversation's agent when it has one who still works in the channel,
 * otherwise everyone who works in the channel. Both lists only hold enabled accounts of the company.
 * @param {string[]} channelAccounts - from channelAccountIds
 */
export const notificationRecipients = (room, channelAccounts) => (
  room.assigneeId && channelAccounts.includes(room.assigneeId) ? [room.assigneeId] : channelAccounts
);

const shorten = (text, max) => ([...text].length > max ? `${[...text].slice(0, max - 1).join('')}…` : text);

/**
 * The APNs payload for a customer's message in a conversation. Tapping it opens the conversation by `roomId`,
 * and the phone groups the notifications of one conversation. Well under APNs' 4KB limit, even with the longest text.
 */
export const notificationFor = ({ room, channelName, message }) => {
  const customer = customerOf(room)?.name || '客戶';
  const title = shorten(channelName ? `${customer} · ${channelName}` : customer, TITLE_MAX);
  const body = shorten(messagePreview(message.contents, message.encryptionMode) || '傳來一則訊息', BODY_MAX);
  return {
    aps: { alert: { title, body }, sound: 'default', 'thread-id': room.id },
    type: 'message',
    roomId: room.id,
    chatRoomId: room.chatRoomId || room.id,
    channelId: room.channelId,
    platform: String(room.platform || ''),
    messageId: String(message.id || ''),
  };
};
