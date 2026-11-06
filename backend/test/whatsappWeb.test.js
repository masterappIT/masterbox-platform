// WhatsApp connected by QR code, through whatsapp-gateway. The gateway is a local server that records what it was asked.
// The database tests need a migrated PostgreSQL in TEST_DATABASE_URL.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const testDatabase = process.env.TEST_DATABASE_URL;
if (testDatabase) process.env.DATABASE_URL = testDatabase;
delete process.env.REDIS_CONNECTION;
const SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.WHATSAPP_GATEWAY_SECRET = SECRET;
process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'waweb-uploads-'));

// Stands in for whatsapp-gateway.
const gatewayRequests = [];
const sessions = new Map();
let nextId = 0;
const gateway = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const parsed = body ? JSON.parse(body) : null;
    gatewayRequests.push({ method: req.method, path: req.url, body: parsed, authorized: req.headers.authorization === `Bearer ${SECRET}` });
    const [, , channelId, action, , tail] = req.url.split('/');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'PUT') {
      sessions.set(channelId, { channel_id: channelId, state: 'qr', qr: 'data:image/png;base64,QR' });
      return res.end(JSON.stringify(sessions.get(channelId)));
    }
    if (req.method === 'GET' && !action) {
      if (!sessions.has(channelId)) { res.statusCode = 404; return res.end('{}'); }
      return res.end(JSON.stringify(sessions.get(channelId)));
    }
    if (req.method === 'DELETE') { sessions.delete(channelId); res.statusCode = 204; return res.end(); }
    if (req.method === 'POST' && action === 'messages') {
      nextId += 1;
      return res.end(JSON.stringify({ id: `true_${parsed.to}_OUT${nextId}` }));
    }
    if (req.method === 'GET' && tail === 'media') {
      res.setHeader('Content-Type', 'image/png');
      // The smallest PNG: the 8-byte signature is enough for storage to accept it as a picture.
      return res.end(Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4b20000000049454e44ae426082', 'hex'));
    }
    res.statusCode = 404;
    res.end('{}');
  });
});
await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
process.env.WHATSAPP_GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;

const { replyWindow } = await import('../lib/messaging/replyWindow.js');
const { isFromGateway, isWebChannel } = await import('../lib/messaging/whatsappGateway.js');

after(() => gateway.close());

describe('WhatsApp by QR code', () => {
  test('a QR-connected number can always be answered', () => {
    const window = replyWindow({ platform: 'whatsapp', lastCustomerMessageAt: new Date(Date.now() - 30 * 24 * 3600000), noLimit: true });
    assert.equal(window.state, 'no_limit');
    assert.equal(window.templateRequired, false);
    assert.equal(window.closesAt, null);
  });

  test('only the gateway secret is accepted', () => {
    assert.equal(isFromGateway(`Bearer ${SECRET}`), true);
    assert.equal(isFromGateway('Bearer wrong'), false);
    assert.equal(isFromGateway(undefined), false);
  });

  test('a Cloud API WhatsApp channel is not a QR channel', () => {
    assert.equal(isWebChannel({ platform: 'whatsapp', accessInfo: { phone_number_id: '1', access_token: 't' } }), false);
    assert.equal(isWebChannel({ platform: 'whatsapp', accessInfo: { provider: 'web' } }), true);
  });
});

