// Turns whatsapp-web.js messages into what MasterBox stores. No browser or network here, so it is easy to test.

// Files WhatsApp sends, by whatsapp-web.js type, as the attachment types MasterBox already shows.
const MEDIA_TYPES = { image: 'image', video: 'video', audio: 'audio', ptt: 'audio', document: 'document', sticker: 'sticker' };

/**
 * Whether a chat is one customer. Groups, status updates, broadcast lists and channels are left out.
 * @param {string} chatId - such as 886912345678@c.us or 1234567890@lid
 */
export const isCustomerChat = (chatId) => typeof chatId === 'string' && /@(c\.us|lid)$/.test(chatId);

/** The chat a message belongs to: the other side of the conversation. */
export const chatIdOf = (msg) => (msg.fromMe ? msg.to : msg.from);

/**
 * The message as MasterBox stores it, or null for messages that aren't conversation, such as
 * encryption notices, calls, deleted messages and anything in a group.
 * @returns {{ externalId: string, chatId: string, fromMe: boolean, sentAt: string, hasMedia: boolean, contents: object } | null}
 */
export const toMasterboxMessage = (msg) => {
  const chatId = chatIdOf(msg);
  if (!msg?.id?._serialized || msg.isStatus || msg.broadcast || !isCustomerChat(chatId)) return null;
  const text = typeof msg.body === 'string' && msg.body.trim() ? msg.body : undefined;
  const base = { id: msg.id._serialized, timestamp: String(msg.timestamp) };
  let contents = null;
  const mediaType = MEDIA_TYPES[msg.type];

  if (msg.type === 'chat') {
    if (text) contents = { ...base, text };
  } else if (mediaType) {
    // The file is fetched from the gateway when the message is stored; mark it so the backend knows to.
    const attachment = { type: mediaType, mime_type: msg._data?.mimetype || undefined, filename: msg._data?.filename || undefined, wa_web_media: Boolean(msg.hasMedia) };
    // A sticker's or voice message's body is the file itself, not a caption.
    const caption = ['image', 'video', 'document'].includes(mediaType) ? text : undefined;
    contents = { ...base, ...(caption ? { text: caption } : {}), attachments: [clean(attachment)] };
  } else if (msg.type === 'location' && msg.location) {
    const { latitude, longitude, description } = msg.location;
    contents = { ...base, attachments: [clean({ type: 'location', caption: description || undefined, payload: { coordinates: { lat: Number(latitude), long: Number(longitude) } } })] };
  } else if (msg.type === 'vcard' || msg.type === 'multi_vcard') {
    contents = { ...base, attachments: [{ type: 'contacts', caption: contactNames(msg) || undefined }] };
  }
  if (!contents) return null;

  return {
    externalId: msg.id._serialized,
    chatId,
    fromMe: Boolean(msg.fromMe),
    sentAt: new Date(Number(msg.timestamp) * 1000).toISOString(),
    hasMedia: Boolean(mediaType && msg.hasMedia),
    contents,
  };
};

const clean = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

// A shared contact card's name, from the FN line of each vCard.
const contactNames = (msg) => (msg.vCards?.length ? msg.vCards : [msg.body]).map((card) => /\nFN:(.*)/.exec(String(card || ''))?.[1]?.trim()).filter(Boolean).join(', ');

/**
 * The customer of a chat, as stored on the conversation.
 * @param {string} chatId
 * @param {object} [contact] - from whatsapp-web.js getContact()
 */
export const customerOf = (chatId, contact) => clean({
  id: chatId,
  // Their name in the phone's address book first, then the name they set themselves.
  name: contact?.name || contact?.pushname || contact?.verifiedName || (contact?.number ? `+${contact.number}` : undefined),
  phone: contact?.number ? `+${contact.number}` : undefined,
});

/**
 * How whatsapp-web.js should send one part of an agent's reply.
 * @param {{ text?: string, media?: { url: string, mimetype?: string, filename?: string }, sendType?: string }} part
 * @returns {{ content: string | 'media', options: object }}
 */
export const sendOptions = ({ text, media, sendType }) => {
  if (!media) return { content: text, options: {} };
  return {
    content: 'media',
    options: clean({
      caption: text || undefined,
      // Anything that isn't a picture, video or voice message goes as a file, so it keeps its name.
      sendMediaAsDocument: sendType === 'document' || sendType === 'file' || undefined,
    }),
  };
};
