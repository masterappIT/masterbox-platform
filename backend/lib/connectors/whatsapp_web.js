// WhatsApp numbers connected by scanning a QR code: an ordinary WhatsApp account linked through whatsapp-gateway.
// No reply window and no templates; its connection shows as SubscribedChannel.whatsapp_web instead.
import { sendThroughGateway, GatewayError } from '../messaging/whatsappGateway.js';
import { checkAttachment } from '../storage/attachmentRules.js';
import { makeBody } from '../messaging/messageBody.js';
import { attachmentCapabilities, firstUserId, windowRule, textOnly } from './shared/base.js';

// The gateway sends files the way WhatsApp's own app does, so the same rules as the Cloud API apply.
const RULES = 'whatsapp';

export default {
  source: 'whatsapp_web',
  platform: 'whatsapp',
  replies: true,

  capabilities: () => [...attachmentCapabilities(RULES), 'caption'],

  // The gateway holds the connection; whether it is up shows when a send fails.
  notReady: () => null,

  recipient: room => firstUserId(room) || room?.chatRoomId || null,

  checkAttachment: file => checkAttachment(RULES, file),

  replyRule: () => windowRule({ platform: 'whatsapp', noLimit: true }),

  /** @returns {Promise<string>} the message's id in WhatsApp */
  send: async ({ channel, customerId }, { text, attachment, sendType }) => {
    const media = attachment ? { url: attachment.payload.url, mimetype: attachment.mime_type, filename: attachment.filename } : undefined;
    const result = await sendThroughGateway(channel.id, { to: customerId, text, media, sendType });
    return result.id;
  },

  failureReason: (error) => {
    console.error('WhatsApp gateway send failed:', error.message);
    return error instanceof GatewayError || error?.message ? `WhatsApp 無法送出這則訊息：${error.message}` : 'WhatsApp 無法送出這則訊息';
  },

  /** A message from the gateway: `{ id, text, attachments }`, with a file's caption as the text. */
  normalize: raw => textOnly(raw) || makeBody({ text: raw?.text, attachments: raw?.attachments }),

  connection: async () => null,

  noTemplatesReason: '掃碼連結的 WhatsApp 不需要範本，可以直接回覆',
};
