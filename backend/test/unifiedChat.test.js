// Unified chat, phase 1: every source behind one connector, every message in one shape, and what each source can do.
// Meta and whatsapp-gateway are local servers that record what they were sent. The database tests need a migrated
// PostgreSQL in TEST_DATABASE_URL.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { parse, validate } from 'graphql';

const testDatabase = process.env.TEST_DATABASE_URL;
if (testDatabase) process.env.DATABASE_URL = testDatabase;
delete process.env.REDIS_CONNECTION;
process.env.META_HUMAN_AGENT_ENABLED = 'true';
process.env.FB_APP_ID = 'app-1';

const record = (requests, respond) => http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const url = new URL(req.url, 'http://local.test');
    const request = { method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: body ? JSON.parse(body) : null };
    requests.push(request);
    const [status, answer] = respond(request);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(answer));
  });
});

// Stands in for graph.facebook.com. The Meta client reads its address when it loads, so this starts first.
const metaRequests = [];
const meta = record(metaRequests, ({ method, path }) => {
  if (path.includes('expired')) return [400, { error: { code: 190, message: 'Session has expired' } }];
  if (method === 'POST' && path.includes('/phone-')) return [200, { messages: [{ id: `wamid.HBg${metaRequests.length}` }] }];
  if (method === 'POST') return [200, { message_id: `m_${metaRequests.length}` }];
  if (path.endsWith('/subscribed_apps')) return [200, { data: [{ id: 'app-1', subscribed_fields: ['messages'] }] }];
  return [404, {}];
});
await new Promise(resolve => meta.listen(0, '127.0.0.1', resolve));
process.env.META_BASE_URL = `http://127.0.0.1:${meta.address().port}`;

const gatewayRequests = [];
const gateway = record(gatewayRequests, ({ body }) => (body?.to === 'offline'
  ? [409, { error: '這支號碼目前沒有連線' }]
  : [200, { id: `true_${body?.to}_OUT${gatewayRequests.length}` }]));
await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
process.env.WHATSAPP_GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
process.env.WHATSAPP_GATEWAY_SECRET = 'x'.repeat(40);

const { CONNECTORS, CAPABILITIES, connectorFor, capabilitiesOf, sourceOf } = await import('../lib/connectors/index.js');
const { sourceFromPlatform, SOURCE_LABELS } = await import('../lib/connectors/source.js');
const { makeBody, readBody, legacyContents, bodyView, isBody } = await import('../lib/messaging/messageBody.js');
const { messagePreview } = await import('../lib/messaging/conversationText.js');
const { splitReply } = await import('../lib/messaging/outbound.js');
const { default: typeDefs } = await import('../graphQL/typeDefs/index.js');

after(() => { meta.close(); gateway.close(); });

const HOUR = 60 * 60 * 1000;
const image = { type: 'image', payload: { url: 'https://api.example.test/files/a.png' }, filename: 'a.png', mime_type: 'image/png', size: 1200 };
const pdf = { type: 'file', payload: { url: 'https://api.example.test/files/q.pdf' }, filename: 'q.pdf', mime_type: 'application/pdf', size: 4000 };

const channels = {
  messenger: { id: 'ch-fb', platform: 'fb', enabled: true, accessInfo: { id: 'page-1', page_id: 'page-1', access_token: 't' }, info: {} },
  instagram: { id: 'ch-ig', platform: 'ig', enabled: true, accessInfo: { id: 'ig-1', page_id: 'page-2', access_token: 't' }, info: {} },
  whatsapp_cloud: { id: 'ch-wa', platform: 'whatsapp', enabled: true, accessInfo: { id: 'phone-1', phone_number_id: 'phone-1', whatsapp_business_account_id: 'waba-1', access_token: 't' }, info: {} },
  whatsapp_web: { id: 'ch-web', platform: 'whatsapp', enabled: true, accessInfo: { provider: 'web', phone: '+886900000000' }, info: {} },
  line: { id: 'ch-line', platform: 'line', enabled: true, accessInfo: { id: 'line-1' }, info: {} },
};

