// Which files MasterBox keeps and what each platform accepts. admin/src/utils/attachmentRules.js is a copy, so the
// admin can explain a refusal the moment a file is picked; backend/test checks the two stay identical.
// Platform limits come from Meta's documentation (checked 2026-11):
// - Messenger Send API: image, audio, video and file attachments up to 25MB.
// - Instagram messaging: PNG/JPEG images up to 8MB; MP4/MOV/WebM video, AAC/M4A/WAV audio and PDF files up to 25MB.
// - WhatsApp Cloud API: JPEG/PNG images up to 5MB; MP4/3GPP video and AAC/AMR/MP3/M4A/OGG audio up to 16MB;
//   PDF, TXT and Office documents up to 100MB, capped here at MasterBox's own 25MB.

const MB = 1024 * 1024;

// The most an agent can upload. Customers' files can be larger: WhatsApp lets them send documents up to 100MB.
export const MAX_UPLOAD_BYTES = 25 * MB;
export const MAX_INBOUND_BYTES = 100 * MB;

// Every file type MasterBox stores, by MIME type, with the extension it is stored under.
export const FILE_TYPES = {
  'image/jpeg': { kind: 'image', ext: 'jpg', label: 'JPG' },
  'image/png': { kind: 'image', ext: 'png', label: 'PNG' },
  'image/gif': { kind: 'image', ext: 'gif', label: 'GIF' },
  'image/webp': { kind: 'image', ext: 'webp', label: 'WebP' },
  'video/mp4': { kind: 'video', ext: 'mp4', label: 'MP4' },
  'video/quicktime': { kind: 'video', ext: 'mov', label: 'MOV' },
  'video/webm': { kind: 'video', ext: 'webm', label: 'WebM' },
  'video/3gpp': { kind: 'video', ext: '3gp', label: '3GP' },
  'audio/mpeg': { kind: 'audio', ext: 'mp3', label: 'MP3' },
  'audio/mp4': { kind: 'audio', ext: 'm4a', label: 'M4A' },
  'audio/aac': { kind: 'audio', ext: 'aac', label: 'AAC' },
  'audio/ogg': { kind: 'audio', ext: 'ogg', label: 'OGG' },
  'audio/wav': { kind: 'audio', ext: 'wav', label: 'WAV' },
  'audio/amr': { kind: 'audio', ext: 'amr', label: 'AMR' },
  'application/pdf': { kind: 'file', ext: 'pdf', label: 'PDF' },
  'text/plain': { kind: 'file', ext: 'txt', label: 'TXT' },
  'text/csv': { kind: 'file', ext: 'csv', label: 'CSV' },
  'application/msword': { kind: 'file', ext: 'doc', label: 'DOC' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { kind: 'file', ext: 'docx', label: 'DOCX' },
  'application/vnd.ms-excel': { kind: 'file', ext: 'xls', label: 'XLS' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { kind: 'file', ext: 'xlsx', label: 'XLSX' },
  'application/vnd.ms-powerpoint': { kind: 'file', ext: 'ppt', label: 'PPT' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { kind: 'file', ext: 'pptx', label: 'PPTX' },
};

// Other names browsers and Meta use for the same types.
const MIME_ALIASES = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'audio/mp3': 'audio/mpeg',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/x-aac': 'audio/aac',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/opus': 'audio/ogg',
  'application/x-pdf': 'application/pdf',
};

const EXTENSIONS = Object.fromEntries([
  ...Object.entries(FILE_TYPES).map(([mime, { ext }]) => [ext, mime]),
  ['jpeg', 'image/jpeg'], ['opus', 'audio/ogg'], ['3gpp', 'video/3gpp'],
]);

export const KIND_LABELS = { image: '圖片', video: '影片', audio: '音訊', file: '檔案' };

/**
 * The stored type of a file from its MIME type, or from its extension when the MIME type is missing or generic.
 * @returns {{ mime, kind, ext, label } | null} null when MasterBox doesn't keep this kind of file
 */
export const resolveFileType = (mimeType, filename) => {
  const declared = String(mimeType || '').split(';')[0].trim().toLowerCase();
  const mime = MIME_ALIASES[declared] || declared;
  if (FILE_TYPES[mime]) return { mime, ...FILE_TYPES[mime] };
  if (declared && declared !== 'application/octet-stream') return null;
  const ext = String(filename || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const byExt = EXTENSIONS[ext];
  return byExt ? { mime: byExt, ...FILE_TYPES[byExt] } : null;
};

const IMAGE = ['image/jpeg', 'image/png'];
const OFFICE = [
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const ofKind = kind => Object.keys(FILE_TYPES).filter(mime => FILE_TYPES[mime].kind === kind);

// For each platform and kind of file: the accepted MIME types, the size limit, and the attachment type Meta expects.
export const PLATFORM_RULES = {
  fb: {
    name: 'Facebook',
    kinds: {
      image: { mimes: ofKind('image'), maxBytes: 25 * MB, sendType: 'image' },
      video: { mimes: ofKind('video'), maxBytes: 25 * MB, sendType: 'video' },
      audio: { mimes: ofKind('audio'), maxBytes: 25 * MB, sendType: 'audio' },
      file: { mimes: ofKind('file'), maxBytes: 25 * MB, sendType: 'file' },
    },
  },
  ig: {
    name: 'Instagram',
    kinds: {
      image: { mimes: IMAGE, maxBytes: 8 * MB, sendType: 'image' },
      video: { mimes: ['video/mp4', 'video/quicktime', 'video/webm'], maxBytes: 25 * MB, sendType: 'video' },
      audio: { mimes: ['audio/aac', 'audio/mp4', 'audio/wav'], maxBytes: 25 * MB, sendType: 'audio' },
      file: { mimes: ['application/pdf'], maxBytes: 25 * MB, sendType: 'file' },
    },
  },
  whatsapp: {
    name: 'WhatsApp',
    kinds: {
      image: { mimes: IMAGE, maxBytes: 5 * MB, sendType: 'image' },
      video: { mimes: ['video/mp4', 'video/3gpp'], maxBytes: 16 * MB, sendType: 'video' },
      audio: { mimes: ['audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp4', 'audio/ogg'], maxBytes: 16 * MB, sendType: 'audio' },
      file: { mimes: ['application/pdf', 'text/plain', ...OFFICE], maxBytes: MAX_UPLOAD_BYTES, sendType: 'document' },
    },
  },
};

// What the file picker offers: everything MasterBox keeps, with extensions for systems that don't know a MIME type.
export const ACCEPT_ATTRIBUTE = [...Object.keys(FILE_TYPES), ...Object.keys(EXTENSIONS).map(ext => `.${ext}`)].join(',');

const sizeLabel = bytes => `${Math.round(bytes / MB)}MB`;

/**
 * Whether a platform accepts a file, and how to send it.
 * @param {string} platform - fb, ig or whatsapp
 * @param {{ mime: string, filename?: string, size?: number }} file - size may be unknown until the upload finishes
 * @returns {{ ok: true, mime, kind, sendType, maxBytes } | { ok: false, reason: string }}
 */
export const checkAttachment = (platform, { mime, filename, size }) => {
  const rules = PLATFORM_RULES[platform];
  if (!rules) return { ok: false, reason: '這個平台尚未支援傳送附件' };
  const type = resolveFileType(mime, filename);
  if (!type) return { ok: false, reason: '只能傳送圖片、影片、音訊、PDF 或常見文件（Word、Excel、PowerPoint、TXT、CSV）' };
  const rule = rules.kinds[type.kind];
  const kindLabel = KIND_LABELS[type.kind];
  if (!rule.mimes.includes(type.mime)) {
    const accepted = rule.mimes.map(m => FILE_TYPES[m].label).join('、');
    return { ok: false, reason: `${rules.name} 不接受 ${type.label} ${kindLabel}，${kindLabel}只能用 ${accepted}` };
  }
  if (Number.isFinite(size) && size > rule.maxBytes) {
    return { ok: false, reason: `${rules.name} 的${kindLabel}不能超過 ${sizeLabel(rule.maxBytes)}` };
  }
  if (Number.isFinite(size) && size <= 0) return { ok: false, reason: '檔案是空的' };
  return { ok: true, mime: type.mime, kind: type.kind, sendType: rule.sendType, maxBytes: rule.maxBytes };
};
