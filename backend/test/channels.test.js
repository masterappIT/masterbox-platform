// Removing channels from 社群平台管理, bringing them back, and how each channel's connection is doing.
// The database tests need a migrated PostgreSQL in TEST_DATABASE_URL. Meta and whatsapp-gateway are local servers
// that record what they were asked.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const testDatabase = process.env.TEST_DATABASE_URL;
if (testDatabase) process.env.DATABASE_URL = testDatabase;
delete process.env.REDIS_CONNECTION;
const SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.WHATSAPP_GATEWAY_SECRET = SECRET;
process.env.FB_APP_ID = 'masterbox-app';
process.env.CHANNEL_CHECK_TIMEOUT_MS = '300';

// Stands in for graph.facebook.com: answers[path] is { status, body, delay } for a GET; a send with the token
// "expired" is refused with code 190.
const metaRequests = [];
const answers = {};
const expired = { error: { message: 'Error validating access token: Session has expired', type: 'OAuthException', code: 190 } };
const meta = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const url = new URL(req.url, 'http://meta.test');
    const path = url.pathname.replace(/^\/v\d+\.\d+/, '');
    metaRequests.push({ method: req.method, path, token: url.searchParams.get('access_token') });
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'POST' && path.endsWith('/messages')) {
      if (url.searchParams.get('access_token') === 'expired') { res.statusCode = 400; return res.end(JSON.stringify(expired)); }
      return res.end(JSON.stringify({ message_id: `m_${randomUUID()}` }));
    }
    const answer = answers[path];
    if (!answer) { res.statusCode = 404; return res.end('{}'); }
    setTimeout(() => {
      res.statusCode = answer.status || 200;
      res.end(JSON.stringify(answer.body));
    }, answer.delay || 0);
  });
});
await new Promise(resolve => meta.listen(0, '127.0.0.1', resolve));
process.env.META_BASE_URL = `http://127.0.0.1:${meta.address().port}`;

// Stands in for whatsapp-gateway.
const gatewayRequests = [];
const gateway = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    gatewayRequests.push({ method: req.method, path: req.url });
    if (req.method === 'DELETE') { res.statusCode = 204; return res.end(); }
    res.statusCode = 404;
    res.end('{}');
  });
});
await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
process.env.WHATSAPP_GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;

const { failureStatus } = await import('../lib/messaging/channels.js');

after(() => { meta.close(); gateway.close(); });

const graphFailure = (error, status = 400) => Object.assign(new Error('Meta failed'), { statusCode: status, responseBody: JSON.stringify({ error }) });

describe('what a failed Meta check means', () => {
  test('an expired or revoked token needs Meta connected again', () => {
    assert.equal(failureStatus(graphFailure(expired.error)).state, 'auth_expired');
    assert.equal(failureStatus(graphFailure({ code: 200, message: 'Permissions error' })).state, 'auth_expired');
    assert.equal(failureStatus(graphFailure({ code: 100, error_subcode: 33, message: 'Object does not exist' })).state, 'auth_expired');
  });

  test('anything else is an error to check again later', () => {
    const other = failureStatus(graphFailure({ code: 2, message: 'Service temporarily unavailable' }, 500));
    assert.equal(other.state, 'error');
    assert.match(other.message, /Service temporarily unavailable/);
    assert.equal(failureStatus(new Error('ECONNRESET')).state, 'error');
    assert.match(failureStatus(Object.assign(new Error('timeout'), { timedOut: true })).message, /逾時/);
  });
});