describe('message body', () => {
  test('every shape stored before reads as the same body', () => {
    const empty = { text: null, attachments: [], template: null };
    assert.deepEqual(readBody('你好'), { ...empty, text: '你好' });
    assert.deepEqual(readBody(''), empty);
    assert.deepEqual(readBody(JSON.stringify({ text: '早安', attachments: [] })), { ...empty, text: '早安' });
    // A Meta payload the admin sent, and a webhook message.
    assert.deepEqual(readBody(JSON.stringify({ recipient: { id: 'p' }, message: { text: '回覆', attachments: [image] } })), {
      text: '回覆', attachments: [{ type: 'image', url: image.payload.url, filename: 'a.png', mime_type: 'image/png', size: 1200, caption: null }], template: null,
    });
    assert.deepEqual(readBody(JSON.stringify({ mid: 'm1', attachments: [{ type: 'share', payload: { url: 'https://x/p' } }] })).attachments[0].type, 'share');
    // WhatsApp: text under body, a caption on the file, and the older { text: { body } }.
    assert.equal(readBody(JSON.stringify({ id: 'w1', message: { body: '哈囉' } })).text, '哈囉');
    assert.equal(readBody(JSON.stringify({ text: { body: '舊格式' } })).text, '舊格式');
    assert.equal(readBody(JSON.stringify({ id: 'w2', attachments: [{ type: 'video', caption: '開箱' }] })).attachments[0].caption, '開箱');
    // A template message keeps which template it was.
    const sent = readBody(JSON.stringify({ text: '您好', template: { id: '1001', name: 'order_update', language: 'zh_TW' } }));
    assert.deepEqual(sent.template, { id: '1001', name: 'order_update', language: 'zh_TW' });
    // Objects as well as JSON strings; nothing readable leaves an empty body.
    assert.equal(readBody({ text: '物件' }).text, '物件');
    assert.deepEqual(readBody(JSON.stringify({ unknown: true })), empty);
    assert.equal(readBody(JSON.stringify({ ciphertext: 'x', nonce: 'y' }), 'e2ee'), null);
  });

  test('new messages are stored marked, and read back unchanged', () => {
    const body = makeBody({ text: '請看報價', attachments: [pdf], template: { id: 7, name: 'quote' } });
    assert.deepEqual(body, {
      v: 1, text: '請看報價',
      attachments: [{ type: 'file', url: pdf.payload.url, filename: 'q.pdf', mime_type: 'application/pdf', size: 4000, caption: null }],
      template: { id: '7', name: 'quote' },
    });
    assert.ok(isBody(body));
    assert.ok(isBody(JSON.stringify(body)));
    assert.equal(isBody(JSON.stringify({ text: 'x', attachments: [] })), false);
    assert.deepEqual(readBody(body), { text: '請看報價', attachments: body.attachments, template: { id: '7', name: 'quote' } });
    assert.deepEqual(makeBody({ text: '   ' }), { v: 1, text: null, attachments: [] });
  });

  test('older clients get contents in a shape they already read', () => {
    // Messages stored before come back exactly as stored.
    assert.equal(legacyContents('你好'), '你好');
    const meta = JSON.stringify({ mid: 'm1', text: 'hi' });
    assert.equal(legacyContents(meta), meta);
    assert.equal(legacyContents({ text: 'x' }), '{"text":"x"}');
    assert.equal(legacyContents(null), '');
    // Unified text is plain text, unless it would read as JSON.
    assert.equal(legacyContents(makeBody({ text: '有的' })), '有的');
    assert.equal(legacyContents(makeBody({ text: '{"a":1}' })), JSON.stringify({ text: '{"a":1}' }));
    // Files go back under payload.url, as the admin and the app read them.
    assert.deepEqual(JSON.parse(legacyContents(makeBody({ text: '看圖', attachments: [image] }))), {
      text: '看圖', attachments: [{ type: 'image', payload: { url: image.payload.url }, filename: 'a.png', mime_type: 'image/png', size: 1200 }],
    });
    assert.deepEqual(JSON.parse(legacyContents(makeBody({ template: { id: '1', name: 'hello', language: 'en' }, text: 'Hi' }))), { text: 'Hi', template: { id: '1', name: 'hello', language: 'en' } });
    // Nothing to show still reads as a message, so older clients show it as unsupported.
    assert.equal(legacyContents(makeBody({})), '{}');
  });

  test('the API body leaves out what only the server keeps', () => {
    const view = bodyView(makeBody({ text: 'Hi', template: { id: '1', name: 'hello', language: 'en' } }));
    assert.deepEqual(view.template, { id: '1', name: 'hello' });
    assert.equal(bodyView('{"ciphertext":"x"}', 'e2ee'), null);
  });

  test('previews read new and old messages alike', () => {
    assert.equal(messagePreview(makeBody({ text: '  早安 ' })), '早安');
    assert.equal(messagePreview(makeBody({ attachments: [image] })), '[圖片]');
    assert.equal(messagePreview(makeBody({ attachments: [{ ...image, caption: '新品' }] })), '[圖片] 新品');
    assert.equal(messagePreview(JSON.stringify(makeBody({ text: '附上', attachments: [pdf] }))), '[檔案] 附上');
    assert.equal(messagePreview(makeBody({})), '[不支援的訊息類型]');
    assert.equal(messagePreview(' 舊的純文字 '), '舊的純文字');
    assert.equal(messagePreview('{壞掉的 JSON'), '{壞掉的 JSON');
  });
});

