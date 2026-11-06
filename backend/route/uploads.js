import express from 'express';
import { checkAttachment, MAX_UPLOAD_BYTES, MAX_INBOUND_BYTES } from '../lib/storage/attachmentRules.js';
import { saveStream, serveFile, isStorageReady, StorageError } from '../lib/storage/index.js';

// Public downloads. Meta fetches the files agents send from here, so they need no login; the random path is the protection.
export const filesRouter = express.Router().get('/:id/:name', serveFile);

const decodeName = (header) => {
  try { return decodeURIComponent(header || ''); } catch { return ''; }
};

// The browser only reads the answer once it has sent the whole file, so let a refused upload finish first.
// Anything far beyond any limit is cut off instead.
const DRAIN_LIMIT = MAX_INBOUND_BYTES + 1024 * 1024;
const refuse = (req, res, status, error) => {
  const answer = () => { if (!res.headersSent) res.status(status).json({ error }); };
  if (req.complete || req.destroyed) return answer();
  let received = 0;
  req.on('data', (chunk) => {
    received += chunk.length;
    if (received > DRAIN_LIMIT) { res.status(status).set('Connection', 'close').json({ error }); req.destroy(); }
  });
  req.on('end', answer);
  req.resume();
};

/**
 * Agents upload a file before sending it. The body is the file itself (Content-Type is its MIME type),
 * X-File-Name carries its URI-encoded name, and ?platform= the platform it is for, whose limits apply.
 * @param authenticate express middleware that sets req.account or answers 401
 */
export const createUploadsRouter = ({ authenticate }) => express.Router().post('/', authenticate, async (req, res, next) => {
  if (!isStorageReady()) return refuse(req, res, 503, '附件儲存空間尚未設定，暫時無法傳送附件');
  const filename = decodeName(req.get('x-file-name'));
  const length = Number(req.get('content-length'));
  const check = checkAttachment(String(req.query.platform || ''), {
    mime: req.get('content-type'), filename, size: Number.isFinite(length) && req.get('content-length') ? length : undefined,
  });
  if (!check.ok) return refuse(req, res, 422, check.reason);

  try {
    const saved = await saveStream(req, { mimeType: check.mime, filename, maxBytes: Math.min(check.maxBytes, MAX_UPLOAD_BYTES) });
    res.status(201).json(saved);
  } catch (error) {
    if (error instanceof StorageError) return refuse(req, res, error.status, error.message);
    next(error);
  }
});
