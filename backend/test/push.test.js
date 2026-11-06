// Push notifications: talking to APNs over HTTP/2 (against a local server), choosing who hears about a message, and
// keeping each phone's token. The database tests need a migrated PostgreSQL in TEST_DATABASE_URL; they make and remove
// their own company.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, createVerify } from 'node:crypto';
import http2 from 'node:http2';
import { readApnsConfig, createApnsSender, readApnsResponse } from '../lib/push/apns.js';
import { notificationRecipients, notificationFor } from '../lib/push/notificationContent.js';

const testDatabase = process.env.TEST_DATABASE_URL;
if (testDatabase) process.env.DATABASE_URL = testDatabase;
delete process.env.REDIS_CONNECTION;

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const settings = { APNS_KEY_FILE: '/run/secrets/masterbox/apns-key.p8', APNS_KEY_ID: 'KEY123', APNS_TEAM_ID: 'TEAM123', APNS_TOPIC: 'com.masterbox.masterappinc' };
const config = { key: privateKey, keyId: 'KEY123', teamId: 'TEAM123', topic: 'com.masterbox.masterappinc' };
const deviceToken = name => Buffer.from(name.padEnd(32, '-')).toString('hex');

describe('the APNs key', () => {
  test('push stays off without one', () => {
    assert.equal(readApnsConfig({}), null);
  });

  test('is read from the mounted file', () => {
    const read = readApnsConfig(settings, (path) => {
      assert.equal(path, settings.APNS_KEY_FILE);
      return privateKey;
    });
    assert.deepEqual(read, config);
  });

  test('a broken setup is an error rather than silence', () => {
    assert.throws(() => readApnsConfig({ APNS_KEY_FILE: '/x.p8' }, () => privateKey), /also needs/);
    assert.throws(() => readApnsConfig(settings, () => { throw new Error('ENOENT'); }), /can't be read/);
    assert.throws(() => readApnsConfig(settings, () => 'not a key'), /not a \.p8/);
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
    assert.throws(() => readApnsConfig(settings, () => rsa.privateKey), /not a \.p8/);
  });
});

describe('sending to APNs', () => {
  // A local HTTP/2 server standing in for Apple, answering each request with what the test sets.
  const startServer = async (answer) => {
    const requests = [];
    const sessions = new Set();
    const server = http2.createServer();
    server.on('session', (session) => {
      sessions.add(session);
      session.on('close', () => sessions.delete(session));
    });
    server.on('stream', (stream, headers) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        const request = { headers, body: Buffer.concat(chunks).toString() };
        requests.push(request);
        const reply = answer(request, requests.length);
        if (!reply) return;
        stream.respond({ ':status': reply.status });
        stream.end(reply.body === undefined ? undefined : JSON.stringify(reply.body));
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return {
      requests,
      sessions,
      origin: `http://127.0.0.1:${server.address().port}`,
      stop: () => new Promise((resolve) => {
        sessions.forEach(session => session.destroy());
        server.close(resolve);
      }),
    };
  };

  test('signs in with the key and sends to the phone with the topic', async () => {
    const apns = await startServer(() => ({ status: 200 }));
    const sender = createApnsSender(config, { origin: apns.origin });
    try {
      const payload = { aps: { alert: { title: '小美', body: '您好' } }, roomId: 'room-1' };
      assert.deepEqual(await sender.send('aa11', payload), { ok: true });
      assert.deepEqual(await sender.send('bb22', payload), { ok: true });

      const [first, second] = apns.requests;
      assert.equal(first.headers[':method'], 'POST');
      assert.equal(first.headers[':path'], '/3/device/aa11');
      assert.equal(second.headers[':path'], '/3/device/bb22');
      assert.equal(first.headers['apns-topic'], 'com.masterbox.masterappinc');
      assert.equal(first.headers['apns-push-type'], 'alert');
      assert.equal(first.headers['apns-priority'], '10');
      assert.deepEqual(JSON.parse(first.body), payload);
      assert.equal(apns.sessions.size, 1, 'one connection is kept for both');

      const [scheme, token] = first.headers.authorization.split(' ');
      assert.equal(scheme, 'bearer');
      assert.equal(second.headers.authorization, first.headers.authorization, 'the sign-in token is reused');
      const [header, claims, signature] = token.split('.');
      const verify = createVerify('SHA256');
      verify.update(`${header}.${claims}`);
      assert.ok(verify.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, signature, 'base64url'), 'signed with the key');
      const decoded = text => JSON.parse(Buffer.from(text, 'base64url').toString());
      assert.equal(decoded(header).alg, 'ES256');
      assert.equal(decoded(header).kid, 'KEY123');
      assert.equal(decoded(claims).iss, 'TEAM123');
    } finally {
      sender.close();
      await apns.stop();
    }
  });

  test('the sign-in token is replaced within the hour Apple allows', async () => {
    const apns = await startServer(() => ({ status: 200 }));
    let time = 1_800_000_000_000;
    const sender = createApnsSender(config, { origin: apns.origin, now: () => time });
    try {
      await sender.send('aa11', {});
      time += 30 * 60 * 1000;
      await sender.send('aa11', {});
      time += 20 * 60 * 1000;
      await sender.send('aa11', {});
      const tokens = apns.requests.map(({ headers }) => headers.authorization);
      assert.equal(tokens[0], tokens[1]);
      assert.notEqual(tokens[1], tokens[2]);
    } finally {
      sender.close();
      await apns.stop();
    }
  });

  test('says which tokens will never work again', async () => {
    const answers = {
      '/3/device/gone': { status: 410, body: { reason: 'Unregistered', timestamp: 1 } },
      '/3/device/bad': { status: 400, body: { reason: 'BadDeviceToken' } },
      '/3/device/topic': { status: 400, body: { reason: 'DeviceTokenNotForTopic' } },
      '/3/device/busy': { status: 503, body: { reason: 'ServiceUnavailable' } },
    };
    const apns = await startServer(({ headers }) => answers[headers[':path']]);
    const sender = createApnsSender(config, { origin: apns.origin });
    try {
      assert.equal((await sender.send('gone', {})).unregistered, true);
      assert.equal((await sender.send('bad', {})).unregistered, true);
      // These say nothing against the phone, so its token stays.
      assert.deepEqual(await sender.send('topic', {}), { ok: false, unregistered: false, reason: 'DeviceTokenNotForTopic' });
      assert.deepEqual(await sender.send('busy', {}), { ok: false, unregistered: false, reason: 'ServiceUnavailable' });
    } finally {
      sender.close();
      await apns.stop();
    }
  });

  test('a rejected sign-in token is replaced on the next send', async () => {
    let time = 1_800_000_000_000;
    const apns = await startServer((_, count) => (count === 1 ? { status: 403, body: { reason: 'ExpiredProviderToken' } } : { status: 200 }));
    const sender = createApnsSender(config, { origin: apns.origin, now: () => time });
    try {
      assert.equal((await sender.send('aa11', {})).ok, false);
      time += 1000;
      assert.equal((await sender.send('aa11', {})).ok, true);
      assert.notEqual(apns.requests[0].headers.authorization, apns.requests[1].headers.authorization);
    } finally {
      sender.close();
      await apns.stop();
    }
  });

  test('a connection Apple closed is replaced and the notification still goes out', async () => {
    const apns = await startServer(() => ({ status: 200 }));
    const sender = createApnsSender(config, { origin: apns.origin });
    try {
      await sender.send('aa11', {});
      apns.sessions.forEach(session => session.destroy());
      await new Promise(resolve => setTimeout(resolve, 50));
      assert.deepEqual(await sender.send('aa11', {}), { ok: true });
      assert.equal(apns.requests.length, 2);
    } finally {
      sender.close();
      await apns.stop();
    }
  });

  test('a silent server times out without sending twice', async () => {
    const apns = await startServer(() => null);
    const sender = createApnsSender(config, { origin: apns.origin, timeoutMs: 50 });
    try {
      await assert.rejects(sender.send('aa11', {}), /did not answer/);
      assert.equal(apns.requests.length, 1);
    } finally {
      sender.close();
      await apns.stop();
    }
  });

  test('an answer without a reason falls back to its status', () => {
    assert.deepEqual(readApnsResponse(500, 'oops'), { ok: false, unregistered: false, reason: 'HTTP 500' });
    assert.equal(readApnsResponse(410, '').unregistered, true);
  });
});

describe('who hears about a customer message', () => {
  test('the agent of an assigned conversation', () => {
    assert.deepEqual(notificationRecipients({ assigneeId: 'b' }, ['a', 'b', 'c']), ['b']);
  });

  test('everyone in the channel while nobody handles it', () => {
    assert.deepEqual(notificationRecipients({ assigneeId: null }, ['a', 'b']), ['a', 'b']);
  });

  test('everyone in the channel when its agent lost the channel or was disabled', () => {
    assert.deepEqual(notificationRecipients({ assigneeId: 'gone' }, ['a', 'b']), ['a', 'b']);
  });
});

test('a notification names the customer and channel, previews the message, and opens the conversation', () => {
  const room = {
    id: 'room-1', chatRoomId: 'psid-1', channelId: 'channel-1', platform: 'fb',
    users: [{ id: 'psid-1', first_name: '小美', last_name: '王' }, { id: 'channel-1', name: '粉專' }],
  };
  const message = { id: 'm-1', contents: JSON.stringify({ attachments: [{ type: 'image', payload: { url: 'https://x/y.jpg' } }] }) };
  assert.deepEqual(notificationFor({ room, channelName: '官方粉專', message }), {
    aps: { alert: { title: '小美王 · 官方粉專', body: '[圖片]' }, sound: 'default', 'thread-id': 'room-1' },
    type: 'message',
    roomId: 'room-1',
    chatRoomId: 'psid-1',
    channelId: 'channel-1',
    platform: 'fb',
    messageId: 'm-1',
  });

  const long = notificationFor({ room: { ...room, users: [] }, message: { id: 'm-2', contents: '好'.repeat(400) } });
  assert.equal(long.aps.alert.title, '客戶');
  assert.equal([...long.aps.alert.body].length, 180);

  const longest = notificationFor({ room: { ...room, id: 'r'.repeat(40), users: [{ id: 'psid-1', first_name: '😀'.repeat(400) }] }, channelName: '😀'.repeat(400), message: { id: 'm-3', contents: '😀'.repeat(400) } });
  assert.ok(Buffer.byteLength(JSON.stringify(longest)) < 4096, 'stays under the APNs limit');
});

describe('device tokens and notifications', { skip: !testDatabase && 'set TEST_DATABASE_URL to a migrated database' }, () => {
  let prisma, resolvers, notifyCustomerMessage;
  const run = randomUUID().slice(0, 8);
  const ids = {};
  const ctx = account => ({ isAuth: true, account });
  const M = (name, args, account) => resolvers.Mutation[name](null, args, ctx(account));

  before(async () => {
    ({ prisma } = await import('../lib/db/prisma.js'));
    resolvers = (await import('../graphQL/resolvers/pushResolvers.js')).default;
    ({ notifyCustomerMessage } = await import('../lib/push/notifications.js'));
    const company = await prisma.company.create({ data: { chineseName: '推播', englishName: 'Push', email: `${run}@push.test`, country: 'TW' } });
    const other = await prisma.company.create({ data: { chineseName: '別家', englishName: 'Other', email: `${run}-o@push.test`, country: 'TW' } });
    ids.company = company.id;
    ids.other = other.id;
    const account = (email, role, companyId = company.id) => prisma.account.create({ data: { email: `${run}-${email}`, password: 'x', role, companyId } });
    const [admin, agent, outsider, foreign] = await Promise.all([account('admin@push.test', 'admin'), account('agent@push.test', 'user'),
      account('outsider@push.test', 'user'), account('foreign@push.test', 'admin', other.id)]);
    Object.assign(ids, { admin: admin.id, agent: agent.id, outsider: outsider.id, foreign: foreign.id });
    const channel = await prisma.companyChannel.create({ data: { companyId: company.id, platform: 'fb', name: '官方粉專', accessInfo: {}, info: {} } });
    ids.channel = channel.id;
    await prisma.accountChannel.create({ data: { accountId: agent.id, channelId: channel.id } });
    const room = await prisma.chatRoom.create({ data: { companyId: company.id, platform: 'fb', channelId: channel.id, chatRoomId: `psid-${run}`, users: [{ id: `psid-${run}`, first_name: '小美' }] } });
    ids.room = room.id;
  });

  after(async () => {
    if (!prisma) return;
    await prisma.deviceToken.deleteMany({ where: { companyId: { in: [ids.company, ids.other] } } });
    await prisma.chatRoom.deleteMany({ where: { companyId: ids.company } });
    await prisma.accountChannel.deleteMany({ where: { channelId: ids.channel } });
    await prisma.companyChannel.deleteMany({ where: { companyId: ids.company } });
    await prisma.account.deleteMany({ where: { companyId: { in: [ids.company, ids.other] } } });
    await prisma.company.deleteMany({ where: { id: { in: [ids.company, ids.other] } } });
    await prisma.$disconnect();
  });

  const signedIn = (id, companyId = ids.company) => ({ account_id: id, company_id: companyId });
  const customerMessage = { id: 'm-1', companyId: undefined, createdBy: null, contents: '請問有貨嗎', recipients: [] };
  const sent = [];
  const phones = {
    phone: deviceToken(`phone-${run}`), admin: deviceToken(`admin-${run}`), outsider: deviceToken(`outsider-${run}`),
    foreign: deviceToken(`foreign-${run}`), gone: deviceToken(`gone-${run}`), bad: deviceToken(`bad-${run}`),
  };
  const sender = { send: async (token) => { sent.push(token); return [phones.gone, phones.bad].includes(token) ? { ok: false, unregistered: true, reason: 'gone' } : { ok: true }; } };
  const notify = () => notifyCustomerMessage({ ...customerMessage, companyId: ids.company, recipients: [{ channelId: ids.channel, chatRoomIds: [`psid-${run}`] }] }, { sender });

  test('a phone signed in to another account moves to the one signed in now', async () => {
    await M('registerPushDevice', { token: phones.phone, platform: 'ios' }, signedIn(ids.outsider));
    await M('registerPushDevice', { token: phones.phone, platform: 'ios' }, signedIn(ids.agent));
    const rows = await prisma.deviceToken.findMany({ where: { token: phones.phone } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].accountId, ids.agent);
  });

  test('only well-formed iOS tokens are kept', async () => {
    await assert.rejects(M('registerPushDevice', { token: phones.phone, platform: 'android' }, signedIn(ids.agent)), /只支援 iOS/);
    await assert.rejects(M('registerPushDevice', { token: ' ', platform: 'ios' }, signedIn(ids.agent)), /無效/);
    // It goes into the APNs request path.
    await assert.rejects(M('registerPushDevice', { token: `../../${phones.phone}`, platform: 'ios' }, signedIn(ids.agent)), /無效/);
  });

  test('a customer message reaches everyone in the channel, and nobody outside it or the company', async () => {
    await M('registerPushDevice', { token: phones.admin, platform: 'ios' }, signedIn(ids.admin));
    await M('registerPushDevice', { token: phones.outsider, platform: 'ios' }, signedIn(ids.outsider));
    await M('registerPushDevice', { token: phones.foreign, platform: 'ios' }, signedIn(ids.foreign, ids.other));
    sent.length = 0;
    assert.equal(await notify(), 2);
    assert.deepEqual(sent.sort(), [phones.admin, phones.phone].sort());
  });

  test('an assigned conversation only notifies its agent', async () => {
    await prisma.chatRoom.update({ where: { id: ids.room }, data: { assigneeId: ids.agent, assignedAt: new Date() } });
    sent.length = 0;
    await notify();
    assert.deepEqual(sent, [phones.phone]);
    await prisma.chatRoom.update({ where: { id: ids.room }, data: { assigneeId: null, assignedAt: null } });
  });

  test("agents' own replies notify nobody", async () => {
    sent.length = 0;
    assert.equal(await notifyCustomerMessage({ ...customerMessage, createdBy: ids.agent, companyId: ids.company, recipients: [{ channelId: ids.channel, chatRoomIds: [`psid-${run}`] }] }, { sender }), 0);
    assert.deepEqual(sent, []);
  });

  test('a token APNs no longer accepts is forgotten', async () => {
    await M('registerPushDevice', { token: phones.gone, platform: 'ios' }, signedIn(ids.admin));
    await M('registerPushDevice', { token: phones.bad, platform: 'ios' }, signedIn(ids.admin));
    await notify();
    assert.equal(await prisma.deviceToken.count({ where: { token: { in: [phones.gone, phones.bad] } } }), 0);
  });

  test('signing out stops the notifications, and only for the account signing out', async () => {
    await M('unregisterPushDevice', { token: phones.phone }, signedIn(ids.outsider));
    assert.equal(await prisma.deviceToken.count({ where: { token: phones.phone } }), 1, "another account can't remove it");
    await M('unregisterPushDevice', { token: phones.phone }, signedIn(ids.agent));
    assert.equal(await prisma.deviceToken.count({ where: { token: phones.phone } }), 0);
  });
});