describe('sources', () => {
  test('a channel is the source its platform and connection say, unless one is stored', () => {
    assert.equal(sourceOf(channels.messenger), 'messenger');
    assert.equal(sourceOf(channels.instagram), 'instagram');
    assert.equal(sourceOf(channels.whatsapp_cloud), 'whatsapp_cloud');
    assert.equal(sourceOf(channels.whatsapp_web), 'whatsapp_web');
    assert.equal(sourceOf(channels.line), 'line');
    assert.equal(sourceOf({ platform: 'wechat' }), null);
    assert.equal(sourceOf({ platform: 'whatsapp', source: 'whatsapp_web', accessInfo: {} }), 'whatsapp_web');
    assert.equal(sourceOf({ source: 'masterbox' }), 'masterbox');
    assert.equal(sourceOf(null), null);
    assert.equal(sourceFromPlatform('whatsapp', undefined), 'whatsapp_cloud');
    assert.deepEqual(Object.values(SOURCE_LABELS).slice(0, 4), ['Facebook', 'Instagram', 'WhatsApp 官方', 'WhatsApp 掃碼']);
  });

  test('every source has a connector with the same methods', () => {
    for (const [source, connector] of Object.entries(CONNECTORS)) {
      assert.equal(connector.source, source);
      for (const method of ['capabilities', 'replyRule', 'send', 'normalize', 'connection', 'notReady', 'recipient', 'checkAttachment', 'failureReason']) {
        assert.equal(typeof connector[method], 'function', `${source}.${method}`);
      }
    }
    assert.equal(connectorFor(channels.whatsapp_web), CONNECTORS.whatsapp_web);
    assert.equal(connectorFor({ platform: 'wechat' }).replies, false);
  });
});

