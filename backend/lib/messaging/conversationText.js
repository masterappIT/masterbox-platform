// What the conversation list shows and how it pages. No database here, so it is easy to test.
import { readBody, isBody } from './messageBody.js';

// The same words the admin uses for attachments in a conversation.
export const ATTACHMENT_LABELS = {
  image: '圖片',
  video: '影片',
  audio: '語音訊息',
  file: '檔案',
  document: '文件',
  sticker: '貼圖',
  location: '位置',
  contacts: '聯絡人',
  order: '訂單',
  reaction: '表情回應',
  share: '分享',
  story_mention: '限時動態提及',
  ig_reel: 'Reels',
  reel: 'Reels',
};

/**
 * One line for the conversation list: the text, or a label such as [圖片] for an attachment.
 * @param contents - a message's stored contents, in any shape readBody reads
 * @param {string} [encryptionMode] - e2ee messages can only be read on the devices that hold the key
 */
export const messagePreview = (contents, encryptionMode) => {
  if (encryptionMode === 'e2ee') return '[加密訊息]';
  // Plain text, typed by an agent or sent by an older app, shows as it is.
  if (typeof contents === 'string' && !isBody(contents) && !/^\s*\{/.test(contents)) return contents.trim();
  const { text, attachments } = readBody(contents);
  const words = (text || '').trim();
  if (!attachments.length) return words || '[不支援的訊息類型]';
  const first = attachments[0];
  const label = `[${ATTACHMENT_LABELS[first.type] || '附件'}]`;
  const caption = words || (first.caption || '').trim();
  return caption ? `${label} ${caption}` : label;
};

/** An opaque position in a list ordered by a time and then an id. */
export const encodeCursor = (time, id) => Buffer.from(`${new Date(time).toISOString()}|${id}`, 'utf8').toString('base64url');

/** @returns {{ time: Date, id: string } | null} null when the cursor wasn't made by encodeCursor */
export const decodeCursor = (cursor) => {
  if (typeof cursor !== 'string' || !cursor) return null;
  const [iso, ...rest] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const id = rest.join('|');
  const time = new Date(iso);
  if (!id || Number.isNaN(time.getTime()) || time.toISOString() !== iso) return null;
  return { time, id };
};

/** A page size between 1 and max, so a client can't ask for everything at once. */
export const pageSize = (first, fallback = 30, max = 100) => {
  const size = Number.isInteger(first) ? first : fallback;
  return Math.min(Math.max(size, 1), max);
};

/** A LIKE pattern that matches the words as typed, with % and _ taken literally. Null for an empty search. */
export const searchPattern = (search) => {
  const words = typeof search === 'string' ? search.trim().slice(0, 100) : '';
  if (!words) return null;
  return `%${words.replace(/[\\%_]/g, char => `\\${char}`)}%`;
};

/** The customer of a conversation: whoever in its users isn't the channel itself. */
export const customerOf = (room) => {
  const users = Array.isArray(room?.users) ? room.users : [];
  const customer = users.find(user => user && user.id && user.id !== room.channelId);
  if (!customer) return null;
  const name = `${customer.first_name || ''}${customer.last_name || ''}`.trim() || customer.name || customer.username || '';
  return {
    id: customer.id,
    name,
    avatar: customer.avatar || null,
    username: customer.username || null,
    // WhatsApp identifies a customer by their phone number; the other platforms don't share it.
    phone: room.platform === 'whatsapp' && /^\d{6,15}$/.test(customer.id) ? `+${customer.id}` : null,
  };
};