describe('WhatsApp by QR code in the database', { skip: !testDatabase && 'set TEST_DATABASE_URL to a migrated database' }, () => {
  let prisma, web, utils, conversations;
  const run = randomUUID().slice(0, 8);
  const phone = `+8869${run.replace(/\D/g, '').padEnd(8, '1').slice(0, 8)}`;
  const customer = `8869${run.replace(/\D/g, '').padEnd(8, '2').slice(0, 8)}@c.us`;
  const ids = {};
  let admin;

  const event = (type, fields) => web.handleGatewayEvent({ channelId: ids.channel, type, ...fields });
  const waitFor = async (check) => {
    for (let i = 0; i < 100; i += 1) {
      const value = await check();
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('timed out');
  };

  before(async () => {
    ({ prisma } = await import('../lib/db/prisma.js'));
    web = await import('../lib/messaging/whatsappWeb.js');
    utils = await import('../utils/utils.js');
    conversations = await import('../lib/messaging/conversations.js');
    const company = await prisma.company.create({ data: { chineseName: '測試', englishName: 'Test', email: `${run}@waweb.test`, country: 'TW' } });
    ids.company = company.id;
    const account = await prisma.account.create({ data: { email: `admin-${run}@waweb.test`, password: 'x', role: 'admin', companyId: company.id } });
    const agent = await prisma.account.create({ data: { email: `agent-${run}@waweb.test`, password: 'x', role: 'user', companyId: company.id } });
    ids.agent = agent.id;
    admin = { account_id: account.id, company_id: company.id, role: 'admin' };
  });

  after(async () => {
    if (!prisma) return;
    await prisma.message.deleteMany({ where: { companyId: ids.company } });
    await prisma.chatRoom.deleteMany({ where: { companyId: ids.company } });
    await prisma.companyChannel.deleteMany({ where: { companyId: ids.company } });
    await prisma.account.deleteMany({ where: { companyId: ids.company } });
    await prisma.company.delete({ where: { id: ids.company } });
    await prisma.$disconnect();
    fs.rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  });

  test('connecting makes a channel waiting for a scan, and shows its QR code', async () => {
    const connection = await web.connectWhatsappWeb(admin);
    ids.channel = connection.channel_id;
    assert.equal(connection.state, 'qr');
    assert.equal(connection.qr, 'data:image/png;base64,QR');
    const channel = await prisma.companyChannel.findUnique({ where: { id: ids.channel }, include: { accounts: true } });
    assert.equal(channel.platform, 'whatsapp');
    assert.equal(channel.accessInfo.provider, 'web');
    assert.deepEqual(channel.accounts.map(({ accountId }) => accountId), [admin.account_id]);
    assert.ok(gatewayRequests.every(({ authorized }) => authorized));
  });

  test('the scanned number becomes the channel, named after the WhatsApp account', async () => {
    assert.deepEqual(await event('status', { status: { state: 'syncing', phone, name: '台北門市' } }), { status: 200, body: {} });
    const channel = await prisma.companyChannel.findUnique({ where: { id: ids.channel } });
    assert.equal(channel.accessInfo.phone, phone);
    assert.equal(channel.name, '台北門市');
    assert.equal(channel.info.wa_web.state, 'syncing');
  });

  test('a customer message is stored with its picture, and can be answered after any time', async () => {
    const externalId = `false_${customer}_IN1`;
    await event('message', {
      message: {
        externalId, chatId: customer, fromMe: false, sentAt: new Date().toISOString(),
        contents: { id: externalId, timestamp: '1', text: '有貨嗎', attachments: [{ type: 'image', mime_type: 'image/png', wa_web_media: true }] },
        customer: { id: customer, name: '王先生', phone: '+886900000000' },
      },
    });
    const message = await prisma.message.findUnique({ where: { externalId } });
    assert.equal(message.createdBy, null);
    const contents = JSON.parse(message.contents);
    assert.equal(contents.text, '有貨嗎');
    assert.match(contents.attachments[0].payload.url, /\/files\/[a-f0-9]{32}\//);
    assert.equal(contents.attachments[0].wa_web_media, undefined);
    assert.ok(gatewayRequests.some(({ path: p }) => p === `/channels/${ids.channel}/messages/${encodeURIComponent(externalId)}/media`));

    // Move the customer's message back a month: a QR number has no reply window.
    await prisma.message.update({ where: { id: message.id }, data: { createdAt: new Date(Date.now() - 30 * 24 * 3600000) } });
    const room = await prisma.chatRoom.findFirst({ where: { channelId: ids.channel, chatRoomId: customer } });
    const [view] = await conversations.roomViews(admin, [room.id]);
    assert.equal(view.replyWindow.state, 'no_limit');
    assert.equal(view.customer.name, '王先生');

    const reply = await utils.handleSendMessage(admin.account_id, customer, '有的，今天可以出貨', ids.channel);
    const [sent] = gatewayRequests.filter(({ method, path: p }) => method === 'POST' && p === `/channels/${ids.channel}/messages`).slice(-1);
    assert.deepEqual(sent.body, { to: customer, text: '有的，今天可以出貨' });
    assert.equal(reply.externalId, `true_${customer}_OUT${nextId}`);
    assert.equal(reply.createdBy, admin.account_id);
  });

  test('templates are not offered on a QR number', async () => {
    const room = await prisma.chatRoom.findFirst({ where: { channelId: ids.channel, chatRoomId: customer } });
    await assert.rejects(utils.listWhatsappTemplates(room), /不需要範本/);
  });

  test('a message sent from the phone itself is stored as the company\'s', async () => {
    const externalId = `true_${customer}_PHONE1`;
    await event('message', { message: { externalId, chatId: customer, fromMe: true, sentAt: new Date().toISOString(), contents: { id: externalId, text: '我用手機回的' }, customer: { id: customer } } });
    const message = await prisma.message.findUnique({ where: { externalId } });
    assert.equal(message.createdBy, admin.account_id);
    // Reported twice, it is stored once.
    await event('message', { message: { externalId, chatId: customer, fromMe: true, sentAt: new Date().toISOString(), contents: { id: externalId, text: '我用手機回的' }, customer: { id: customer } } });
    assert.equal(await prisma.message.count({ where: { externalId } }), 1);
  });

  test('history is stored in the background, without downloading old files', async () => {
    const other = customer.replace('@c.us', '9@c.us');
    const old = new Date(Date.now() - 90 * 24 * 3600000).toISOString();
    const recent = new Date(Date.now() - 3600000).toISOString();
    const before = gatewayRequests.length;
    const answer = await event('history', {
      conversations: [{
        chatId: other, customer: { id: other, name: '李小姐' },
        messages: [
          { externalId: `false_${other}_H1`, chatId: other, fromMe: false, sentAt: old, contents: { id: `false_${other}_H1`, attachments: [{ type: 'image', wa_web_media: true }] } },
          { externalId: `true_${other}_H2`, chatId: other, fromMe: true, sentAt: recent, contents: { id: `true_${other}_H2`, text: '謝謝您' } },
        ],
      }],
    });
    assert.equal(answer.status, 202);
    const stored = await waitFor(async () => (await prisma.message.count({ where: { externalId: { in: [`false_${other}_H1`, `true_${other}_H2`] } } })) === 2);
    assert.ok(stored);
    const oldMessage = await prisma.message.findUnique({ where: { externalId: `false_${other}_H1` } });
    assert.equal(JSON.parse(oldMessage.contents).attachments[0].payload, undefined);
    assert.equal(gatewayRequests.slice(before).filter(({ path: p }) => p.endsWith('/media')).length, 0);
    const reply = await prisma.message.findUnique({ where: { externalId: `true_${other}_H2` } });
    assert.equal(reply.createdBy, admin.account_id);
  });

  test('scanning again with a different phone is turned away', async () => {
    await event('status', { status: { state: 'logged_out', error: '請重新掃碼' } });
    await web.connectWhatsappWeb(admin, ids.channel);
    const answer = await event('status', { status: { state: 'syncing', phone: '+85291234567', name: 'Other' } });
    assert.equal(answer.body.action, 'logout');
    assert.equal(answer.body.reason, 'wrong_number');
    const channel = await prisma.companyChannel.findUnique({ where: { id: ids.channel } });
    assert.equal(channel.accessInfo.phone, phone);
    assert.equal(channel.info.wa_web.state, 'rejected');
  });

  test('a number already connected in one channel cannot connect another', async () => {
    const second = await web.connectWhatsappWeb(admin);
    const answer = await web.handleGatewayEvent({ channelId: second.channel_id, type: 'status', status: { state: 'syncing', phone } });
    assert.equal(answer.body.reason, 'already_connected');
    // Never connected, so cancelling removes it.
    assert.equal(await web.cancelWhatsappWeb(admin, second.channel_id), true);
    assert.equal(await prisma.companyChannel.findUnique({ where: { id: second.channel_id } }), null);
    // A channel that was connected stays.
    assert.equal(await web.cancelWhatsappWeb(admin, ids.channel), false);
  });

  test('a new channel whose QR code ran out without a scan is removed', async () => {
    const abandoned = await web.connectWhatsappWeb(admin);
    const answer = await web.handleGatewayEvent({ channelId: abandoned.channel_id, type: 'status', status: { state: 'qr_timeout' } });
    assert.equal(answer.status, 410);
    assert.equal(await prisma.companyChannel.findUnique({ where: { id: abandoned.channel_id } }), null);
    // A connected channel whose reconnect code ran out stays.
    await event('status', { status: { state: 'qr_timeout' } });
    assert.ok(await prisma.companyChannel.findUnique({ where: { id: ids.channel } }));
  });

  test('naming the channel adds its agents', async () => {
    const channel = await web.updateWhatsappWebChannel(admin, ids.channel, { name: '  台北門市客服 ', agentIds: [ids.agent] });
    assert.equal(channel.name, '台北門市客服');
    assert.ok(await prisma.accountChannel.findFirst({ where: { channelId: ids.channel, accountId: ids.agent } }));
  });

  test('events for a channel that no longer exists tell the gateway to forget it', async () => {
    const answer = await web.handleGatewayEvent({ channelId: 'missing-channel', type: 'status', status: { state: 'ready' } });
    assert.equal(answer.status, 410);
  });
});
