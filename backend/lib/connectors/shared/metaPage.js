// Messenger and Instagram send and receive the same way through a Facebook page; only the platform differs.
import { sendFacebookMessage } from '../../../controller/meta_facebook.js';
import { metaPayload } from '../../messaging/outbound.js';
import { checkAttachment } from '../../storage/attachmentRules.js';
import { makeBody, withoutRepeatedStickers } from '../../messaging/messageBody.js';
import { attachmentCapabilities, firstUserId, windowRule, textOnly } from './base.js';
import { checkedConnection } from './connection.js';
import { checkPage, failureStatus, metaNotReady, sendFailureReason } from './meta.js';

/**
 * @param {{ source: 'messenger' | 'instagram', platform: 'fb' | 'ig' }} options
 */
export const metaPageConnector = ({ source, platform }) => ({
  source,
  platform,
  replies: true,

  capabilities: () => [...attachmentCapabilities(platform), 'reply_window'],

  notReady: metaNotReady,

  recipient: firstUserId,

  checkAttachment: file => checkAttachment(platform, file),

  // 24 hours from the customer's last message; a person can answer for 7 days with the HUMAN_AGENT tag once Meta
  // approves it. Neither blocks a reply here: Meta refuses it and the agent sees why.
  replyRule: (room, { lastCustomerMessageAt, now } = {}) => windowRule({ platform, lastCustomerMessageAt, now }),

  /**
   * @param {{ channel, customerId: string, messagingTag?: string }} target
   * @param {{ text?: string, attachment?: object, sendType?: string }} part
   * @returns {Promise<string>} Meta's message id
   */
  send: async ({ channel, customerId, messagingTag }, part) => {
    const { access_token: token, page_id: pageId } = channel.accessInfo || {};
    const result = await sendFacebookMessage(pageId, metaPayload(platform, customerId, part, { messagingTag }), token);
    return result.message_id;
  },

  failureReason: sendFailureReason,

  /** A webhook or history message: `{ mid, text, attachments: [{ type, payload: { url } }] }`. */
  normalize: raw => textOnly(raw) || makeBody({ text: raw?.text, attachments: withoutRepeatedStickers(raw?.attachments) }),

  connection: (channel, options) => checkedConnection(channel, checkPage, failureStatus, options),
});
