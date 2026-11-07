// Meta's reply windows, WhatsApp templates and quick replies in the conversation.
// The database tests need a migrated PostgreSQL in TEST_DATABASE_URL; Meta is a local server that records what it was sent.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const testDatabase = process.env.TEST_DATABASE_URL;
if (testDatabase) process.env.DATABASE_URL = testDatabase;
delete process.env.REDIS_CONNECTION;
process.env.META_HUMAN_AGENT_ENABLED = 'true';

// Stands in for graph.facebook.com. The Meta client reads its address when it loads, so this starts first.
const metaRequests = [];
let metaTemplates = [];
let nextMetaId = 0;
const meta = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const url = new URL(req.url, 'http://meta.test');
    metaRequests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: body ? JSON.parse(body) : null });
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET' && url.pathname.endsWith('/message_templates')) return res.end(JSON.stringify({ data: metaTemplates, paging: { cursors: { after: 'end' } } }));
    if (req.method === 'POST' && url.pathname.endsWith('/messages')) {
      nextMetaId += 1;
      return res.end(JSON.stringify(url.pathname.includes('/phone-') ? { messages: [{ id: `wamid.T${nextMetaId}-${Date.now()}` }] } : { message_id: `m_${nextMetaId}-${Date.now()}` }));
    }
    res.statusCode = 404;
    res.end('{}');
  });
});
await new Promise(resolve => meta.listen(0, '127.0.0.1', resolve));
process.env.META_BASE_URL = `http://127.0.0.1:${meta.address().port}`;

const { replyWindow, freeformBlockReason, STANDARD_WINDOW_MS, HUMAN_AGENT_WINDOW_MS } = await import('../lib/messaging/replyWindow.js');
const { templateView, templateMessage } = await import('../lib/messaging/whatsappTemplates.js');
const { metaPayload } = await import('../lib/messaging/outbound.js');

after(() => meta.close());

const HOUR = 60 * 60 * 1000;
const at = (base, ms) => new Date(base.getTime() + ms);