describe('capabilities', () => {
  test('each source declares what it supports', () => {
    const files = ['send_image', 'send_video', 'send_audio', 'send_document'];
    assert.deepEqual(capabilitiesOf(channels.messenger), [...files, 'reply_window']);
    assert.deepEqual(capabilitiesOf(channels.instagram), [...files, 'reply_window']);
    assert.deepEqual(capabilitiesOf(channels.whatsapp_cloud), [...files, 'caption', 'reply_window', 'templates']);
    assert.deepEqual(capabilitiesOf(channels.whatsapp_web), [...files, 'caption']);
    assert.deepEqual(capabilitiesOf(channels.line), []);
    assert.deepEqual(capabilitiesOf({ source: 'masterbox' }), []);
    assert.deepEqual(capabilitiesOf({ platform: 'wechat' }), []);
  });

  test('features for Chat Box and unconfirmed ones are listed, and no source declares them yet', () => {
    const later = ['calls', 'disappearing', 'e2ee', 'groups', 'reactions', 'quote_reply', 'read_receipts', 'recall'];
    for (const capability of later) assert.ok(CAPABILITIES.includes(capability), capability);
    for (const channel of [...Object.values(channels), { source: 'masterbox' }]) {
      assert.deepEqual(capabilitiesOf(channel).filter(capability => later.includes(capability)), []);
    }
  });

  test('a reply goes with its text as a caption only where the source has captions', () => {
    const reply = { text: '報價單', attachment: pdf, sendType: 'document' };
    assert.equal(splitReply(reply, { caption: capabilitiesOf(channels.whatsapp_web).includes('caption') }).length, 1);
    assert.equal(splitReply(reply, { caption: capabilitiesOf(channels.messenger).includes('caption') }).length, 2);
  });
});

describe('reply rules', () => {
  const last = new Date(Date.now() - 30 * HOUR);

  test('WhatsApp official stops free-form replies after 24 hours; QR numbers never do', () => {
    const cloud = CONNECTORS.whatsapp_cloud.replyRule({}, { lastCustomerMessageAt: last });
    assert.equal(cloud.state, 'closed');
    assert.equal(cloud.templateRequired, true);
    assert.match(cloud.blockReason, /範本/);
    const web = CONNECTORS.whatsapp_web.replyRule({}, { lastCustomerMessageAt: last });
    assert.equal(web.state, 'no_limit');
    assert.equal(web.blockReason, null);
  });

  test('Messenger and Instagram answer within 7 days with the human agent tag', () => {
    for (const source of ['messenger', 'instagram']) {
      const rule = CONNECTORS[source].replyRule({}, { lastCustomerMessageAt: last });
      assert.equal(rule.state, 'human_agent', source);
      assert.equal(rule.messagingTag, 'HUMAN_AGENT');
      assert.equal(rule.blockReason, null);
    }
  });

  test('sources that can\'t be answered here say so', () => {
    assert.equal(CONNECTORS.line.replyRule({}).state, 'unsupported');
    assert.match(CONNECTORS.line.notReady(channels.line), /尚未支援回覆 line 訊息/);
    assert.equal(CONNECTORS.masterbox.replyRule({}).state, 'no_limit');
  });

  test('Meta channels need a token; the customer comes from the conversation', () => {
    assert.match(CONNECTORS.messenger.notReady({ accessInfo: {} }), /尚未完成 Meta 串接/);
    assert.equal(CONNECTORS.messenger.notReady(channels.messenger), null);
    assert.equal(CONNECTORS.whatsapp_web.notReady(channels.whatsapp_web), null);
    assert.equal(CONNECTORS.messenger.recipient({ users: [{ id: 'psid' }], chatRoomId: 't_1' }), 'psid');
    assert.equal(CONNECTORS.messenger.recipient({ users: [], chatRoomId: 't_1' }), null);
    assert.equal(CONNECTORS.whatsapp_cloud.recipient({ users: [], chatRoomId: '886900' }), '886900');
  });
});

