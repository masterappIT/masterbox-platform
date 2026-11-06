// Push notifications: talking to FCM, choosing who hears about a message, and keeping each phone's token.
// The database tests need a migrated PostgreSQL in TEST_DATABASE_URL; they make and remove their own company.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, createVerify } from 'node:crypto';
import { readServiceAccount, createFcmSender, isUnregistered } from '../lib/push/fcm.js';
import { notificationRecipients, notificationFor } from '../lib/push/notificationContent.js';

const testDatabase = process.env.TEST_DATABASE_URL;
if (testDatabase) process.env.DATABASE_URL = testDatabase;
delete process.env.REDIS_CONNECTION;

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const serviceAccount = { project_id: 'masterbox-test', client_email: 'push@masterbox-test.iam.gserviceaccount.com', private_key: privateKey };

describe('the FCM service account', () => {
  test('push stays off without one', () => {
    assert.equal(readServiceAccount({}), null);
  });

  test('is read from a mounted file or from the environment', () => {
    const fromFile = readServiceAccount({ FCM_SERVICE_ACCOUNT_FILE: '/run/secrets/fcm.json' }, (path) => {
      assert.equal(path, '/run/secrets/fcm.json');
      return JSON.stringify(serviceAccount);
    });
    assert.deepEqual(fromFile, { projectId: 'masterbox-test', clientEmail: serviceAccount.client_email, privateKey });
    assert.equal(readServiceAccount({ FCM_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount) }).projectId, 'masterbox-test');
  });

  test('a broken one is an error rather than silence', () => {
    assert.throws(() => readServiceAccount({ FCM_SERVICE_ACCOUNT_JSON: '{' }), /not valid JSON/);
    assert.throws(() => readServiceAccount({ FCM_SERVICE_ACCOUNT_JSON: '{"project_id":"x"}' }), /needs project_id/);
  });
});