describe('channels in the database', { skip: !testDatabase && 'set TEST_DATABASE_URL to a migrated database' }, () => {
  let prisma, utils, web, resolvers, conversations;
  const run = randomUUID().slice(0, 8);
  const ids = {};
  const who = {};
  const ctx = account => ({ isAuth: true, account });
  const Q = (name, args, account) => resolvers.Query[name](null, args, ctx(account));
  const M = (name, args, account) => resolvers.Mutation[name](null, args, ctx(account));
  const listed = async (account) => Promise.all((await Q('getUserSubscribedChannels', {}, account)).map(async (view) => ({
    ...view, connection: await view.connection(null, ctx(account)),
  })));
  const roomIds = async (account) => (await Q('chatRoomPage', {}, account)).rooms.map(({ id }) => id);
  const waitFor = async (check) => {
    for (let i = 0; i < 100; i += 1) {
      const value = await check();
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error('timed out');
  };
  const channel = (data) => prisma.companyChannel.create({ data: { companyId: ids.company, info: {}, ...data } });
  const inbound = (externalChannelId, platform, chatRoomId, customerId = `${chatRoomId}-customer`) => utils.saveInboundMessage({
    externalChannelId, platform, chatRoomId, contents: '請問有貨嗎？', customer: { id: customerId, name: '客戶' }, externalId: `${run}-${randomUUID()}`,
  });

  before(async () => {
    ({ prisma } = await import('../lib/db/prisma.js'));
    utils = await import('../utils/utils.js');
    web = await import('../lib/messaging/whatsappWeb.js');
    conversations = await import('../lib/messaging/conversations.js');
    resolvers = (await import('../graphQL/resolvers/messageResolvers.js')).default;
    const company = await prisma.company.create({ data: { chineseName: '頻道', englishName: 'Channels', email: `${run}@channels.test`, country: 'TW' } });
    const other = await prisma.company.create({ data: { chineseName: '別家', englishName: 'Other', email: `${run}-other@channels.test`, country: 'TW' } });
    ids.company = company.id;
    ids.other = other.id;
    const account = async (name, role, companyId = company.id) => {
      const record = await prisma.account.create({ data: { email: `${name}-${run}@channels.test`, password: 'x', companyId, role, userInfo: { name } } });
      who[name] = { account_id: record.id, company_id: companyId, role };
    };
    await account('admin', 'admin');
    await account('agent', 'user');
    await account('stranger', 'admin', other.id);
  });

  after(async () => {
    if (!prisma) return;
    for (const companyId of [ids.company, ids.other]) {
      await prisma.message.deleteMany({ where: { companyId } });
      await prisma.chatRoom.deleteMany({ where: { companyId } });
      await prisma.account.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await prisma.$disconnect();
  });

  describe('removing a Meta channel', () => {
    const pageId = `page-del-${run}`;

    before(async () => {
      ids.fb = (await channel({ platform: 'fb', name: '粉專', accessInfo: { id: pageId, page_id: pageId, access_token: 'page-token' } })).id;
      await prisma.accountChannel.create({ data: { accountId: who.agent.account_id, channelId: ids.fb } });
      await inbound(pageId, 'fb', `t_${run}`);
      ids.fbRoom = (await prisma.chatRoom.findFirst({ where: { channelId: ids.fb } })).id;
    });

    test('only an admin of the company can remove it', async () => {
      await assert.rejects(M('deleteChannel', { channel_id: ids.fb }, who.agent), /Admin role required/);
      await assert.rejects(M('deleteChannel', { channel_id: ids.fb }, who.stranger), /找不到這個頻道/);
      assert.equal((await prisma.companyChannel.findUnique({ where: { id: ids.fb } })).deletedAt, null);
    });

    test('a removed channel disappears from the lists and its token is gone', async () => {
      assert.ok((await roomIds(who.agent)).includes(ids.fbRoom));
      assert.equal(await M('deleteChannel', { channel_id: ids.fb }, who.admin), true);

      const saved = await prisma.companyChannel.findUnique({ where: { id: ids.fb } });
      assert.ok(saved.deletedAt);
      assert.equal(saved.enabled, false);
      assert.equal(saved.accessInfo.access_token, undefined);
      assert.equal(saved.accessInfo.page_id, pageId);
      for (const account of [who.admin, who.agent]) {
        assert.ok(!(await Q('getUserSubscribedChannels', {}, account)).some(({ channel_id }) => channel_id === ids.fb));
        assert.ok(!(await roomIds(account)).includes(ids.fbRoom));
      }
      await assert.rejects(conversations.findAccountRoom(who.agent, { id: ids.fbRoom }), /找不到/);
      await assert.rejects(M('deleteChannel', { channel_id: ids.fb }, who.admin), /找不到這個頻道/);
      await assert.rejects(M('setChannelEnabled', { channel_id: ids.fb, enabled: true }, who.admin), /找不到這個頻道/);
    });

    test('webhooks for a removed channel are not taken in', async () => {
      const before = await prisma.message.count({ where: { companyId: ids.company } });
      assert.equal(await inbound(pageId, 'fb', `t_${run}`), null);
      assert.equal(await utils.findChannelToken(pageId, 'page'), null);
      assert.equal(await prisma.message.count({ where: { companyId: ids.company } }), before);
    });

    test('connecting the same page again brings it back with its conversations and agents', async () => {
      const { saved, skipped } = await utils.saveMetaChannels({
        companyId: ids.company, accountId: who.admin.account_id,
        facebookPages: [{ id: pageId, name: '粉專（新）', access_token: 'new-token' }], instagramAccounts: [], whatsappAccounts: [],
      });
      assert.deepEqual(skipped, []);
      assert.equal(saved[0].id, ids.fb);
      const back = await prisma.companyChannel.findUnique({ where: { id: ids.fb } });
      assert.equal(back.deletedAt, null);
      assert.equal(back.enabled, true);
      assert.equal(back.accessInfo.access_token, 'new-token');
      assert.ok((await roomIds(who.agent)).includes(ids.fbRoom));
      assert.ok(await inbound(pageId, 'fb', `t_${run}`));
    });

    test('a page another company removed can be connected here', async () => {
      const shared = `page-shared-${run}`;
      await prisma.companyChannel.create({ data: { companyId: ids.other, platform: 'fb', name: '別家粉專', accessInfo: { id: shared, page_id: shared }, info: {}, enabled: false, deletedAt: new Date() } });
      const { saved, skipped } = await utils.saveMetaChannels({
        companyId: ids.company, accountId: who.admin.account_id,
        facebookPages: [{ id: shared, name: '接手的粉專', access_token: 'token' }], instagramAccounts: [], whatsappAccounts: [],
      });
      assert.deepEqual(skipped, []);
      assert.equal(saved[0].companyId, ids.company);
      assert.equal((await inbound(shared, 'fb', `shared_${run}`)).companyId, ids.company);
    });
  });

  describe('removing a WhatsApp number connected by QR code', () => {
    const phone = `+8529${run.replace(/\D/g, '').padEnd(7, '3').slice(0, 7)}`;
    const chat = `${phone.slice(1)}@c.us`;

    test('a number no phone ever connected is deleted outright', async () => {
      const pending = await channel({ platform: 'whatsapp', name: 'WhatsApp（待連結）', accessInfo: { provider: 'web' } });
      assert.equal(await M('deleteChannel', { channel_id: pending.id }, who.admin), true);
      assert.equal(await prisma.companyChannel.findUnique({ where: { id: pending.id } }), null);
      assert.ok(gatewayRequests.some(({ method, path }) => method === 'DELETE' && path === `/channels/${pending.id}`));
    });

    test('a connected number is logged out, and scanning it again brings back its conversations', async () => {
      const first = await channel({ platform: 'whatsapp', name: '門市', accessInfo: { provider: 'web', phone } });
      await prisma.companyChannel.update({ where: { id: first.id }, data: { accessInfo: { provider: 'web', phone, id: `waweb:${first.id}` } } });
      await prisma.accountChannel.create({ data: { accountId: who.agent.account_id, channelId: first.id } });
      await inbound(`waweb:${first.id}`, 'whatsapp', chat, chat);
      const room = await prisma.chatRoom.findFirst({ where: { channelId: first.id } });

      assert.equal(await M('deleteChannel', { channel_id: first.id }, who.admin), true);
      assert.ok(gatewayRequests.some(({ method, path }) => method === 'DELETE' && path === `/channels/${first.id}`));
      assert.ok((await prisma.companyChannel.findUnique({ where: { id: first.id } })).deletedAt);
      // The gateway forgets a removed channel the next time it reports on it.
      assert.equal((await web.handleGatewayEvent({ channelId: first.id, type: 'status', status: { state: 'ready' } })).status, 410);

      const second = await channel({ platform: 'whatsapp', name: 'WhatsApp（待連結）', accessInfo: { provider: 'web' } });
      await prisma.companyChannel.update({ where: { id: second.id }, data: { accessInfo: { provider: 'web', id: `waweb:${second.id}` } } });
      const answer = await web.handleGatewayEvent({ channelId: second.id, type: 'status', status: { state: 'syncing', phone } });
      assert.deepEqual(answer.body, {});

      const now = await prisma.companyChannel.findUnique({ where: { id: second.id } });
      assert.equal(now.name, '門市');
      assert.equal(now.accessInfo.phone, phone);
      assert.equal(await prisma.companyChannel.findUnique({ where: { id: first.id } }), null);
      assert.equal((await prisma.chatRoom.findUnique({ where: { id: room.id } })).channelId, second.id);
      assert.equal(await prisma.messageRecipient.count({ where: { channelId: first.id } }), 0);
      assert.ok((await roomIds(who.agent)).includes(room.id));
    });

    test('a number another company removed can be scanned here', async () => {
      const otherPhone = `+8536${run.replace(/\D/g, '').padEnd(7, '4').slice(0, 7)}`;
      await prisma.companyChannel.create({ data: { companyId: ids.other, platform: 'whatsapp', name: '別家', accessInfo: { provider: 'web', phone: otherPhone }, info: {}, enabled: false, deletedAt: new Date() } });
      const mine = await channel({ platform: 'whatsapp', name: 'WhatsApp（待連結）', accessInfo: { provider: 'web' } });
      const answer = await web.handleGatewayEvent({ channelId: mine.id, type: 'status', status: { state: 'syncing', phone: otherPhone, name: '新門市' } });
      assert.deepEqual(answer.body, {});
      assert.equal((await prisma.companyChannel.findUnique({ where: { id: mine.id } })).accessInfo.phone, otherPhone);
    });
  });

  describe('connection status', () => {
    const page = `page-conn-${run}`;
    const ig = `ig-conn-${run}`;
    const number = `pn-conn-${run}`;
    const waba = `waba-conn-${run}`;
    const ours = { data: [{ id: 'masterbox-app', name: 'MasterBox', subscribed_fields: ['messages', 'messaging_postbacks'] }] };
    const connectionOf = async (channelId, account = who.admin) => (await listed(account)).find(({ channel_id }) => channel_id === channelId).connection;
    const asked = (path) => metaRequests.filter((request) => request.path === path).length;

    before(async () => {
      ids.page = (await channel({ platform: 'fb', name: '狀態粉專', accessInfo: { id: page, page_id: page, access_token: 'page-token' } })).id;
      ids.ig = (await channel({ platform: 'ig', name: '狀態 IG', accessInfo: { id: ig, page_id: page, access_token: 'page-token' } })).id;
      ids.wa = (await channel({
        platform: 'whatsapp', name: '狀態 WhatsApp',
        accessInfo: { id: number, phone_number_id: number, whatsapp_business_account_id: waba, access_token: 'wa-token' }, info: {},
      })).id;
      ids.line = (await channel({ platform: 'line', name: 'LINE', accessInfo: { id: `line-${run}` } })).id;
    });

    test('a subscribed page is connected, and is not asked again for 10 minutes', async () => {
      answers[`/${page}/subscribed_apps`] = { body: ours };
      assert.equal((await connectionOf(ids.page)).state, 'ok');
      const times = asked(`/${page}/subscribed_apps`);
      assert.equal((await connectionOf(ids.page)).state, 'ok');
      assert.equal(asked(`/${page}/subscribed_apps`), times);
    });

    test('an agent sees the last check without asking Meta', async () => {
      await prisma.accountChannel.create({ data: { accountId: who.agent.account_id, channelId: ids.ig } });
      const hourAgo = new Date(Date.now() - 3600000).toISOString();
      await prisma.companyChannel.update({ where: { id: ids.ig }, data: { info: { connection: { state: 'ok', message: null, checked_at: hourAgo } } } });
      const times = metaRequests.length;
      assert.deepEqual(await connectionOf(ids.ig, who.agent), { state: 'ok', message: null, checked_at: hourAgo });
      assert.equal(metaRequests.length, times);
    });

    test('checking again asks Meta now: an expired token needs Meta connected again', async () => {
      answers[`/${page}/subscribed_apps`] = { status: 400, body: expired };
      const checked = await M('checkChannelConnection', { channel_id: ids.page }, who.admin);
      assert.equal(checked.connection.state, 'auth_expired');
      assert.match(checked.connection.message, /重新串接/);
      assert.equal((await connectionOf(ids.page)).state, 'auth_expired');
      await assert.rejects(M('checkChannelConnection', { channel_id: ids.page }, who.agent), /Admin role required/);
    });

    test('a page that does not send its messages to MasterBox is not subscribed', async () => {
      answers[`/${page}/subscribed_apps`] = { body: { data: [{ id: 'someone-else' }] } };
      assert.equal((await M('checkChannelConnection', { channel_id: ids.ig }, who.admin)).connection.state, 'not_subscribed');
      answers[`/${page}/subscribed_apps`] = { body: { data: [{ id: 'masterbox-app', subscribed_fields: ['feed'] }] } };
      assert.equal((await M('checkChannelConnection', { channel_id: ids.page }, who.admin)).connection.state, 'not_subscribed');
    });

    test('a WhatsApp number shows its phone number and Meta status', async () => {
      answers[`/${number}`] = { body: { display_phone_number: '+886 2 2345 6789', status: 'CONNECTED', quality_rating: 'GREEN' } };
      answers[`/${waba}/subscribed_apps`] = { body: ours };
      const checked = await M('checkChannelConnection', { channel_id: ids.wa }, who.admin);
      assert.equal(checked.connection.state, 'ok');
      assert.equal(checked.phone, '+886 2 2345 6789');

      answers[`/${number}`] = { body: { display_phone_number: '+886 2 2345 6789', status: 'FLAGGED' } };
      const flagged = await M('checkChannelConnection', { channel_id: ids.wa }, who.admin);
      assert.equal(flagged.connection.state, 'error');
      assert.match(flagged.connection.message, /標記/);
    });

    test('a slow Meta does not hold up the list', async () => {
      answers[`/${number}`] = { body: { status: 'CONNECTED' }, delay: 2000 };
      const started = Date.now();
      const checked = await M('checkChannelConnection', { channel_id: ids.wa }, who.admin);
      assert.ok(Date.now() - started < 1500);
      assert.equal(checked.connection.state, 'error');
      assert.match(checked.connection.message, /逾時/);
    });

    test('disabled channels and platforms without a check say so', async () => {
      assert.equal((await connectionOf(ids.line)).state, 'unknown');
      await M('setChannelEnabled', { channel_id: ids.line, enabled: false }, who.admin);
      assert.equal((await connectionOf(ids.line)).state, 'disabled');
      await M('setChannelEnabled', { channel_id: ids.line, enabled: true }, who.admin);
    });

    test('a reply Meta refuses with code 190 marks the channel at once', async () => {
      const sendPage = `page-send-${run}`;
      const sending = await channel({ platform: 'fb', name: '發送粉專', accessInfo: { id: sendPage, page_id: sendPage, access_token: 'expired' }, info: { connection: { state: 'ok', checked_at: new Date().toISOString() } } });
      await inbound(sendPage, 'fb', `send_${run}`);
      await assert.rejects(utils.handleSendMessage(who.admin.account_id, `send_${run}`, '您好', sending.id), /授權已失效/);
      await waitFor(async () => (await connectionOf(sending.id)).state === 'auth_expired');
    });
  });
});