describe('sending', () => {
  const lastTo = suffix => metaRequests.filter(({ method, path }) => method === 'POST' && path.endsWith(suffix)).slice(-1)[0];

  test('Messenger and Instagram send through their page, with the tag the rule asks for', async () => {
    const id = await CONNECTORS.messenger.send({ channel: channels.messenger, customerId: 'psid', messagingTag: 'HUMAN_AGENT' }, { text: '久等了' });
    assert.match(id, /^m_/);
    const request = lastTo('/page-1/messages');
    assert.equal(request.query.access_token, 't');
    assert.deepEqual(request.body, { recipient: { id: 'psid' }, messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT', message: { text: '久等了' } });

    await CONNECTORS.instagram.send({ channel: channels.instagram, customerId: 'igsid' }, { attachment: image, sendType: 'image' });
    assert.deepEqual(lastTo('/page-2/messages').body, { recipient: { id: 'igsid' }, messaging_type: 'RESPONSE', message: { attachment: { type: 'image', payload: { url: image.payload.url } } } });
  });

  test('WhatsApp official sends to the number, with a caption, and returns the id webhooks use', async () => {
    const id = await CONNECTORS.whatsapp_cloud.send({ channel: channels.whatsapp_cloud, customerId: '886900' }, { text: '報價單', attachment: pdf, sendType: 'document' });
    assert.match(id, /^HBg\d+$/);
    assert.deepEqual(lastTo('/phone-1/messages').body, {
      messaging_product: 'whatsapp', recipient_type: 'individual', to: '886900', type: 'document',
      document: { link: pdf.payload.url, caption: '報價單', filename: 'q.pdf' },
    });
    const templateId = await CONNECTORS.whatsapp_cloud.sendTemplate({ channel: channels.whatsapp_cloud }, { messaging_product: 'whatsapp', to: '886900', type: 'template', template: { name: 'hello' } });
    assert.match(templateId, /^HBg\d+$/);
    assert.equal(CONNECTORS.whatsapp_cloud.templatesUnavailable(channels.whatsapp_cloud), null);
    assert.match(CONNECTORS.whatsapp_cloud.templatesUnavailable({ accessInfo: {} }), /缺少商業帳號/);
  });

  test('QR numbers send through the gateway', async () => {
    const id = await CONNECTORS.whatsapp_web.send({ channel: channels.whatsapp_web, customerId: '886911@c.us' }, { text: '看圖', attachment: image, sendType: 'image' });
    assert.match(id, /^true_886911@c\.us_OUT/);
    assert.deepEqual(gatewayRequests.slice(-1)[0].body, { to: '886911@c.us', text: '看圖', media: { url: image.payload.url, mimetype: 'image/png', filename: 'a.png' }, sendType: 'image' });
    const error = await CONNECTORS.whatsapp_web.send({ channel: channels.whatsapp_web, customerId: 'offline' }, { text: 'hi' }).catch(e => e);
    assert.equal(CONNECTORS.whatsapp_web.failureReason(error), 'WhatsApp 無法送出這則訊息：這支號碼目前沒有連線');
  });

  test('a refused send says why in words an agent can act on', async () => {
    const expired = { ...channels.messenger, id: undefined, accessInfo: { page_id: 'expired', access_token: 't' } };
    const error = await CONNECTORS.messenger.send({ channel: expired, customerId: 'psid' }, { text: 'hi' }).catch(e => e);
    assert.equal(CONNECTORS.messenger.failureReason(error, expired), '頻道授權已失效，請到頻道管理重新串接');
  });

  test('sources that can\'t be answered here never send', async () => {
    await assert.rejects(CONNECTORS.line.send({ channel: channels.line, customerId: 'u' }, { text: 'hi' }), /尚未支援/);
    await assert.rejects(CONNECTORS.masterbox.send({ channel: {}, customerId: 'u' }, { text: 'hi' }), /尚未支援/);
  });

  test('each source accepts files by its own rules', () => {
    const big = { mime: 'image/png', size: 6 * 1024 * 1024 };
    assert.equal(CONNECTORS.messenger.checkAttachment(big).ok, true);
    assert.equal(CONNECTORS.whatsapp_cloud.checkAttachment(big).ok, false);
    assert.equal(CONNECTORS.whatsapp_web.checkAttachment(big).ok, false);
    assert.equal(CONNECTORS.instagram.checkAttachment({ mime: 'text/plain', size: 10 }).ok, false);
    assert.equal(CONNECTORS.line.checkAttachment(big).ok, false);
  });
});

describe('receiving', () => {
  const file = (extra = {}) => ({ type: 'image', url: 'https://api.example.test/files/b.jpg', filename: 'b.jpg', mime_type: 'image/jpeg', size: 99, caption: null, ...extra });

  test('Messenger keeps a sticker once, as a sticker', () => {
    const raw = {
      mid: 'm1',
      attachments: [
        { type: 'image', payload: { url: 'https://x/like.png', sticker_id: 369239263222822 } },
        { type: 'sticker', payload: { url: 'https://x/like.png', sticker_id: 369239263222822 } },
      ],
    };
    const body = CONNECTORS.messenger.normalize(raw);
    assert.deepEqual(body.attachments.map(({ type }) => type), ['sticker']);
    assert.equal(body.text, null);
    // Stored by the previous version, it reads the same.
    assert.deepEqual(readBody(JSON.stringify(raw)).attachments.map(({ type }) => type), ['sticker']);
  });

  test('Messenger and Instagram webhook messages', () => {
    assert.deepEqual(CONNECTORS.instagram.normalize({ mid: 'm2', text: '有貨嗎', attachments: [{ type: 'image', payload: { url: file().url }, filename: 'b.jpg', mime_type: 'image/jpeg', size: 99 }] }),
      { v: 1, text: '有貨嗎', attachments: [file()] });
    assert.deepEqual(CONNECTORS.messenger.normalize('純文字'), { v: 1, text: '純文字', attachments: [] });
  });

  test('WhatsApp official: text, button replies and captioned files', () => {
    assert.equal(CONNECTORS.whatsapp_cloud.normalize({ id: 'w1', message: { body: '您好' } }).text, '您好');
    assert.equal(CONNECTORS.whatsapp_cloud.normalize({ id: 'w2', message: { text: '是', payload: 'YES' } }).text, '是');
    assert.deepEqual(CONNECTORS.whatsapp_cloud.normalize({ id: 'w3', attachments: [{ type: 'image', caption: '這個', media_id: '123', payload: { url: file().url }, filename: 'b.jpg', mime_type: 'image/jpeg', size: 99 }] }),
      { v: 1, text: null, attachments: [file({ caption: '這個' })] });
  });

  test('WhatsApp by QR code: the caption is the text, and an unsaved file has no link', () => {
    assert.deepEqual(CONNECTORS.whatsapp_web.normalize({ id: 'x', text: '看這個', attachments: [{ type: 'video', mime_type: 'video/mp4', wa_web_media: true }] }),
      { v: 1, text: '看這個', attachments: [{ type: 'video', url: null, filename: null, mime_type: 'video/mp4', size: null, caption: null }] });
    assert.equal(CONNECTORS.whatsapp_web.normalize({ id: 'y', attachments: [{ type: 'location', caption: '台北車站', payload: { coordinates: { lat: 25, long: 121 } } }] }).attachments[0].caption, '台北車站');
  });

  test('LINE and MasterBox read plain text', () => {
    assert.equal(CONNECTORS.line.normalize('哈囉').text, '哈囉');
    assert.equal(CONNECTORS.masterbox.normalize({ text: '同事' }).text, '同事');
  });
});

describe('GraphQL', () => {
  test('messages, channels and conversations have body, source and capabilities, beside the old fields', () => {
    const schema = makeExecutableSchema({ typeDefs: [...typeDefs] });
    const query = parse(`
      query Unified {
        getUserSubscribedChannels { channel_id platform source capabilities }
        chatRoomPage(first: 5, filter: { source: "whatsapp_web" }) { rooms { id platform source capabilities status } }
        messagePage(id: "r") { messages { id contents text body { text attachments { type url filename mime_type size caption } template { id name } } } }
      }`);
    assert.deepEqual(validate(schema, query).map(({ message }) => message), []);
  });
});

describe('in the database', { skip: !testDatabase && 'set TEST_DATABASE_URL to a migrated database' }, () => {
  let prisma, utils, conversations, channelView;
  const run = randomUUID().slice(0, 8);
  const ids = {};
  let agent;

  before(async () => {
    ({ prisma } = await import('../lib/db/prisma.js'));
    utils = await import('../utils/utils.js');
    conversations = await import('../lib/messaging/conversations.js');
    ({ channelView } = await import('../lib/messaging/channelView.js'));
    const company = await prisma.company.create({ data: { chineseName: '測試', englishName: 'Test', email: `${run}@unified.test`, country: 'TW' } });
    ids.company = company.id;
    const account = await prisma.account.create({ data: { email: `agent-${run}@unified.test`, password: 'x', role: 'user', companyId: company.id } });
    agent = { account_id: account.id, company_id: company.id, role: 'user' };
  });

  after(async () => {
    if (!prisma) return;
    await prisma.message.deleteMany({ where: { companyId: ids.company } });
    await prisma.chatRoom.deleteMany({ where: { companyId: ids.company } });
    await prisma.companyChannel.deleteMany({ where: { companyId: ids.company } });
    await prisma.account.deleteMany({ where: { companyId: ids.company } });
    await prisma.company.delete({ where: { id: ids.company } });
    await prisma.$disconnect();
  });

  test('the migration fills in each existing channel\'s source', async () => {
    const make = (platform, accessInfo) => prisma.companyChannel.create({ data: { companyId: ids.company, platform, name: `${platform}-${run}`, accessInfo, info: {} } });
    const made = {
      messenger: await make('fb', { id: `m-${run}` }),
      instagram: await make('ig', { id: `i-${run}` }),
      whatsapp_cloud: await make('whatsapp', { id: `c-${run}`, phone_number_id: `c-${run}` }),
      whatsapp_web: await make('whatsapp', { id: `waweb:${run}`, provider: 'web' }),
      line: await make('line', { id: `l-${run}` }),
      wechat: await make('wechat', { id: `w-${run}` }),
    };
    // Written the way the previous version wrote them: no source.
    assert.ok(Object.values(made).every(({ source }) => source === null));

    const sql = fs.readFileSync(new URL('../prisma/migrations/20261107180000_channel_source/migration.sql', import.meta.url), 'utf8');
    const backfill = sql.match(/UPDATE "company_channels"[\s\S]*?;/)[0];
    await prisma.$executeRawUnsafe(backfill);

    for (const [expected, { id }] of Object.entries(made)) {
      const { source } = await prisma.companyChannel.findUnique({ where: { id } });
      assert.equal(source, expected === 'wechat' ? null : expected, expected);
      // The same as the code works out for a row without one.
      assert.equal(sourceOf({ ...made[expected], source: null }), expected === 'wechat' ? null : expected);
    }
    // Running it again leaves a set source alone.
    await prisma.companyChannel.update({ where: { id: made.line.id }, data: { source: 'masterbox' } });
    await prisma.$executeRawUnsafe(backfill);
    assert.equal((await prisma.companyChannel.findUnique({ where: { id: made.line.id } })).source, 'masterbox');
    await prisma.companyChannel.deleteMany({ where: { id: { in: Object.values(made).map(({ id }) => id) } } });
  });

  test('conversations start open, and show their channel\'s source and capabilities', async () => {
    const channel = await prisma.companyChannel.create({ data: { companyId: ids.company, platform: 'whatsapp', source: 'whatsapp_web', name: 'QR', accessInfo: { id: `waweb:x-${run}`, provider: 'web' }, info: {} } });
    const cloud = await prisma.companyChannel.create({ data: { companyId: ids.company, platform: 'whatsapp', source: 'whatsapp_cloud', name: '官方', accessInfo: { id: `phone-${run}`, phone_number_id: `phone-${run}`, access_token: 't' }, info: {} } });
    await prisma.accountChannel.createMany({ data: [{ accountId: agent.account_id, channelId: channel.id }, { accountId: agent.account_id, channelId: cloud.id }] });
    const room = await prisma.chatRoom.create({ data: { companyId: ids.company, platform: 'whatsapp', channelId: channel.id, chatRoomId: `886955${run}@c.us`, users: [{ id: `886955${run}@c.us` }] } });
    const other = await prisma.chatRoom.create({ data: { companyId: ids.company, platform: 'whatsapp', channelId: cloud.id, chatRoomId: `886966${run}`, users: [{ id: `886966${run}` }] } });
    assert.equal(room.status, 'open');

    const [view] = await conversations.roomViews(agent, [room.id]);
    assert.equal(view.source, 'whatsapp_web');
    assert.deepEqual(view.capabilities, ['send_image', 'send_video', 'send_audio', 'send_document', 'caption']);
    assert.equal(view.status, 'open');
    assert.equal(view.replyWindow.state, 'no_limit');
    assert.equal(view.platform, 'whatsapp');

    // WhatsApp official and QR numbers can be filtered apart.
    const qr = await conversations.listRooms(agent, { filter: { source: 'whatsapp_web' } });
    assert.deepEqual(qr.rooms.map(({ id }) => id), [room.id]);
    const official = await conversations.listRooms(agent, { filter: { source: 'whatsapp_cloud' } });
    assert.deepEqual(official.rooms.map(({ id }) => id), [other.id]);
    await assert.rejects(conversations.listRooms(agent, { filter: { source: 'telegram' } }), /不支援這個來源/);

    const listed = channelView(cloud);
    assert.equal(listed.source, 'whatsapp_cloud');
    assert.ok(listed.capabilities.includes('templates'));
    ids.web = channel.id;
    ids.webRoom = room;
  });

  test('customer messages are stored in the unified shape, and old ones read the same', async () => {
    const customer = `886977${run}@c.us`;
    const stored = await utils.saveInboundMessage({
      externalChannelId: `waweb:x-${run}`, platform: 'whatsapp', chatRoomId: customer,
      contents: { id: `in-${run}`, text: '有貨嗎' }, customer: { id: customer }, externalId: `in-${run}`,
    });
    assert.deepEqual(stored.contents, { v: 1, text: '有貨嗎', attachments: [] });
    const view = utils.messageView(stored, customer, agent.account_id);
    assert.equal(view.contents, '有貨嗎');
    assert.deepEqual(view.body, { text: '有貨嗎', attachments: [], template: null });

    // A message stored by the previous version is left as it is and read through body.
    const old = await prisma.message.create({
      data: { companyId: ids.company, platform: 'whatsapp', contents: JSON.stringify({ id: 'w', attachments: [{ type: 'image', caption: '舊的', payload: { url: 'https://x/o.jpg' } }] }), recipients: { create: [{ channelId: ids.web, chatRoomIds: [customer] }] } },
      include: { recipients: true },
    });
    const oldView = utils.messageView(old, customer);
    assert.equal(oldView.contents, old.contents);
    assert.deepEqual(oldView.body.attachments, [{ type: 'image', url: 'https://x/o.jpg', filename: null, mime_type: null, size: null, caption: '舊的' }]);
    assert.equal(oldView.preview, '[圖片] 舊的');
    const [room] = await conversations.roomViews(agent, [(await prisma.chatRoom.findFirst({ where: { chatRoomId: customer } })).id]);
    assert.equal(room.lastMessage, '[圖片] 舊的');
  });

  test('a reply goes through the source\'s connector and is stored in the unified shape', async () => {
    const before = gatewayRequests.length;
    const reply = await utils.handleSendMessage(agent.account_id, ids.webRoom.chatRoomId, JSON.stringify({ text: '有的' }), ids.web);
    assert.equal(gatewayRequests.length, before + 1);
    assert.deepEqual(reply.contents, { v: 1, text: '有的', attachments: [] });
    assert.equal(utils.messageView(reply).contents, '有的');
    // Search still finds what was said.
    const found = await conversations.listRooms(agent, { filter: { search: '有的' } });
    assert.ok(found.rooms.some(({ id }) => id === ids.webRoom.id));
  });
});