describe('reply windows', () => {
  const last = new Date('2026-11-01T00:00:00.000Z');

  test('every platform is open for 24 hours after the customer last wrote', () => {
    for (const platform of ['fb', 'ig', 'whatsapp']) {
      const window = replyWindow({ platform, lastCustomerMessageAt: last, now: at(last, 23 * HOUR), humanAgent: false });
      assert.equal(window.state, 'open', platform);
      assert.deepEqual(window.closesAt, at(last, STANDARD_WINDOW_MS));
      assert.equal(window.templateRequired, false);
      assert.equal(window.messagingTag, null);
    }
  });

  test('after 24 hours WhatsApp needs a template', () => {
    const window = replyWindow({ platform: 'whatsapp', lastCustomerMessageAt: last, now: at(last, 25 * HOUR), humanAgent: true });
    assert.equal(window.state, 'closed');
    assert.equal(window.templateRequired, true);
    assert.equal(window.humanAgentAvailable, false);
    assert.match(freeformBlockReason(window), /範本/);
  });

  test('Messenger and Instagram get 7 days with the human agent tag, only when Meta approved it', () => {
    for (const platform of ['fb', 'ig']) {
      const tagged = replyWindow({ platform, lastCustomerMessageAt: last, now: at(last, 3 * 24 * HOUR), humanAgent: true });
      assert.equal(tagged.state, 'human_agent');
      assert.equal(tagged.messagingTag, 'HUMAN_AGENT');
      assert.deepEqual(tagged.closesAt, at(last, HUMAN_AGENT_WINDOW_MS));
      assert.equal(freeformBlockReason(tagged), null);

      const without = replyWindow({ platform, lastCustomerMessageAt: last, now: at(last, 3 * 24 * HOUR), humanAgent: false });
      assert.equal(without.state, 'closed');
      assert.equal(without.messagingTag, null);
      // Ad conversations may still be open, which Meta doesn't tell us, so it is a warning rather than a block.
      assert.equal(freeformBlockReason(without), null);

      assert.equal(replyWindow({ platform, lastCustomerMessageAt: last, now: at(last, 8 * 24 * HOUR), humanAgent: true }).state, 'closed');
    }
  });

  test('no customer message, and platforms that cannot be answered', () => {
    const whatsapp = replyWindow({ platform: 'whatsapp', lastCustomerMessageAt: null });
    assert.equal(whatsapp.state, 'no_customer_message');
    assert.equal(whatsapp.templateRequired, true);
    assert.match(freeformBlockReason(whatsapp), /還沒有傳訊息/);
    assert.equal(replyWindow({ platform: 'line', lastCustomerMessageAt: last }).state, 'unsupported');
  });

  test('Messenger replies carry the tag only when it is needed', () => {
    assert.deepEqual(metaPayload('fb', 'psid', { text: '嗨' }), { recipient: { id: 'psid' }, messaging_type: 'RESPONSE', message: { text: '嗨' } });
    assert.deepEqual(metaPayload('ig', 'igsid', { text: '嗨' }, { messagingTag: 'HUMAN_AGENT' }), { recipient: { id: 'igsid' }, messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT', message: { text: '嗨' } });
    assert.equal(metaPayload('whatsapp', '886900', { text: '嗨' }, { messagingTag: 'HUMAN_AGENT' }).tag, undefined);
  });
});

// Shaped like GET /{waba-id}/message_templates.
const ORDER_TEMPLATE = {
  id: '1001', name: 'order_update', language: 'zh_TW', status: 'APPROVED', category: 'UTILITY', parameter_format: 'POSITIONAL',
  components: [
    { type: 'HEADER', format: 'TEXT', text: '訂單 {{1}}', example: { header_text: ['A123'] } },
    { type: 'BODY', text: '{{1}} 您好，您的訂單將於 {{2}} 送達。', example: { body_text: [['王小明', '週五']] } },
    { type: 'FOOTER', text: 'MasterBox 商店' },
    { type: 'BUTTONS', buttons: [{ type: 'URL', text: '查看訂單', url: 'https://shop.test/o/{{1}}', example: ['A123'] }, { type: 'QUICK_REPLY', text: '聯絡客服' }] },
  ],
};
const NAMED_TEMPLATE = {
  id: '1002', name: 'welcome_back', language: 'en_US', status: 'APPROVED', category: 'MARKETING', parameter_format: 'NAMED',
  components: [
    { type: 'HEADER', format: 'IMAGE', example: { header_handle: ['4::x'] } },
    { type: 'BODY', text: 'Hi {{first_name}}, use your code!', example: { body_text_named_params: [{ param_name: 'first_name', example: 'Pablo' }] } },
    { type: 'BUTTONS', buttons: [{ type: 'COPY_CODE', example: 'SAVE10' }] },
  ],
};
const FLOW_TEMPLATE = {
  id: '1003', name: 'signup_flow', language: 'zh_TW', status: 'APPROVED', category: 'MARKETING',
  components: [{ type: 'BODY', text: '填寫表單' }, { type: 'BUTTONS', buttons: [{ type: 'FLOW', text: '開始' }] }],
};

describe('WhatsApp templates', () => {
  test('lists what the agent fills in, with Meta’s examples', () => {
    const view = templateView(ORDER_TEMPLATE);
    assert.equal(view.supported, true);
    assert.deepEqual(view.variables.map(({ key, example }) => [key, example]), [['header:1', 'A123'], ['body:1', '王小明'], ['body:2', '週五'], ['button:0:1', 'A123']]);
    assert.equal(view.footer_text, 'MasterBox 商店');

    const named = templateView(NAMED_TEMPLATE);
    assert.deepEqual(named.variables.map(({ key, example }) => [key, example]), [['header:media', null], ['body:first_name', 'Pablo'], ['coupon:0', 'SAVE10']]);
  });

  test('templates the chat cannot fill in say why', () => {
    const flow = templateView(FLOW_TEMPLATE);
    assert.equal(flow.supported, false);
    assert.match(flow.unsupported_reason, /Flow/);
    assert.equal(templateView({ ...FLOW_TEMPLATE, category: 'AUTHENTICATION', components: [{ type: 'BODY', text: '{{1}} 是驗證碼' }] }).supported, false);
    assert.match(templateMessage(flow, [], { to: '886900' }).error, /無法在聊天室發送/);
  });

  test('builds the message Meta sends and the text the conversation keeps', () => {
    const values = [{ key: 'header:1', value: 'B777' }, { key: 'body:1', value: '陳小姐' }, { key: 'body:2', value: '明天' }, { key: 'button:0:1', value: 'B777' }];
    const { payload, text, error } = templateMessage(templateView(ORDER_TEMPLATE), values, { to: '886900' });
    assert.equal(error, undefined);
    assert.equal(text, '訂單 B777\n\n陳小姐 您好，您的訂單將於 明天 送達。\n\nMasterBox 商店');
    assert.deepEqual(payload, {
      messaging_product: 'whatsapp', recipient_type: 'individual', to: '886900', type: 'template',
      template: {
        name: 'order_update', language: { code: 'zh_TW' },
        components: [
          { type: 'header', parameters: [{ type: 'text', text: 'B777' }] },
          { type: 'body', parameters: [{ type: 'text', text: '陳小姐' }, { type: 'text', text: '明天' }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'B777' }] },
        ],
      },
    });
  });

  test('named parameters, a media header and a coupon code', () => {
    const view = templateView(NAMED_TEMPLATE);
    const media = { url: 'https://files.test/a/photo.png', filename: 'photo.png', kind: 'image' };
    const { payload, text } = templateMessage(view, [{ key: 'body:first_name', value: 'Amy' }, { key: 'coupon:0', value: 'VIP20' }], { to: '886900', headerMedia: media });
    assert.equal(text, 'Hi Amy, use your code!');
    assert.deepEqual(payload.template.components, [
      { type: 'header', parameters: [{ type: 'image', image: { link: media.url } }] },
      { type: 'body', parameters: [{ type: 'text', text: 'Amy', parameter_name: 'first_name' }] },
      { type: 'button', sub_type: 'copy_code', index: '0', parameters: [{ type: 'coupon_code', coupon_code: 'VIP20' }] },
    ]);
    assert.match(templateMessage(view, [{ key: 'body:first_name', value: 'Amy' }, { key: 'coupon:0', value: 'VIP20' }], { to: '886900' }).error, /請上傳標題圖片/);
    assert.match(templateMessage(view, [{ key: 'body:first_name', value: 'Amy' }, { key: 'coupon:0', value: 'VIP20' }], { to: '886900', headerMedia: { ...media, kind: 'video' } }).error, /需要圖片/);
    assert.match(templateMessage(view, [{ key: 'body:first_name', value: 'Amy' }, { key: 'coupon:0', value: '20% off' }], { to: '886900', headerMedia: media }).error, /優惠碼/);
  });

  test('values Meta would reject are caught before sending', () => {
    const view = templateView(ORDER_TEMPLATE);
    const base = [{ key: 'header:1', value: 'B1' }, { key: 'body:1', value: '陳' }, { key: 'body:2', value: '明天' }, { key: 'button:0:1', value: 'B1' }];
    const withValue = (key, value) => base.map(entry => (entry.key === key ? { key, value } : entry));
    assert.match(templateMessage(view, withValue('body:2', ' '), { to: '1' }).error, /請填寫「內文 \{\{2\}\}」/);
    assert.match(templateMessage(view, withValue('body:2', '第一行\n第二行'), { to: '1' }).error, /不能換行/);
    assert.match(templateMessage(view, withValue('body:2', 'a     b'), { to: '1' }).error, /連續 5 個/);
    assert.match(templateMessage(view, withValue('button:0:1', 'a b'), { to: '1' }).error, /不能有空格/);
    assert.match(templateMessage(view, withValue('header:1', 'x'.repeat(60)), { to: '1' }).error, /標題填入後最多 60/);
  });
});

describe('reply rules in the database', { skip: !testDatabase && 'set TEST_DATABASE_URL to a migrated database' }, () => {
  let prisma, conversations, utils, quickReplies;
  const run = randomUUID().slice(0, 8);
  const ids = {};
  let agent, colleague;

  const room = (platform, channelId, chatRoomId, customerId) => prisma.chatRoom.create({
    data: { companyId: ids.company, platform, channelId, chatRoomId, users: [{ id: customerId, first_name: '客戶' }] },
  });
  const stored = (target, contents, { createdBy = null, createdAt = new Date() } = {}) => prisma.message.create({
    data: { companyId: ids.company, createdBy, platform: target.platform, contents, createdAt, recipients: { create: [{ channelId: target.channelId, chatRoomIds: [target.chatRoomId] }] } },
    include: { recipients: true },
  });
  const sentTo = path => metaRequests.filter(request => request.method === 'POST' && request.path.endsWith(path));

  before(async () => {
    ({ prisma } = await import('../lib/db/prisma.js'));
    conversations = await import('../lib/messaging/conversations.js');
    utils = await import('../utils/utils.js');
    ({ default: { Query: { quickReplies } } } = await import('../graphQL/resolvers/messageTemplateResolvers.js'));
    const company = await prisma.company.create({ data: { chineseName: '測試', englishName: 'Test', email: `${run}@reply.test`, country: 'TW' } });
    ids.company = company.id;
    const [a, b] = await Promise.all(['a', 'b'].map(name => prisma.account.create({ data: { email: `${name}-${run}@reply.test`, password: 'x', role: 'user', companyId: company.id } })));
    agent = { account_id: a.id, company_id: company.id, role: 'user' };
    colleague = { account_id: b.id, company_id: company.id, role: 'user' };
    const fb = await prisma.companyChannel.create({ data: { companyId: company.id, platform: 'fb', name: 'fb', accessInfo: { id: `page-${run}`, page_id: `page-${run}`, access_token: 't' }, info: {} } });
    const wa = await prisma.companyChannel.create({ data: { companyId: company.id, platform: 'whatsapp', name: 'wa', accessInfo: { id: `phone-${run}`, phone_number_id: `phone-${run}`, whatsapp_business_account_id: `waba-${run}`, access_token: 't' }, info: {} } });
    ids.fb = fb.id;
    ids.wa = wa.id;
    await prisma.accountChannel.createMany({ data: [a, b].flatMap(({ id }) => [{ accountId: id, channelId: fb.id }, { accountId: id, channelId: wa.id }]) });
  });

  after(async () => {
    if (!prisma) return;
    await prisma.messageTemplate.deleteMany({ where: { companyId: ids.company } });
    await prisma.message.deleteMany({ where: { companyId: ids.company } });
    await prisma.chatRoom.deleteMany({ where: { companyId: ids.company } });
    await prisma.companyChannel.deleteMany({ where: { companyId: ids.company } });
    await prisma.account.deleteMany({ where: { companyId: ids.company } });
    await prisma.company.delete({ where: { id: ids.company } });
    await prisma.$disconnect();
  });

  test('the conversation says how long it can still be answered, counted from the customer, not the agent', async () => {
    const chat = await room('whatsapp', ids.wa, `886911${run}`, `886911${run}`);
    const customerAt = new Date(Date.now() - 2 * HOUR);
    await stored(chat, '請問還有貨嗎', { createdAt: customerAt });
    await stored(chat, '有的', { createdBy: agent.account_id, createdAt: new Date(Date.now() - HOUR) });
    const [view] = await conversations.roomViews(agent, [chat.id]);
    assert.deepEqual(view.lastCustomerMessageAt, customerAt);
    assert.equal(view.replyWindow.state, 'open');
    assert.deepEqual(view.replyWindow.closesAt, at(customerAt, STANDARD_WINDOW_MS));
    assert.equal(view.replyWindow.templateRequired, false);
  });

  test('WhatsApp free-form replies after 24 hours are stopped before reaching Meta', async () => {
    const chat = await room('whatsapp', ids.wa, `886922${run}`, `886922${run}`);
    await stored(chat, '昨天的問題', { createdAt: new Date(Date.now() - 30 * HOUR) });
    const before = metaRequests.length;
    await assert.rejects(utils.handleSendMessage(agent.account_id, chat.chatRoomId, '還在嗎？', ids.wa), (error) => {
      assert.match(error.message, /只能改用已核准的範本/);
      assert.equal(error.extensions.templateRequired, true);
      return true;
    });
    assert.equal(metaRequests.length, before);
    const [view] = await conversations.roomViews(agent, [chat.id]);
    assert.equal(view.replyWindow.state, 'closed');
    assert.equal(view.replyWindow.templateRequired, true);
  });

  test('Messenger replies between 24 hours and 7 days go with the human agent tag', async () => {
    const chat = await room('fb', ids.fb, `t_${run}`, `psid-${run}`);
    await stored(chat, '上週的問題', { createdAt: new Date(Date.now() - 3 * 24 * HOUR) });
    await utils.handleSendMessage(agent.account_id, chat.chatRoomId, '抱歉久等了', ids.fb);
    const [request] = sentTo(`/page-${run}/messages`).slice(-1);
    assert.equal(request.body.messaging_type, 'MESSAGE_TAG');
    assert.equal(request.body.tag, 'HUMAN_AGENT');

    const fresh = await room('fb', ids.fb, `t2_${run}`, `psid2-${run}`);
    await stored(fresh, '剛剛的問題');
    await utils.handleSendMessage(agent.account_id, fresh.chatRoomId, '馬上幫您查', ids.fb);
    assert.equal(sentTo(`/page-${run}/messages`).slice(-1)[0].body.messaging_type, 'RESPONSE');
  });

  test('an approved template goes out after 24 hours and the conversation keeps its text', async () => {
    metaTemplates = [ORDER_TEMPLATE, FLOW_TEMPLATE, { ...NAMED_TEMPLATE, status: 'PAUSED' }];
    const chat = await room('whatsapp', ids.wa, `886933${run}`, `886933${run}`);
    await stored(chat, '上次的訂單', { createdAt: new Date(Date.now() - 48 * HOUR) });

    const listed = await utils.listWhatsappTemplates(chat);
    assert.deepEqual(listed.map(({ name, supported }) => [name, supported]), [['order_update', true], ['signup_flow', false]]);
    assert.equal(metaRequests.filter(({ path }) => path.endsWith(`/waba-${run}/message_templates`)).slice(-1)[0].query.status, 'APPROVED');

    const values = [{ key: 'header:1', value: 'C9' }, { key: 'body:1', value: '林先生' }, { key: 'body:2', value: '週一' }, { key: 'button:0:1', value: 'C9' }];
    const message = await utils.sendWhatsappTemplate(agent.account_id, chat, { templateId: '1001', values });
    const request = sentTo(`/phone-${run}/messages`).slice(-1)[0];
    assert.equal(request.body.type, 'template');
    assert.equal(request.body.to, chat.chatRoomId);
    assert.equal(request.body.template.name, 'order_update');
    const contents = message.contents;
    assert.equal(contents.v, 1);
    assert.equal(contents.text, '訂單 C9\n\n林先生 您好，您的訂單將於 週一 送達。\n\nMasterBox 商店');
    assert.equal(contents.template.name, 'order_update');
    assert.ok(message.externalId);

    // The window is still closed: a template doesn't open it, only the customer writing back does.
    const [view] = await conversations.roomViews(agent, [chat.id]);
    assert.equal(view.replyWindow.state, 'closed');
    assert.equal(view.lastMessage, contents.text);

    await assert.rejects(utils.sendWhatsappTemplate(agent.account_id, chat, { templateId: '1002', values: [] }), /找不到這個範本/);
    await assert.rejects(utils.sendWhatsappTemplate(agent.account_id, chat, { templateId: '1001', values: values.slice(1) }), /請填寫「標題 \{\{1\}\}」/);
    await assert.rejects(utils.sendWhatsappTemplate(agent.account_id, chat, { templateId: '1003', values: [] }), /Flow/);
  });

  test('templates are only for WhatsApp conversations', async () => {
    const chat = await room('fb', ids.fb, `t3_${run}`, `psid3-${run}`);
    await assert.rejects(utils.listWhatsappTemplates(chat), /只有 WhatsApp/);
  });

  test('isMine is whoever looks at the message', async () => {
    const chat = await room('fb', ids.fb, `t4_${run}`, `psid4-${run}`);
    const mine = await stored(chat, '我回的', { createdBy: agent.account_id });
    const customer = await stored(chat, '客戶說的');
    assert.equal(utils.messageView(mine, chat.chatRoomId, agent.account_id).isMine, true);
    assert.equal(utils.messageView(mine, chat.chatRoomId, colleague.account_id).isMine, false);
    assert.equal(utils.messageView(customer, chat.chatRoomId, agent.account_id).isMine, false);
    assert.equal(utils.messageView(customer, chat.chatRoomId).isMine, null);
  });

  test('every agent can read the company’s templates as quick replies', async () => {
    await prisma.messageTemplate.create({ data: { companyId: ids.company, createdBy: agent.account_id, updatedBy: agent.account_id, name: '營業時間', category: 'general', platform: 'fb', contents: { messages: [{ type: 'text', text: '我們每天 10:00 營業' }] } } });
    const replies = await quickReplies(null, null, { account: agent, isAuth: true });
    assert.deepEqual(replies.map(({ name }) => name), ['營業時間']);
    assert.equal(JSON.parse(replies[0].contents).messages[0].text, '我們每天 10:00 營業');
    await assert.rejects(quickReplies(null, null, { isAuth: false }), /token/);
  });
});
