// The conversation list: previews, paging, unread counts, catching up after a disconnect, search and tags.
// The database tests need a migrated PostgreSQL in TEST_DATABASE_URL; they make and remove their own company.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const testDatabase = process.env.TEST_DATABASE_URL;
if (testDatabase) process.env.DATABASE_URL = testDatabase;
// Live updates aren't under test here; publishing goes nowhere without Redis.
delete process.env.REDIS_CONNECTION;

const { messagePreview, encodeCursor, decodeCursor, pageSize, searchPattern, customerOf } = await import('../lib/messaging/conversationText.js');

describe('conversation text', () => {
  test('previews show the text, or a label for an attachment', () => {
    assert.equal(messagePreview('你好'), '你好');
    assert.equal(messagePreview(JSON.stringify({ text: '早安', attachments: [] })), '早安');
    assert.equal(messagePreview(JSON.stringify({ mid: 'm1', attachments: [{ type: 'image', payload: { url: 'https://x/a.png' } }] })), '[圖片]');
    assert.equal(messagePreview(JSON.stringify({ recipient: { id: 'p1' }, message: { attachments: [{ type: 'file' }] } })), '[檔案]');
    assert.equal(messagePreview(JSON.stringify({ recipient: { id: 'p1' }, message: { text: '回覆' } })), '回覆');
    // WhatsApp keeps text under body, and puts a caption on the attachment.
    assert.equal(messagePreview(JSON.stringify({ id: 'w1', message: { body: '哈囉' } })), '哈囉');
    assert.equal(messagePreview(JSON.stringify({ id: 'w2', attachments: [{ type: 'video', caption: '開箱' }] })), '[影片] 開箱');
    assert.equal(messagePreview(JSON.stringify({ attachments: [{ type: 'something_new' }] })), '[附件]');
    assert.equal(messagePreview(JSON.stringify({ ciphertext: 'x', nonce: 'y' }), 'e2ee'), '[加密訊息]');
    assert.equal(messagePreview(JSON.stringify({ unknown: true })), '[不支援的訊息類型]');
  });

  test('cursors round-trip and reject anything else', () => {
    const time = new Date('2026-11-06T01:02:03.456Z');
    assert.deepEqual(decodeCursor(encodeCursor(time, 'abc')), { time, id: 'abc' });
    assert.equal(decodeCursor('not-a-cursor'), null);
    assert.equal(decodeCursor(Buffer.from('2026-13-01|x').toString('base64url')), null);
    assert.equal(decodeCursor(''), null);
  });

  test('page sizes stay within bounds', () => {
    assert.equal(pageSize(undefined), 30);
    assert.equal(pageSize(0), 1);
    assert.equal(pageSize(500), 100);
    assert.equal(pageSize(20), 20);
  });

  test('search takes % and _ literally', () => {
    assert.equal(searchPattern('  '), null);
    assert.equal(searchPattern('50%_off'), '%50\\%\\_off%');
    assert.equal(searchPattern('a\\b'), '%a\\\\b%');
  });

  test('the customer is whoever in the conversation is not the channel', () => {
    const room = { platform: 'whatsapp', channelId: 'ch1', users: [{ id: 'ch1', name: 'Shop' }, { id: '886912345678', name: '王小明' }] };
    assert.deepEqual(customerOf(room), { id: '886912345678', name: '王小明', avatar: null, username: null, phone: '+886912345678' });
    const ig = customerOf({ platform: 'ig', channelId: 'ch2', users: [{ id: 'ig1', first_name: 'Amy', username: 'amy.c', avatar: 'https://x/a.jpg' }] });
    assert.equal(ig.name, 'Amy');
    assert.equal(ig.username, 'amy.c');
    assert.equal(ig.phone, null);
    assert.equal(customerOf({ channelId: 'c', users: [] }), null);
  });
});

