import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import express from 'express';

const here = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'masterbox-uploads-'));
process.env.UPLOADS_DIR = uploadsDir;
process.env.FILES_PUBLIC_URL = 'https://api.example.test';

const { checkAttachment, resolveFileType } = await import('../lib/storage/attachmentRules.js');
const { saveStream, saveFromUrl, describeUrl, storedName } = await import('../lib/storage/index.js');
const { replyContentsOf, replyParts, metaPayload, partContents, storedAttachment } = await import('../lib/messaging/outbound.js');
const { storeInboundAttachments } = await import('../lib/messaging/inbound.js');
const { filesRouter, createUploadsRouter } = await import('../route/uploads.js');

const MB = 1024 * 1024;
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

after(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));

describe('attachment rules', () => {
  test('the admin copy matches the backend', () => {
    const backend = fs.readFileSync(path.join(here, '../lib/storage/attachmentRules.js'), 'utf8');
    const admin = fs.readFileSync(path.join(here, '../../admin/src/utils/attachmentRules.js'), 'utf8');
    assert.equal(admin, backend);
  });

  const flutterRules = path.join(here, '../../flutter/lib/models/attachment_rules.dart');
  test('the Flutter app copy matches the backend', { skip: !fs.existsSync(flutterRules) && 'the Flutter app is not in this checkout' }, async () => {
    const dart = fs.readFileSync(flutterRules, 'utf8');
    const copy = JSON.parse(dart.match(/attachmentRulesJson = r'''([\s\S]*?)'''/)[1]);
    const rules = await import('../lib/storage/attachmentRules.js');
    assert.equal(copy.maxUploadBytes, rules.MAX_UPLOAD_BYTES);
    assert.deepEqual(copy.fileTypes, rules.FILE_TYPES);
    assert.deepEqual(copy.kindLabels, rules.KIND_LABELS);
    assert.deepEqual(copy.platforms, rules.PLATFORM_RULES);
    // The aliases and extensions aren't exported, so the backend's own reading of them is the reference.
    for (const [alias, mime] of Object.entries(copy.mimeAliases)) assert.equal(resolveFileType(alias)?.mime, mime, alias);
    for (const [ext, mime] of Object.entries(copy.extensions)) assert.equal(resolveFileType('', `a.${ext}`)?.mime, mime, ext);
    const backendSource = fs.readFileSync(path.join(here, '../lib/storage/attachmentRules.js'), 'utf8');
    const aliasBlock = backendSource.slice(backendSource.indexOf('const MIME_ALIASES'), backendSource.indexOf('};', backendSource.indexOf('const MIME_ALIASES')));
    assert.equal(Object.keys(copy.mimeAliases).length, [...aliasBlock.matchAll(/': '/g)].length, 'every alias is copied');
    const accepted = rules.ACCEPT_ATTRIBUTE.split(',').filter(item => item.startsWith('.')).map(item => item.slice(1));
    assert.deepEqual(Object.keys(copy.extensions).sort(), accepted.sort(), 'every extension is copied');
  });

  test('types come from the MIME type, or the extension when it is missing', () => {
    assert.equal(resolveFileType('image/jpg').mime, 'image/jpeg');
    assert.equal(resolveFileType('audio/ogg; codecs=opus').mime, 'audio/ogg');
    assert.equal(resolveFileType('', '報價.DOCX').ext, 'docx');
    assert.equal(resolveFileType('application/octet-stream', 'a.pdf').mime, 'application/pdf');
    assert.equal(resolveFileType('text/html', 'a.pdf'), null);
    assert.equal(resolveFileType('application/zip', 'a.zip'), null);
  });

  test('each platform applies its own formats and limits', () => {
    assert.deepEqual(
      [checkAttachment('fb', { mime: 'image/gif', size: MB }).sendType, checkAttachment('ig', { mime: 'application/pdf', size: MB }).sendType, checkAttachment('whatsapp', { mime: 'application/pdf', size: MB }).sendType],
      ['image', 'file', 'document'],
    );
    assert.match(checkAttachment('ig', { mime: 'image/gif', size: MB }).reason, /Instagram 不接受 GIF/);
    assert.match(checkAttachment('ig', { mime: 'image/png', size: 9 * MB }).reason, /8MB/);
    assert.match(checkAttachment('ig', { mime: 'application/msword', size: MB }).reason, /PDF/);
    assert.match(checkAttachment('whatsapp', { mime: 'image/jpeg', size: 6 * MB }).reason, /5MB/);
    assert.match(checkAttachment('whatsapp', { mime: 'video/mp4', size: 17 * MB }).reason, /16MB/);
    assert.match(checkAttachment('fb', { mime: 'application/pdf', size: 26 * MB }).reason, /25MB/);
    assert.match(checkAttachment('fb', { mime: 'application/zip', size: 1 }).reason, /只能傳送/);
    assert.match(checkAttachment('line', { mime: 'image/png', size: 1 }).reason, /尚未支援/);
    assert.equal(checkAttachment('whatsapp', { mime: 'image/png' }).ok, true, 'size can be unknown before the upload');
  });
});

