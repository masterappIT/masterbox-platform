// WhatsApp numbers on Meta's Cloud API: the 24-hour customer service window, and approved templates outside it.
import { sendWhatsappMessage, whatsappMessageId, fetchApprovedTemplates } from '../../controller/meta_whatsapp.js';
import { metaPayload } from '../messaging/outbound.js';
import { checkAttachment } from '../storage/attachmentRules.js';
import { makeBody } from '../messaging/messageBody.js';
import { attachmentCapabilities, firstUserId, windowRule, textOnly } from './shared/base.js';
import { checkedConnection } from './shared/connection.js';
import { checkWhatsappNumber, failureStatus, metaNotReady, sendFailureReason } from './shared/meta.js';

const PLATFORM = 'whatsapp';

const credentials = channel => {
  const { access_token: token, phone_number_id: phoneNumberId, whatsapp_business_account_id: wabaId } = channel?.accessInfo || {};
  return { token, phoneNumberId, wabaId };
};

const sendPayload = async (channel, payload) => {
  const { token, phoneNumberId } = credentials(channel);
  const result = await sendWhatsappMessage(payload, phoneNumberId, token);
  return whatsappMessageId(result.messages[0].id);
};

export default {
  source: 'whatsapp_cloud',
  platform: PLATFORM,
  replies: true,

  capabilities: () => [...attachmentCapabilities(PLATFORM), 'caption', 'reply_window', 'templates'],

  notReady: metaNotReady,

  // Each customer's number is its own conversation, so the conversation id is the number when no user is stored.
  recipient: room => firstUserId(room) || room?.chatRoomId || null,

  checkAttachment: file => checkAttachment(PLATFORM, file),

  // Outside the 24-hour window WhatsApp only takes an approved template, so a free-form reply is stopped here.
  replyRule: (room, { lastCustomerMessageAt, now } = {}) => windowRule({ platform: PLATFORM, lastCustomerMessageAt, now }),

  /** @returns {Promise<string>} WhatsApp's message id */
  send: async ({ channel, customerId }, part) => sendPayload(channel, metaPayload(PLATFORM, customerId, part)),

  failureReason: sendFailureReason,

  /**
   * A webhook message: text under `message.body`, a button or list reply under `message.text`, and files as
   * attachments with their caption.
   */
  normalize: (raw) => {
    const plain = textOnly(raw);
    if (plain) return plain;
    const text = raw?.message?.body ?? raw?.message?.text ?? (typeof raw?.text === 'string' ? raw.text : raw?.text?.body);
    return makeBody({ text, attachments: raw?.attachments });
  },

  connection: (channel, options) => checkedConnection(channel, checkWhatsappNumber, failureStatus, options),

  // --- Templates (the templates capability) ---

  /** Why the number's templates can't be used, or null when they can. */
  templatesUnavailable: channel => (credentials(channel).wabaId ? null : '這個 WhatsApp 頻道缺少商業帳號資料，請到社群平台管理重新串接後再使用範本'),

  /** The number's approved templates, as Meta lists them. */
  templates: channel => {
    const { wabaId, token } = credentials(channel);
    return fetchApprovedTemplates(wabaId, token);
  },

  /** Sends a template message built by whatsappTemplates.templateMessage. @returns WhatsApp's message id */
  sendTemplate: ({ channel }, payload) => sendPayload(channel, payload),
};
