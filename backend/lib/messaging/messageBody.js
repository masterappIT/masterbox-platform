// The one shape every message is read in, whatever platform it came from. No database here, so it is easy to test.
//
//   { text, attachments: [{ type, url, filename, mime_type, size, caption }], template: { id, name } }
//
// New messages are stored in it, marked with v: 1. Messages stored before keep what they were stored as:
// plain text, a JSON message (`text`, `attachments`), a Meta payload (`message.text`), a Meta webhook message
// (`mid`, `text`, `attachments`) or a WhatsApp message (`message.body`, captions on attachments). readBody turns
// any of them into this shape when they are read, so nothing needs migrating.

export const BODY_VERSION = 1;

const parse = (contents) => {
  if (contents && typeof contents === 'object') return contents;
  if (typeof contents !== 'string') return null;
  try {
    const value = JSON.parse(contents);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
};

const stringOrNull = value => (typeof value === 'string' && value.length ? value : null);
const hasText = value => typeof value === 'string' && value.trim().length > 0;

/**
 * One attachment in the unified shape, from a stored or platform attachment (`payload.url` or `url`).
 * @returns {{ type, url, filename, mime_type, size, caption } | null}
 */
export const attachmentOf = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const size = Number(raw.size);
  return {
    type: stringOrNull(raw.type) || 'file',
    url: stringOrNull(raw.url) || stringOrNull(raw.payload?.url),
    filename: stringOrNull(raw.filename),
    mime_type: stringOrNull(raw.mime_type),
    size: Number.isFinite(size) && size > 0 ? size : null,
    caption: stringOrNull(raw.caption),
  };
};

/**
 * A Messenger sticker, such as the Like button, comes as an image and a sticker with the same sticker_id.
 * It is kept once, as a sticker.
 */
export const withoutRepeatedStickers = (attachments) => {
  const seen = new Set();
  return (Array.isArray(attachments) ? attachments : []).flatMap((attachment) => {
    const stickerId = attachment?.payload?.sticker_id;
    if (stickerId == null) return [attachment];
    if (seen.has(String(stickerId))) return [];
    seen.add(String(stickerId));
    return [{ ...attachment, type: 'sticker' }];
  });
};

const templateOf = template => (template && template.id != null && template.name
  ? { id: String(template.id), name: String(template.name), ...(template.language ? { language: String(template.language) } : {}) }
  : null);

/**
 * A message as it is stored from now on.
 * @param {{ text?: string, attachments?: object[], template?: { id, name, language? } }} message
 */
export const makeBody = ({ text, attachments, template } = {}) => {
  const stored = {
    v: BODY_VERSION,
    text: hasText(text) ? text : null,
    attachments: (Array.isArray(attachments) ? attachments : []).map(attachmentOf).filter(Boolean),
  };
  const ref = templateOf(template);
  return ref ? { ...stored, template: ref } : stored;
};

/** Whether stored contents are already in the unified shape. */
export const isBody = (contents) => {
  const parsed = parse(contents);
  return Boolean(parsed && parsed.v === BODY_VERSION && Array.isArray(parsed.attachments));
};

// WhatsApp keeps text under body, sometimes one level down ({ text: { body } }).
const textIn = (value) => {
  if (typeof value === 'string') return value;
  if (value && typeof value.body === 'string') return value.body;
  return null;
};

/** What a message stored before the unified shape says. */
const legacyBody = (contents) => {
  const parsed = parse(contents);
  if (!parsed) return { text: typeof contents === 'string' && contents.length ? contents : null, attachments: [], template: null };
  const body = parsed.message && typeof parsed.message === 'object' ? parsed.message : parsed;
  const text = textIn(body.text) ?? textIn(body.body) ?? textIn(parsed.text);
  const list = Array.isArray(body.attachments) ? body.attachments
    : Array.isArray(parsed.attachments) ? parsed.attachments
      : body.attachment ? [body.attachment] : [];
  return { text: hasText(text) ? text : null, attachments: withoutRepeatedStickers(list).map(attachmentOf).filter(Boolean), template: templateOf(parsed.template) };
};

/**
 * Any stored message in the unified shape, as GraphQL's Message.body shows it.
 * @param {string} [encryptionMode] - e2ee messages can only be read on the devices that hold the key
 * @returns {{ text: string|null, attachments: object[], template: { id, name }|null } | null} null for an e2ee message
 */
export const readBody = (contents, encryptionMode) => {
  if (encryptionMode === 'e2ee') return null;
  if (isBody(contents)) {
    const { text, attachments, template } = parse(contents);
    return { text: stringOrNull(text), attachments: attachments.map(attachmentOf).filter(Boolean), template: templateOf(template) };
  }
  return legacyBody(contents);
};

const compact = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null && value !== undefined));

/**
 * The contents as Message.contents has always shown them, for clients built before Message.body.
 * Messages stored before come back exactly as they were; unified ones as plain text, or as the JSON message
 * the admin and app already read (`text`, `attachments[].payload.url`, `template`).
 */
export const legacyContents = (contents) => {
  if (!isBody(contents)) {
    if (typeof contents === 'string') return contents;
    return contents == null ? '' : JSON.stringify(contents);
  }
  const { text, attachments, template } = readBody(contents);
  // Text that looks like JSON goes inside a message, so older clients don't take it for one.
  if (text && !attachments.length && !template && !/^\s*[{[]/.test(text)) return text;
  return JSON.stringify(compact({
    text,
    attachments: attachments.length
      ? attachments.map(({ url, ...rest }) => compact({ ...rest, ...(url ? { payload: { url } } : {}) }))
      : null,
    template,
  }));
};

/** The body the API shows: the template without what only the server keeps. */
export const bodyView = (contents, encryptionMode) => {
  const body = readBody(contents, encryptionMode);
  if (!body) return null;
  return { ...body, template: body.template ? { id: body.template.id, name: body.template.name } : null };
};