describe('reply payloads', () => {
  const image = storedAttachment({ kind: 'image', url: 'https://api.example.test/files/a/photo.jpg', filename: 'photo.jpg', mime_type: 'image/jpeg', size: 10 });
  const doc = storedAttachment({ kind: 'file', url: 'https://api.example.test/files/b/%E5%A0%B1%E5%83%B9.pdf', filename: '報價.pdf', mime_type: 'application/pdf', size: 10 });
  const voice = storedAttachment({ kind: 'audio', url: 'https://api.example.test/files/c/voice.m4a', filename: 'voice.m4a', mime_type: 'audio/mp4', size: 10 });

  test('reads text and attachments from every shape the admin sends', () => {
    assert.deepEqual(replyContentsOf('hello'), { text: 'hello', attachments: [] });
    assert.deepEqual(replyContentsOf(JSON.stringify({ text: 'hi' })), { text: 'hi', attachments: [] });
    assert.deepEqual(replyContentsOf(JSON.stringify({ recipient: { id: '1' }, message: { text: 'yo', attachments: [image] } })), { text: 'yo', attachments: [image] });
    assert.deepEqual(replyContentsOf(JSON.stringify({ message: { body: 'wa' } })).text, 'wa');
  });

  test('Messenger and Instagram send the file and the text as two messages, file first', () => {
    for (const platform of ['fb', 'ig']) {
      const parts = replyParts(platform, { text: '請看附件', attachment: doc, sendType: 'file' });
      assert.deepEqual(parts.map(part => Object.keys(part).sort()), [['attachment', 'sendType'], ['text']]);
      assert.deepEqual(metaPayload(platform, 'PSID', parts[0]), {
        recipient: { id: 'PSID' }, messaging_type: 'RESPONSE',
        message: { attachment: { type: 'file', payload: { url: doc.payload.url } } },
      });
      assert.deepEqual(metaPayload(platform, 'PSID', parts[1]), { recipient: { id: 'PSID' }, messaging_type: 'RESPONSE', message: { text: '請看附件' } });
    }
  });

  test('WhatsApp puts the text in the caption when it can', () => {
    const [part] = replyParts('whatsapp', { text: '報價單', attachment: doc, sendType: 'document' });
    assert.deepEqual(metaPayload('whatsapp', '85291234567', part), {
      messaging_product: 'whatsapp', recipient_type: 'individual', to: '85291234567', type: 'document',
      document: { link: doc.payload.url, caption: '報價單', filename: '報價.pdf' },
    });
    const [photo] = replyParts('whatsapp', { text: '', attachment: image, sendType: 'image' });
    assert.deepEqual(metaPayload('whatsapp', '1', photo).image, { link: image.payload.url });
  });

  test('WhatsApp sends text separately for audio and for long captions', () => {
    assert.equal(replyParts('whatsapp', { text: 'hi', attachment: voice, sendType: 'audio' }).length, 2);
    assert.equal(replyParts('whatsapp', { text: 'x'.repeat(1025), attachment: image, sendType: 'image' }).length, 2);
    assert.deepEqual(metaPayload('whatsapp', '1', { text: 'hi' }), { messaging_product: 'whatsapp', recipient_type: 'individual', to: '1', type: 'text', text: { body: 'hi' } });
  });

  test('blank replies have nothing to send', () => {
    assert.deepEqual(replyParts('fb', { text: '  ' }), []);
  });

  test('each stored part keeps the original shape with only its own content', () => {
    const contents = JSON.stringify({ recipient: { id: 'PSID' }, messaging_type: 'RESPONSE', message: { text: 'hi', attachments: [image] } });
    assert.deepEqual(JSON.parse(partContents(contents, { attachment: image })), { recipient: { id: 'PSID' }, messaging_type: 'RESPONSE', message: { attachments: [image] } });
    assert.deepEqual(JSON.parse(partContents(contents, { text: 'hi' })), { recipient: { id: 'PSID' }, messaging_type: 'RESPONSE', message: { text: 'hi' } });
    assert.equal(partContents('plain', { text: 'plain' }), 'plain');
  });
});

