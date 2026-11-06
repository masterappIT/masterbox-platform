// Where MasterBox keeps attachments. Everything that reads or writes a stored file goes through here,
// so moving to a bucket later only changes this module.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { FILE_TYPES, resolveFileType, MAX_INBOUND_BYTES } from './attachmentRules.js';

export const FILES_ROUTE = '/files';
const ID_PATTERN = /^[a-f0-9]{32}$/;

export class StorageError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Production keeps files on a mounted volume; a file written anywhere else disappears with the container.
// Until UPLOADS_DIR is set there, attachments are turned off rather than lost on the next deploy.
const storageDir = () => process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : process.env.NODE_ENV === 'production' ? null : path.resolve('uploads');

export const isStorageReady = () => Boolean(storageDir());

// Files are served from the API's own domain: Meta fetches them from here, and Google's domains are often unreachable in mainland China.
const publicBase = () => (process.env.FILES_PUBLIC_URL || process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, '');

// The name a file is served under: the original name without anything that could reach another path, with the extension of its real type.
export const storedName = (filename, type) => {
  const stem = String(filename || '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '')
    .replace(/^[.\s]+/, '')
    .replace(/\.[^.]*$/, '')
    .trim()
    .slice(0, 100);
  return `${stem || type.kind}.${type.ext}`;
};

export const fileUrl = (id, name) => `${publicBase()}${FILES_ROUTE}/${id}/${encodeURIComponent(name)}`;

const filePath = (id, name) => {
  const dir = storageDir();
  if (!dir || !ID_PATTERN.test(id) || !name || name.includes('/') || name.includes('\\') || name.startsWith('.')) return null;
  const full = path.join(dir, id, name);
  return full.startsWith(path.join(dir, id) + path.sep) ? full : null;
};

const limitBytes = (maxBytes, counter) => new Transform({
  transform(chunk, _encoding, callback) {
    counter.bytes += chunk.length;
    if (counter.bytes > maxBytes) callback(new StorageError(`檔案不能超過 ${Math.round(maxBytes / 1024 / 1024)}MB`, 413));
    else callback(null, chunk);
  },
});

/**
 * Stores a file under a random, unguessable path.
 * @param {Readable} stream - the file's bytes
 * @param {{ mimeType: string, filename?: string, maxBytes: number }} options
 * @returns {{ url, filename, mime_type, size, kind }}
 */
export const saveStream = async (stream, { mimeType, filename, maxBytes }) => {
  const dir = storageDir();
  if (!dir) throw new StorageError('附件儲存空間尚未設定', 503);
  const type = resolveFileType(mimeType, filename);
  if (!type) throw new StorageError('不支援這種檔案', 415);

  const id = randomBytes(16).toString('hex');
  const name = storedName(filename, type);
  const tmpDir = path.join(dir, '.incoming');
  await fs.promises.mkdir(tmpDir, { recursive: true });
  const tmp = path.join(tmpDir, id);
  const counter = { bytes: 0 };
  try {
    await pipeline(stream, limitBytes(maxBytes, counter), fs.createWriteStream(tmp, { flags: 'wx' }));
    if (!counter.bytes) throw new StorageError('檔案是空的', 400);
    await fs.promises.mkdir(path.join(dir, id));
    await fs.promises.rename(tmp, path.join(dir, id, name));
  } catch (error) {
    await fs.promises.rm(tmp, { force: true });
    throw error;
  }
  return { url: fileUrl(id, name), filename: name, mime_type: type.mime, size: counter.bytes, kind: type.kind };
};

/**
 * Downloads a file into storage, such as an attachment a customer sent through Meta.
 * @param {string} url
 * @param {{ headers?: object, filename?: string, mimeType?: string, maxBytes?: number, timeoutMs?: number }} options
 */
export const saveFromUrl = async (url, { headers, filename, mimeType, maxBytes = MAX_INBOUND_BYTES, timeoutMs = 60000 } = {}) => {
  if (!isStorageReady()) throw new StorageError('附件儲存空間尚未設定', 503);
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
  if (!response.ok || !response.body) throw new StorageError(`下載失敗（HTTP ${response.status}）`, 502);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) {
    await response.body.cancel();
    throw new StorageError('檔案太大', 413);
  }
  const type = mimeType || response.headers.get('content-type');
  return saveStream(Readable.fromWeb(response.body), { mimeType: type, filename, maxBytes });
};

/**
 * A stored file from its public URL.
 * @returns {{ path, url, filename, mime_type, size, kind } | null} null when the URL isn't one of ours or the file is gone
 */
export const describeUrl = async (url) => {
  const prefix = `${publicBase()}${FILES_ROUTE}/`;
  if (typeof url !== 'string' || !url.startsWith(prefix)) return null;
  const [id, encodedName, ...rest] = url.slice(prefix.length).split('/');
  if (rest.length) return null;
  let name;
  try { name = decodeURIComponent(encodedName || ''); } catch { return null; }
  const full = filePath(id, name);
  if (!full) return null;
  const stat = await fs.promises.stat(full).catch(() => null);
  const type = resolveFileType(null, name);
  if (!stat?.isFile() || !type) return null;
  return { path: full, url: fileUrl(id, name), filename: name, mime_type: type.mime, size: stat.size, kind: type.kind };
};

// Sends one stored file. Only exact paths are served, so there is nothing to list.
export const serveFile = (req, res) => {
  const full = filePath(req.params.id, req.params.name);
  const type = resolveFileType(null, req.params.name);
  if (!full || !type || !FILE_TYPES[type.mime]) return res.sendStatus(404);
  // Relative to the storage folder, so only the file's own path is checked for hidden names.
  res.sendFile(path.relative(storageDir(), full), {
    root: storageDir(),
    dotfiles: 'deny',
    maxAge: '365d',
    immutable: true,
    headers: {
      'Content-Type': type.mime,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(req.params.name)}`,
      'X-Content-Type-Options': 'nosniff',
    },
  }, (error) => {
    if (error && !res.headersSent) res.sendStatus([403, 404].includes(error.statusCode) || error.code === 'ENOENT' ? 404 : 500);
  });
};