describe('conversations in the database', { skip: !testDatabase && 'set TEST_DATABASE_URL to a migrated database' }, () => {
  let prisma, conversations, saveInboundMessage;
  const run = randomUUID().slice(0, 8);
  const ids = {};
  let agentA, agentB, outsider;
  let clock = Date.parse('2026-01-01T00:00:00.000Z');
  const nextTime = (ms = 1000) => new Date((clock += ms));

  // A customer message the way a webhook stores it.
  const inbound = (externalChannelId, platform, chatRoomId, contents, customer) => saveInboundMessage({
    externalChannelId, platform, chatRoomId, contents, customer, externalId: `${run}-${randomUUID()}`,
  });

  // A message stored directly, with a set time, so ordering is exact.
  const stored = async (room, contents, { createdBy = null, at = nextTime() } = {}) => prisma.message.create({
    data: {
      companyId: ids.company, createdBy, platform: room.platform, contents, createdAt: at,
      recipients: { create: [{ channelId: room.channelId, chatRoomIds: [room.chatRoomId || room.id] }] },
    },
  });

  before(async () => {
    ({ prisma } = await import('../lib/db/prisma.js'));
    conversations = await import('../lib/messaging/conversations.js');
    ({ saveInboundMessage } = await import('../utils/utils.js'));
    const company = await prisma.company.create({ data: { chineseName: '測試', englishName: 'Test', email: `${run}@conversations.test`, country: 'TW' } });
    ids.company = company.id;
    // Agents rather than admins, who would see every channel.
    const account = email => prisma.account.create({ data: { email: `${email}-${run}@conversations.test`, password: 'x', companyId: company.id, role: 'user' } });
    const [a, b, c] = await Promise.all([account('a'), account('b'), account('c')]);
    agentA = { account_id: a.id, company_id: company.id };
    agentB = { account_id: b.id, company_id: company.id };
    outsider = { account_id: c.id, company_id: company.id };
    const channel = (platform, externalId) => prisma.companyChannel.create({
      data: { companyId: company.id, platform, name: `${platform}-${run}`, accessInfo: { id: externalId, page_id: externalId }, info: {} },
    });
    const fb = await channel('fb', `fb-${run}`);
    const wa = await channel('whatsapp', `wa-${run}`);
    ids.fb = fb.id;
    ids.wa = wa.id;
    // The outsider works in neither channel.
    await prisma.accountChannel.createMany({ data: [a, b].flatMap(({ id }) => [{ accountId: id, channelId: fb.id }, { accountId: id, channelId: wa.id }]) });
  });

  after(async () => {
    if (!prisma) return;
    await prisma.message.deleteMany({ where: { companyId: ids.company } });
    await prisma.chatRoom.deleteMany({ where: { companyId: ids.company } });
    await prisma.account.deleteMany({ where: { companyId: ids.company } });
    await prisma.company.delete({ where: { id: ids.company } });
    await prisma.$disconnect();
  });

  const roomOf = chatRoomId => prisma.chatRoom.findFirst({ where: { companyId: ids.company, chatRoomId } });

  test('the list pages through every conversation once, newest first', async () => {
    for (let i = 0; i < 45; i += 1) {
      const room = await prisma.chatRoom.create({
        data: { companyId: ids.company, platform: 'fb', channelId: ids.fb, chatRoomId: `page-${run}-${i}`, users: [{ id: `psid-${i}`, first_name: `客戶${i}` }], updatedAt: nextTime() },
      });
      await stored(room, `第 ${i} 位客戶的訊息`, { at: room.updatedAt });
    }
    const seen = [];
    let after;
    let pages = 0;
    do {
      const page = await conversations.listRooms(agentA, { first: 20, after, filter: { channel_id: ids.fb } });
      seen.push(...page.rooms);
      after = page.nextCursor;
      pages += 1;
      assert.equal(page.hasMore, Boolean(page.nextCursor));
    } while (after);
    assert.equal(pages, 3);
    assert.equal(seen.length, 45);
    assert.equal(new Set(seen.map(({ id }) => id)).size, 45);
    const times = seen.map(({ updatedAt }) => updatedAt.getTime());
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
    assert.equal(seen[0].lastMessage, '第 44 位客戶的訊息');
    assert.equal(seen[0].customer.name, '客戶44');
  });

  test('a new message moves its conversation to the top and shows as its last message', async () => {
    await inbound(`fb-${run}`, 'fb', `page-${run}-3`, { mid: 'x', attachments: [{ type: 'image', payload: { url: 'http://example.test/a.png' } }] }, { id: 'psid-3' });
    const { rooms } = await conversations.listRooms(agentA, { first: 5, filter: { channel_id: ids.fb } });
    assert.equal(rooms[0].chat_room_id, `page-${run}-3`);
    assert.equal(rooms[0].lastMessage, '[圖片]');
    assert.equal(rooms[0].lastMessageInbound, true);
  });

  test('each account keeps its own unread count', async () => {
    const key = `unread-${run}`;
    const customer = { id: 'wa-customer', name: '陳小姐' };
    for (const text of ['在嗎', '想問價格', '謝謝']) await inbound(`wa-${run}`, 'whatsapp', key, { id: randomUUID(), message: { body: text } }, customer);
    const room = await roomOf(key);
    const unreadFor = async agent => (await conversations.roomViews(agent, [room.id]))[0].unreadCount;
    assert.equal(await unreadFor(agentA), 3);
    assert.equal(await unreadFor(agentB), 3);

    await conversations.markRoomRead(agentA, room);
    assert.equal(await unreadFor(agentA), 0);
    assert.equal(await unreadFor(agentB), 3);

    // The company's own replies are never unread.
    await stored(room, '您好，請稍等', { createdBy: agentB.account_id, at: new Date() });
    const later = await inbound(`wa-${run}`, 'whatsapp', key, { id: randomUUID(), message: { body: '好的' } }, customer);
    assert.equal(await unreadFor(agentA), 1);
    assert.equal(await unreadFor(agentB), 4);

    // Reading up to an older message never moves the position back.
    const first = (await conversations.listMessages(agentA, room, {})).messages[0];
    await conversations.markRoomRead(agentA, room, later.id);
    await conversations.markRoomRead(agentA, room, first.id);
    assert.equal(await unreadFor(agentA), 0);

    const unreadOnly = await conversations.listRooms(agentA, { filter: { unread_only: true } });
    assert.ok(!unreadOnly.rooms.some(({ id }) => id === room.id));
    const unreadForB = await conversations.listRooms(agentB, { filter: { unread_only: true } });
    assert.ok(unreadForB.rooms.some(({ id }) => id === room.id));
  });

  test('the unread total counts conversations, for each account in its own channels', async () => {
    const room = await roomOf(`unread-${run}`);
    const totalB = await conversations.countUnreadRooms(agentB);
    // A has read this one; otherwise both see the same conversations.
    assert.equal(await conversations.countUnreadRooms(agentA), totalB - 1);
    assert.equal(await conversations.countUnreadRooms(outsider), 0);

    await conversations.markRoomRead(agentB, room);
    assert.equal(await conversations.countUnreadRooms(agentB), totalB - 1);

    // Two messages in one conversation count it once.
    const customer = { id: 'wa-customer', name: '陳小姐' };
    for (const text of ['還在嗎', '急件']) await inbound(`wa-${run}`, 'whatsapp', `unread-${run}`, { id: randomUUID(), message: { body: text } }, customer);
    assert.equal(await conversations.countUnreadRooms(agentB), totalB);
    await conversations.markRoomRead(agentA, room);
    await conversations.markRoomRead(agentB, room);
  });

  test('messages page back to the oldest without gaps or repeats', async () => {
    const room = await prisma.chatRoom.create({ data: { companyId: ids.company, platform: 'fb', channelId: ids.fb, chatRoomId: `history-${run}`, users: [] } });
    const at = nextTime();
    // Several messages share a millisecond, which the id breaks.
    for (let i = 0; i < 75; i += 1) await stored(room, `#${i}`, { at: i % 5 === 0 ? at : nextTime(10) });
    const texts = [];
    let before;
    let page;
    do {
      page = await conversations.listMessages(agentA, room, { first: 30, before });
      texts.unshift(...page.messages.map(({ contents }) => contents));
      before = page.hasOlder ? encodeCursor(page.messages[0].createdAt, page.messages[0].id) : null;
    } while (before);
    assert.equal(texts.length, 75);
    assert.equal(new Set(texts).size, 75);
    const times = (await prisma.message.findMany({ where: { recipients: { some: { chatRoomIds: { has: `history-${run}` } } } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map(({ contents }) => contents);
    assert.deepEqual(texts, times);
  });

  test('catching up after a disconnect returns only what is newer, in order', async () => {
    const room = await prisma.chatRoom.create({ data: { companyId: ids.company, platform: 'fb', channelId: ids.fb, chatRoomId: `catchup-${run}`, users: [] } });
    for (let i = 0; i < 5; i += 1) await stored(room, `seen ${i}`);
    const { messages: seen } = await conversations.listMessages(agentA, room, {});
    const lastSeen = seen[seen.length - 1];
    // These arrive while the agent's connection is down.
    for (let i = 0; i < 12; i += 1) await stored(room, `missed ${i}`);
    const cursor = encodeCursor(lastSeen.createdAt, lastSeen.id);
    const first = await conversations.listMessages(agentA, room, { after: cursor, first: 10 });
    assert.equal(first.hasNewer, true);
    const last = first.messages[first.messages.length - 1];
    const rest = await conversations.listMessages(agentA, room, { after: encodeCursor(last.createdAt, last.id), first: 10 });
    assert.equal(rest.hasNewer, false);
    assert.deepEqual([...first.messages, ...rest.messages].map(({ contents }) => contents), Array.from({ length: 12 }, (_, i) => `missed ${i}`));
    const nothing = await conversations.listMessages(agentA, room, { after: encodeCursor(rest.messages.at(-1).createdAt, rest.messages.at(-1).id) });
    assert.deepEqual(nothing.messages, []);
  });

  test('search finds customers by name and messages by their text, on the server', async () => {
    await inbound(`fb-${run}`, 'fb', `search-name-${run}`, { mid: 'a', text: '你好' }, { id: 'psid-name', first_name: '小美', last_name: '林' });
    await inbound(`fb-${run}`, 'fb', `search-text-${run}`, { mid: 'b', text: '請問 50%_off 的優惠還有嗎', attachments: [{ type: 'image', payload: { url: 'http://example.test/coupon.png' } }] }, { id: 'psid-text' });
    const search = async (words, extra = {}) => (await conversations.listRooms(agentA, { first: 100, filter: { search: words, ...extra } })).rooms.map(({ chat_room_id }) => chat_room_id);

    assert.deepEqual(await search('小美'), [`search-name-${run}`]);
    assert.deepEqual(await search('林小美'), [`search-name-${run}`]);
    assert.deepEqual(await search('50%_off'), [`search-text-${run}`]);
    // Neither JSON keys nor links count as words in a message.
    assert.ok(!(await search('attachments')).includes(`search-text-${run}`));
    assert.ok(!(await search('coupon.png')).includes(`search-text-${run}`));
    assert.deepEqual(await search('50%_off', { platform: 'whatsapp' }), []);
    assert.deepEqual(await search('想問價格'), [`unread-${run}`]);
    assert.deepEqual(await search('陳小姐', { platform: 'whatsapp' }), [`unread-${run}`]);
    // Searching beyond the first page: the 45 conversations made earlier are all reachable.
    assert.deepEqual(await search('第 0 位客戶'), [`page-${run}-0`]);
  });

  test('accounts only see the channels they work in', async () => {
    const page = await conversations.listRooms(outsider, {});
    assert.deepEqual(page.rooms, []);
    const room = await roomOf(`unread-${run}`);
    await assert.rejects(conversations.findAccountRoom(outsider, { id: room.id }), { extensions: { code: 'NOT_FOUND' } });
    const found = await conversations.findAccountRoom(agentA, { chatRoomId: `unread-${run}`, channelId: ids.wa });
    assert.equal(found.id, room.id);
  });

  test('tags belong to the company and can be added and removed', async () => {
    const room = await roomOf(`unread-${run}`);
    await conversations.addRoomTag(agentA, room, '  VIP ');
    await conversations.addRoomTag(agentB, room, 'VIP');
    await conversations.addRoomTag(agentA, room, '首購');
    let [view] = await conversations.roomViews(agentA, [room.id]);
    assert.deepEqual(view.tags.map(({ name }) => name), ['VIP', '首購']);
    const tags = await conversations.companyTags(agentA);
    assert.deepEqual(tags.map(({ name }) => name), ['VIP', '首購']);
    await assert.rejects(conversations.addRoomTag(agentA, room, ' '), { extensions: { code: 'BAD_USER_INPUT' } });
    await assert.rejects(conversations.addRoomTag(agentA, room, '超'.repeat(21)), { extensions: { code: 'BAD_USER_INPUT' } });

    await conversations.removeRoomTag(agentA, room, tags.find(({ name }) => name === 'VIP').id);
    [view] = await conversations.roomViews(agentA, [room.id]);
    assert.deepEqual(view.tags.map(({ name }) => name), ['首購']);
    assert.equal((await conversations.companyTags(agentA)).length, 2);
  });
});