describe('storage', () => {
  test('stores under a random path and finds the file again from its URL', async () => {
    const saved = await saveStream(Readable.from([PNG]), { mimeType: 'image/png', filename: 'shot.png', maxBytes: MB });
    assert.match(saved.url, /^https:\/\/api\.example\.test\/files\/[a-f0-9]{32}\/shot\.png$/);
    const found = await describeUrl(saved.url);
    assert.equal(found.size, PNG.length);
    assert.equal(found.mime_type, 'image/png');
    assert.equal(await describeUrl('https://elsewhere.test/files/x/shot.png'), null);
    assert.equal(await describeUrl(saved.url.replace(/[a-f0-9]{32}/, '0'.repeat(32))), null);
  });

  test('names cannot leave the file\'s folder and always carry the real extension', () => {
    const type = resolveFileType('application/pdf');
    assert.equal(storedName('../../etc/passwd', type), 'etcpasswd.pdf');
    assert.equal(storedName('.env', type), 'env.pdf');
    assert.equal(storedName('...', type), 'file.pdf');
    assert.equal(storedName('合約 v2.exe', type), '合約 v2.pdf');
  });

  test('refuses files over the limit and leaves nothing behind', async () => {
    await assert.rejects(saveStream(Readable.from([Buffer.alloc(2048)]), { mimeType: 'image/png', filename: 'big.png', maxBytes: 1024 }), { status: 413 });
    assert.deepEqual(fs.readdirSync(path.join(uploadsDir, '.incoming')), []);
  });
});

describe('upload and download routes', () => {
  let server, base;
  before(async () => {
    const app = express();
    const authenticate = (req, res, next) => req.get('authorization') === 'Bearer ok' ? next() : res.status(401).json({ error: '請先登入' });
    app.use('/api/uploads', createUploadsRouter({ authenticate }));
    app.use('/files', filesRouter);
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => server.close());

  const upload = (platform, body, type, name, auth = 'Bearer ok') => fetch(`${base}/api/uploads?platform=${platform}`, {
    method: 'POST', body, headers: { 'Content-Type': type, 'X-File-Name': encodeURIComponent(name), Authorization: auth },
  });

  test('an agent uploads a file and anyone with its link can download it', async () => {
    const response = await upload('fb', PNG, 'image/png', '截圖.png');
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.equal(saved.kind, 'image');
    assert.equal(saved.filename, '截圖.png');
    const download = await fetch(saved.url.replace('https://api.example.test', base));
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('content-type'), 'image/png');
    assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), PNG);
    const folder = new URL(saved.url).pathname.split('/').slice(0, 3).join('/');
    assert.equal((await fetch(`${base}${folder}/`)).status, 404, 'folders are not listed');
    assert.equal((await fetch(`${base}/files/`)).status, 404);
  });

  test('refuses without a login, and files the platform would reject', async () => {
    assert.equal((await upload('fb', PNG, 'image/png', 'a.png', 'Bearer bad')).status, 401);
    const gif = await upload('ig', PNG, 'image/gif', 'a.gif');
    assert.equal(gif.status, 422);
    assert.match((await gif.json()).error, /Instagram/);
    const big = await upload('whatsapp', Buffer.alloc(5 * MB + 1), 'image/png', 'big.png');
    assert.equal(big.status, 422);
    assert.match((await big.json()).error, /5MB/);
    assert.equal((await upload('fb', Buffer.from('<script>'), 'text/html', 'a.html')).status, 422);
  });
});

describe('customer attachments', () => {
  test('a file Meta links to is copied into storage', async () => {
    const source = http.createServer((req, res) => { res.setHeader('Content-Type', 'image/png'); res.end(PNG); });
    await new Promise(resolve => source.listen(0, resolve));
    try {
      const saved = await saveFromUrl(`http://127.0.0.1:${source.address().port}/cdn/photo.png?sig=1`, { filename: 'photo.png' });
      assert.equal(saved.size, PNG.length);
      assert.ok(await describeUrl(saved.url));
    } finally { source.close(); }
  });

  test('a file that cannot be downloaded leaves the message and its text as they were', async () => {
    const contents = { mid: 'm1', text: '看這張', attachments: [{ type: 'image', payload: { url: 'https://127.0.0.1:1/expired.jpg' } }, { type: 'location' }] };
    assert.deepEqual(await storeInboundAttachments(contents, { accessInfo: {} }), contents);
    const whatsapp = { id: 'w1', attachments: [{ type: 'image', media_id: '123', caption: 'hi' }] };
    assert.deepEqual(await storeInboundAttachments(whatsapp, { accessInfo: {} }), whatsapp, 'no token, no download');
  });
});
