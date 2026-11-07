// Turns what an agent sent into the messages each platform accepts. No database or network here, so it is easy to test.

const parseContents = (contents) => {
  if (contents && typeof contents === 'object') return contents;
  try {
    const parsed = JSON.parse(contents);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
};

// The admin sends plain text, a JSON message (`text`, `attachments`), or a Meta payload (`message.text`, `message.attachments`).
const bodyOf = parsed => (parsed?.message && typeof parsed.message === 'object' ? parsed.message : parsed);

/**
 * The text and attachments of a reply.
 * @returns {{ text: string, attachments: object[] }}
 */
export const replyContentsOf = (contents) => {
  const parsed = parseContents(contents);
  if (!parsed) return { text: typeof contents === 'string' ? contents : '', attachments: [] };
  const body = bodyOf(parsed);
  const text = body?.text ?? body?.body;
  const attachments = Array.isArray(body?.attachments) ? body.attachments : body?.attachment ? [body.attachment] : [];
  return { text: typeof text === 'string' ? text : '', attachments };
};

// WhatsApp puts a caption under images, videos and documents, up to 1024 characters. Meta doesn't document
// a combined text and attachment for Messenger or Instagram, so there they always go as two messages.
const CAPTION_TYPES = ['image', 'video', 'document'];
const CAPTION_MAX = 1024;

/**
 * The messages a reply is sent as, in order: the attachment first, then the text, unless the source can show the
 * text as the attachment's caption.
 * @param {{ text: string, attachment?: object, sendType?: string }} reply - attachment is the stored file, sendType the type the platform expects
 * @param {{ caption?: boolean }} [options] - caption: the source declares the caption capability
 * @returns {{ text?: string, attachment?: object, sendType?: string }[]}
 */
export const splitReply = ({ text, attachment, sendType }, { caption = false } = {}) => {
  const hasText = typeof text === 'string' && text.trim().length > 0;
  if (!attachment) return hasText ? [{ text }] : [];
  const canCaption = caption && CAPTION_TYPES.includes(sendType) && hasText && [...text].length <= CAPTION_MAX;
  if (canCaption) return [{ text, attachment, sendType }];
  return [{ attachment, sendType }, ...(hasText ? [{ text }] : [])];
};

/**
 * splitReply for a platform: WhatsApp has captions, Messenger and Instagram don't.
 * @param {string} platform - fb, ig or whatsapp
 */
export const replyParts = (platform, reply) => splitReply(reply, { caption: platform === 'whatsapp' });

/**
 * The request body Meta's send API takes for one part of a reply.
 * @param {string} platform - fb, ig or whatsapp
 * @param {string} recipientId - the customer's id on the platform
 * @param {{ messagingTag?: string }} [options] - Messenger and Instagram replies after the 24-hour window go with a tag, such as HUMAN_AGENT
 */
export const metaPayload = (platform, recipientId, { text, attachment, sendType }, { messagingTag } = {}) => {
  if (platform === 'whatsapp') {
    const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: recipientId };
    if (!attachment) return { ...base, type: 'text', text: { body: text } };
    const media = {
      link: attachment.payload.url,
      ...(text ? { caption: text } : {}),
      ...(sendType === 'document' && attachment.filename ? { filename: attachment.filename } : {}),
    };
    return { ...base, type: sendType, [sendType]: media };
  }
  const message = attachment ? { attachment: { type: sendType, payload: { url: attachment.payload.url } } } : { text };
  if (messagingTag) return { recipient: { id: recipientId }, messaging_type: 'MESSAGE_TAG', tag: messagingTag, message };
  return { recipient: { id: recipientId }, messaging_type: 'RESPONSE', message };
};

/**
 * The attachment as stored with the message, from the file in storage, never from what the client claimed.
 * @param {{ url, filename, mime_type, size, kind }} file - from storage
 */
export const storedAttachment = (file) => ({
  type: file.kind,
  payload: { url: file.url },
  filename: file.filename,
  mime_type: file.mime_type,
  size: file.size,
});