describe('sending through FCM', () => {
  const account = { projectId: 'masterbox-test', clientEmail: serviceAccount.client_email, privateKey };
  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

  test('signs in with the service account once, then sends to the project', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      if (url.includes('oauth2')) return json(200, { access_token: 'google-token', expires_in: 3600 });
      return json(200, { name: 'projects/masterbox-test/messages/1' });
    };
    const sender = createFcmSender(account, { fetchImpl, now: () => 1_800_000_000_000 });
    assert.deepEqual(await sender.send('device-1', { notification: { title: 'a', body: 'b' } }), { ok: true });
    assert.deepEqual(await sender.send('device-2', { notification: { title: 'a', body: 'b' } }), { ok: true });

    const signIns = calls.filter(({ url }) => url.includes('oauth2'));
    assert.equal(signIns.length, 1, 'the access token is reused');
    const assertion = new URLSearchParams(signIns[0].init.body).get('assertion');
    const [header, payload, signature] = assertion.split('.');
    const verify = createVerify('RSA-SHA256');
    verify.update(`${header}.${payload}`);
    assert.ok(verify.verify(publicKey, signature, 'base64url'), 'signed with the service account key');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    assert.equal(claims.iss, serviceAccount.client_email);
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/firebase.messaging');

    const sends = calls.filter(({ url }) => url.includes('fcm.googleapis.com'));
    assert.equal(sends[0].url, 'https://fcm.googleapis.com/v1/projects/masterbox-test/messages:send');
    assert.equal(sends[0].init.headers.Authorization, 'Bearer google-token');
    assert.equal(JSON.parse(sends[1].init.body).message.token, 'device-2');
  });

  test('says when a token will never work again', async () => {
    const fetchImpl = async (url) => (url.includes('oauth2')
      ? json(200, { access_token: 't', expires_in: 3600 })
      : json(404, { error: { message: 'Requested entity was not found.', details: [{ errorCode: 'UNREGISTERED' }] } }));
    const result = await createFcmSender(account, { fetchImpl }).send('old-device', {});
    assert.equal(result.ok, false);
    assert.equal(result.unregistered, true);
  });

  test('other failures keep the token', () => {
    assert.equal(isUnregistered(503, { error: { message: 'Unavailable', details: [{ errorCode: 'UNAVAILABLE' }] } }), false);
    assert.equal(isUnregistered(400, { error: { message: 'The registration token is not a valid FCM registration token', details: [{ errorCode: 'INVALID_ARGUMENT' }] } }), true);
    assert.equal(isUnregistered(400, { error: { message: 'Invalid JSON payload', details: [{ errorCode: 'INVALID_ARGUMENT' }] } }), false);
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
  const result = notificationFor({ room, channelName: '官方粉專', message });
  assert.deepEqual(result.notification, { title: '小美王 · 官方粉專', body: '[圖片]' });
  assert.deepEqual(result.data, { type: 'message', roomId: 'room-1', chatRoomId: 'psid-1', channelId: 'channel-1', platform: 'fb', messageId: 'm-1' });
  assert.equal(result.apns.payload.aps['thread-id'], 'room-1');
  assert.equal(result.android.notification.tag, 'room-1');

  const long = notificationFor({ room: { ...room, users: [] }, message: { id: 'm-2', contents: '好'.repeat(400) } });
  assert.equal(long.notification.title, '客戶');
  assert.equal([...long.notification.body].length, 180);
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
  const sender = { send: async (token) => { sent.push(token); return token.startsWith('gone') ? { ok: false, unregistered: true, reason: 'gone' } : { ok: true }; } };
  const notify = () => notifyCustomerMessage({ ...customerMessage, companyId: ids.company, recipients: [{ channelId: ids.channel, chatRoomIds: [`psid-${run}`] }] }, { sender });

  test('a phone signed in to another account moves to the one signed in now', async () => {
    await M('registerPushDevice', { token: `phone-${run}`, platform: 'ios' }, signedIn(ids.outsider));
    await M('registerPushDevice', { token: `phone-${run}`, platform: 'ios' }, signedIn(ids.agent));
    const rows = await prisma.deviceToken.findMany({ where: { token: `phone-${run}` } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].accountId, ids.agent);
  });

  test('only iOS and Android tokens are kept', async () => {
    await assert.rejects(M('registerPushDevice', { token: `web-${run}`, platform: 'web' }, signedIn(ids.agent)), /只支援 iOS 和 Android/);
    await assert.rejects(M('registerPushDevice', { token: ' ', platform: 'ios' }, signedIn(ids.agent)), /無效/);
  });

  test('a customer message reaches everyone in the channel, and nobody outside it or the company', async () => {
    await M('registerPushDevice', { token: `admin-${run}`, platform: 'android' }, signedIn(ids.admin));
    await M('registerPushDevice', { token: `outsider-${run}`, platform: 'android' }, signedIn(ids.outsider));
    await M('registerPushDevice', { token: `foreign-${run}`, platform: 'ios' }, signedIn(ids.foreign, ids.other));
    sent.length = 0;
    assert.equal(await notify(), 2);
    assert.deepEqual(sent.sort(), [`admin-${run}`, `phone-${run}`].sort());
  });

  test('an assigned conversation only notifies its agent', async () => {
    await prisma.chatRoom.update({ where: { id: ids.room }, data: { assigneeId: ids.agent, assignedAt: new Date() } });
    sent.length = 0;
    await notify();
    assert.deepEqual(sent, [`phone-${run}`]);
    await prisma.chatRoom.update({ where: { id: ids.room }, data: { assigneeId: null, assignedAt: null } });
  });

  test("agents' own replies notify nobody", async () => {
    sent.length = 0;
    assert.equal(await notifyCustomerMessage({ ...customerMessage, createdBy: ids.agent, companyId: ids.company, recipients: [{ channelId: ids.channel, chatRoomIds: [`psid-${run}`] }] }, { sender }), 0);
    assert.deepEqual(sent, []);
  });

  test('a token FCM no longer knows is forgotten', async () => {
    await M('registerPushDevice', { token: `gone-${run}`, platform: 'ios' }, signedIn(ids.admin));
    await notify();
    assert.equal(await prisma.deviceToken.count({ where: { token: `gone-${run}` } }), 0);
  });

  test('signing out stops the notifications, and only for the account signing out', async () => {
    await M('unregisterPushDevice', { token: `phone-${run}` }, signedIn(ids.outsider));
    assert.equal(await prisma.deviceToken.count({ where: { token: `phone-${run}` } }), 1, "another account can't remove it");
    await M('unregisterPushDevice', { token: `phone-${run}` }, signedIn(ids.agent));
    assert.equal(await prisma.deviceToken.count({ where: { token: `phone-${run}` } }), 0);
  });
});
