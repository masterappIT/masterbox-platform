// Small pieces every connector uses.
import { PLATFORM_RULES } from '../../storage/attachmentRules.js';
import { replyWindow, freeformBlockReason } from '../../messaging/replyWindow.js';
import { makeBody } from '../../messaging/messageBody.js';

const SEND_CAPABILITY = { image: 'send_image', video: 'send_video', audio: 'send_audio', file: 'send_document' };

/** The send_* capabilities a platform's attachment rules (the ones checkAttachment uses) allow. */
export const attachmentCapabilities = platform => Object.keys(PLATFORM_RULES[platform]?.kinds || {}).map(kind => SEND_CAPABILITY[kind]).filter(Boolean);

/** The customer is the first user stored on the conversation. */
export const firstUserId = room => (Array.isArray(room?.users) ? room.users[0]?.id : null) || null;

/**
 * A reply rule from Meta's reply window, with why a free-form reply can't go out now (null when it can).
 * @param {object} options - what replyWindow takes
 */
export const windowRule = (options) => {
  const window = replyWindow(options);
  return { ...window, blockReason: freeformBlockReason(window) };
};

/** Messages a raw platform message can't be read from: plain text, or nothing at all. */
export const textOnly = raw => (typeof raw === 'string' ? makeBody({ text: raw }) : null);

/** For a source MasterBox can't send through yet. */
export class UnsupportedError extends Error {}

/**
 * A connector for a source that can't be answered here yet, such as LINE before it is connected.
 * @param {{ source: string|null, platform?: string, name: string }} options
 */
export const unsupportedConnector = ({ source, platform, name }) => ({
  source,
  platform,
  capabilities: () => [],
  replies: false,
  notReady: () => `尚未支援回覆 ${name} 訊息`,
  recipient: firstUserId,
  checkAttachment: () => ({ ok: false, reason: '這個平台尚未支援傳送附件' }),
  replyRule: () => windowRule({ platform: platform || source || 'unknown' }),
  send: async () => { throw new UnsupportedError(`尚未支援回覆 ${name} 訊息`); },
  failureReason: error => error.message,
  normalize: raw => textOnly(raw) || makeBody(raw && typeof raw === 'object' ? raw : {}),
  connection: null,
});
