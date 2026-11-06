// Keeps a copy of the files customers send. Meta's attachment links expire, and WhatsApp media can only be fetched with the channel's token.
import metaClient from '../../api/metaClient.js';
import { saveFromUrl, isStorageReady } from '../storage/index.js';
import { mediaRequest, isWebChannel } from './whatsappGateway.js';

// Attachment types that are files. Shares, reels, posts and locations point at something else and are left as they are.
const FILE_ATTACHMENTS = ['image', 'video', 'audio', 'file', 'document', 'sticker'];

const nameFromUrl = (url) => {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || ''); } catch { return ''; }
};

// WhatsApp gives a media id; its download link lasts 5 minutes and needs the token as a bearer header.
const whatsappMediaFile = async (attachment, accessToken) => {
  const media = JSON.parse(await metaClient({ endPoints: attachment.media_id, queryStrings: { access_token: accessToken } }));
  if (!media?.url) throw new Error('Meta returned no media link');
  return saveFromUrl(media.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    mimeType: media.mime_type || attachment.mime_type,
    filename: attachment.filename,
  });
};

// A WhatsApp channel connected by QR code: the gateway downloads the file from the phone's WhatsApp.
const gatewayMediaFile = (attachment, channelId, messageId) => {
  const { url, headers } = mediaRequest(channelId, messageId);
  return saveFromUrl(url, { headers, mimeType: attachment.mime_type, filename: attachment.filename });
};

const storeAttachment = async (attachment, accessToken, { channelId, messageId } = {}) => {
  if (!attachment || !FILE_ATTACHMENTS.includes(attachment.type)) return attachment;
  let file;
  if (attachment.wa_web_media) {
    if (!channelId || !messageId) return attachment;
    file = await gatewayMediaFile(attachment, channelId, messageId);
  } else if (attachment.media_id) {
    if (!accessToken) return attachment;
    file = await whatsappMediaFile(attachment, accessToken);
  } else if (/^https:\/\//.test(attachment.payload?.url || '')) {
    file = await saveFromUrl(attachment.payload.url, { mimeType: attachment.mime_type, filename: attachment.filename || nameFromUrl(attachment.payload.url) });
  } else {
    return attachment;
  }
  const { media_id: _mediaId, wa_web_media: _waWebMedia, ...rest } = attachment;
  return { ...rest, payload: { ...rest.payload, url: file.url }, filename: attachment.filename || file.filename, mime_type: file.mime_type, size: file.size };
};

/**
 * The message contents with each attachment pointing at our own copy. An attachment that can't be saved
 * stays as it was, so the message and its text are never lost; the admin shows its label instead.
 * @param {object} contents - a webhook or history message, with `attachments`
 * @param {{ accessInfo?: object }} channel - the channel it came in on, for WhatsApp's token
 */
export const storeInboundAttachments = async (contents, channel) => {
  const attachments = Array.isArray(contents?.attachments) ? contents.attachments : [];
  if (!attachments.length || !isStorageReady()) return contents;
  const accessToken = channel?.accessInfo?.access_token;
  const gateway = isWebChannel(channel) ? { channelId: channel.id, messageId: contents.id } : {};
  const stored = await Promise.all(attachments.map(attachment => storeAttachment(attachment, accessToken, gateway).catch((error) => {
    console.error(`Attachment not saved (${attachment?.type}):`, error.message);
    return attachment;
  })));
  return { ...contents, attachments: stored };
};
