// Channel permissions on every way in to conversations, and assigning conversations to agents.
// The database tests need a migrated PostgreSQL in TEST_DATABASE_URL; they make and remove their own company.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const testDatabase = process.env.TEST_DATABASE_URL;
if (testDatabase) process.env.DATABASE_URL = testDatabase;
// Live updates are recorded below instead of going through Redis.
delete process.env.REDIS_CONNECTION;
// Signs the tokens of the call test.
process.env.JWT_SECRET ||= `teamwork-test-${randomUUID()}`;

describe('channel permissions and assignment', { skip: !testDatabase && 'set TEST_DATABASE_URL to a migrated database' }, () => {
  let prisma, pubsub, conversations, resolvers, accountResolvers, express, realtime;
  const run = randomUUID().slice(0, 8);
  const ids = {};
  // admin: sees every channel without being given any. fbAgent and fbAgent2: only Facebook. waAgent: only WhatsApp.
  const who = {};
  const published = [];

  // The context a signed-in request gets, with the role read from the database as auth does.
  const ctx = account => ({ isAuth: true, account });
  const Q = (name, args, account) => resolvers.Query[name](null, args, ctx(account));
  const M = (name, args, account) => resolvers.Mutation[name](null, args, ctx(account));
  const updatesFor = (account, kind) => published.filter(({ channel, payload }) => channel === `${kind}-${account.account_id}` && payload);

  before(async () => {
    ({ prisma } = await import('../lib/db/prisma.js'));
    ({ pubsub } = await import('../config/redis.js'));
    pubsub.publish = async (channel, payload) => { published.push({ channel, payload }); };
    conversations = await import('../lib/messaging/conversations.js');
    resolvers = (await import('../graphQL/resolvers/messageResolvers.js')).default;
    accountResolvers = (await import('../graphQL/resolvers/accountsResolvers.js')).default;
    express = (await import('express')).default;
    realtime = (await import('../route/realtime.js')).default;

    const company = await prisma.company.create({ data: { chineseName: '團隊', englishName: 'Team', email: `${run}@teamwork.test`, country: 'TW' } });
    ids.company = company.id;
    const other = await prisma.company.create({ data: { chineseName: '別家', englishName: 'Other', email: `${run}-other@teamwork.test`, country: 'TW' } });
    ids.other = other.id;
    const account = (name, role, companyId = company.id) => prisma.account.create({
      data: { email: `${name}-${run}@teamwork.test`, password: 'x', companyId, role, userInfo: { name } },
    });
    const made = {
      admin: await account('admin', 'admin'),
      fbAgent: await account('fbAgent', 'user'),
      fbAgent2: await account('fbAgent2', 'user'),
      waAgent: await account('waAgent', 'user'),
      stranger: await account('stranger', 'admin', other.id),
    };
    for (const [name, record] of Object.entries(made)) who[name] = { account_id: record.id, company_id: record.companyId, role: record.role };

    const channel = (platform) => prisma.companyChannel.create({
      data: { companyId: company.id, platform, name: `${platform}-${run}`, accessInfo: { id: `${platform}-${run}`, page_id: `${platform}-${run}` }, info: {} },
    });
    ids.fb = (await channel('fb')).id;
    ids.wa = (await channel('whatsapp')).id;
    await prisma.accountChannel.createMany({ data: [
      { accountId: who.fbAgent.account_id, channelId: ids.fb },
      { accountId: who.fbAgent2.account_id, channelId: ids.fb },
      { accountId: who.waAgent.account_id, channelId: ids.wa },
    ] });

    const room = async (channelId, platform, chatRoomId, updatedAt) => prisma.chatRoom.create({
      data: { companyId: company.id, platform, channelId, chatRoomId, users: [{ id: `${chatRoomId}-customer`, name: chatRoomId }], updatedAt },
    });
    ids.fbRoom = (await room(ids.fb, 'fb', `fb-room-${run}`, new Date('2026-03-01T00:00:00Z'))).id;
    ids.fbRoom2 = (await room(ids.fb, 'fb', `fb-room2-${run}`, new Date('2026-02-01T00:00:00Z'))).id;
    ids.waRoom = (await room(ids.wa, 'whatsapp', `886900${run}`, new Date('2026-01-01T00:00:00Z'))).id;
    const message = (roomKey, channelId, platform, contents) => prisma.message.create({
      data: { companyId: company.id, platform, contents, recipients: { create: [{ channelId, chatRoomIds: [roomKey] }] } },
    });
    ids.fbMessage = (await message(`fb-room-${run}`, ids.fb, 'fb', '臉書客戶的訊息')).id;
    ids.waMessage = (await message(`886900${run}`, ids.wa, 'whatsapp', 'WhatsApp 客戶的訊息')).id;
  });

  after(async () => {
    if (!prisma) return;
    for (const companyId of [ids.company, ids.other]) {
      await prisma.auditLog.deleteMany({ where: { companyId } });
      await prisma.message.deleteMany({ where: { companyId } });
      await prisma.chatRoom.deleteMany({ where: { companyId } });
      await prisma.account.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await prisma.$disconnect();
  });

  beforeEach(() => { published.length = 0; });

  const roomIdsOf = rooms => rooms.map(({ id }) => id).sort();

  describe('who sees which conversations', () => {
    test('an agent only gets the conversations of its own channels, by every query', async () => {
      assert.deepEqual(roomIdsOf((await Q('chatRoomPage', {}, who.fbAgent)).rooms), [ids.fbRoom, ids.fbRoom2].sort());
      assert.deepEqual(roomIdsOf(await Q('chatRooms', {}, who.fbAgent)), [ids.fbRoom, ids.fbRoom2].sort());
      assert.deepEqual(roomIdsOf(await Q('chatRooms', {}, who.waAgent)), [ids.waRoom]);
      assert.deepEqual((await Q('getUserSubscribedChannels', {}, who.fbAgent)).map(({ channel_id }) => channel_id), [ids.fb]);

      // Asking for the other channel by name gets nothing rather than an error.
      assert.deepEqual((await Q('chatRoomPage', { filter: { channel_id: ids.wa } }, who.fbAgent)).rooms, []);
      assert.equal(await Q('chatRoom', { id: ids.waRoom }, who.fbAgent), null);
      assert.equal(await Q('chatRoom', { chat_room_id: `886900${run}`, channel_id: ids.wa }, who.fbAgent), null);
      await assert.rejects(Q('messagePage', { id: ids.waRoom }, who.fbAgent), { extensions: { code: 'NOT_FOUND' } });
      await assert.rejects(Q('whatsappTemplates', { id: ids.waRoom }, who.fbAgent), { extensions: { code: 'NOT_FOUND' } });
      await assert.rejects(Q('chatRoomAssignees', { id: ids.waRoom }, who.fbAgent), { extensions: { code: 'NOT_FOUND' } });
    });

    test('the older messages query only returns messages of the agent\'s channels', async () => {
      assert.deepEqual(await Q('messages', { roomId: `886900${run}` }, who.fbAgent), []);
      assert.deepEqual((await Q('messages', { roomId: `886900${run}` }, who.waAgent)).map(({ id }) => id), [ids.waMessage]);
      // Without a conversation it used to return every message of the company.
      const all = (await Q('messages', {}, who.fbAgent)).map(({ id }) => id);
      assert.ok(all.includes(ids.fbMessage));
      assert.ok(!all.includes(ids.waMessage));
    });

    test('an agent can\'t write to a conversation of another channel', async () => {
      await assert.rejects(M('appSendMessage', { MessageInput: { to_chat_room_id: ids.waRoom, contents: '偷偷回覆', platform: 'app' } }, who.fbAgent), { extensions: { code: 'SEND_FAILED' } });
      await assert.rejects(M('appSendMessage', { MessageInput: { to_chat_room_id: `886900${run}`, contents: '偷偷回覆', channel_id: ids.wa } }, who.fbAgent), { extensions: { code: 'SEND_FAILED' } });
      await assert.rejects(M('appSendMessage', { MessageInput: { to_chat_room_id: `886900${run}`, contents: '偷偷回覆' } }, who.fbAgent), { extensions: { code: 'SEND_FAILED' } });
      await assert.rejects(M('markMessageRead', { messageId: ids.waMessage }, who.fbAgent), { extensions: { code: 'READ_FAILED' } });
      await assert.rejects(M('markChatRoomRead', { id: ids.waRoom }, who.fbAgent), { extensions: { code: 'NOT_FOUND' } });
      await assert.rejects(M('addChatRoomTag', { id: ids.waRoom, name: 'VIP' }, who.fbAgent), { extensions: { code: 'NOT_FOUND' } });
      await assert.rejects(M('removeChatRoomTag', { id: ids.waRoom, tagId: 'x' }, who.fbAgent), { extensions: { code: 'NOT_FOUND' } });
      await assert.rejects(M('sendWhatsappTemplate', { id: ids.waRoom, templateId: 't' }, who.fbAgent), { extensions: { code: 'NOT_FOUND' } });
      await assert.rejects(M('assignChatRoom', { id: ids.waRoom, assigneeId: who.fbAgent.account_id }, who.fbAgent), { extensions: { code: 'NOT_FOUND' } });
      const stored = await prisma.message.count({ where: { companyId: ids.company, contents: { equals: '偷偷回覆' } } });
      assert.equal(stored, 0);
      assert.equal((await prisma.message.findUnique({ where: { id: ids.waMessage } })).readAt, null);
    });

    test('an agent can still use its own channel the same ways', async () => {
      const sent = await M('appSendMessage', { MessageInput: { to_chat_room_id: `fb-room-${run}`, contents: '您好', platform: 'app' } }, who.fbAgent);
      assert.equal(sent.isMine, true);
      assert.equal((await M('markMessageRead', { messageId: ids.fbMessage }, who.fbAgent)).id, ids.fbMessage);
      assert.equal((await Q('messagePage', { id: ids.fbRoom }, who.fbAgent)).messages.length, 2);
    });

    test('an admin sees every channel of its company without being given any', async () => {
      assert.deepEqual(roomIdsOf((await Q('chatRoomPage', {}, who.admin)).rooms), [ids.fbRoom, ids.fbRoom2, ids.waRoom].sort());
      assert.deepEqual(roomIdsOf(await Q('chatRooms', {}, who.admin)), [ids.fbRoom, ids.fbRoom2, ids.waRoom].sort());
      assert.deepEqual((await Q('getUserSubscribedChannels', {}, who.admin)).map(({ channel_id }) => channel_id).sort(), [ids.fb, ids.wa].sort());
      assert.equal((await Q('chatRoom', { id: ids.waRoom }, who.admin)).id, ids.waRoom);
    });

    test('an admin of another company sees none of it', async () => {
      assert.deepEqual((await Q('chatRoomPage', {}, who.stranger)).rooms, []);
      assert.deepEqual(await Q('chatRooms', {}, who.stranger), []);
      assert.deepEqual(await Q('messages', { roomId: `fb-room-${run}` }, who.stranger), []);
      // Even claiming the company in its token doesn't help: the role and channels come from its own record.
      assert.deepEqual((await Q('chatRoomPage', {}, { ...who.stranger, company_id: ids.company })).rooms, []);
    });

    test('a disabled account sees nothing, and a role change applies straight away', async () => {
      await prisma.account.update({ where: { id: who.fbAgent2.account_id }, data: { enabled: false } });
      assert.deepEqual(await Q('chatRooms', {}, who.fbAgent2), []);
      await prisma.account.update({ where: { id: who.fbAgent2.account_id }, data: { enabled: true, role: 'admin' } });
      assert.equal((await Q('chatRooms', {}, who.fbAgent2)).length, 3);
      await prisma.account.update({ where: { id: who.fbAgent2.account_id }, data: { role: 'user' } });
      assert.equal((await Q('chatRooms', {}, who.fbAgent2)).length, 2);
    });

    test('new messages go live to the channel\'s agents and the admins, and nobody else', async () => {
      const { publishMessage } = await import('../utils/utils.js');
      const message = await prisma.message.findUnique({ where: { id: ids.waMessage }, include: { recipients: true } });
      await publishMessage(message);
      const to = published.map(({ channel }) => channel).sort();
      assert.deepEqual(to, [`sendMessage-${who.admin.account_id}`, `sendMessage-${who.waAgent.account_id}`].sort());
    });

    test('a call can only be started in a conversation the caller works in', async () => {
      const jwt = (await import('jsonwebtoken')).default;
      const { getJwtSecret } = await import('../lib/auth/jwtSecret.js');
      const app = express().use(express.json()).use('/api/realtime', realtime);
      const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
      try {
        const call = account => fetch(`http://127.0.0.1:${server.address().port}/api/realtime/calls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ account_id: account.account_id }, getJwtSecret())}` },
          body: JSON.stringify({ roomId: ids.waRoom, kind: 'voice' }),
        });
        assert.equal((await call(who.fbAgent)).status, 404);
        assert.equal((await call(who.waAgent)).status, 201);
      } finally {
        server.close();
        await prisma.callSession.deleteMany({ where: { companyId: ids.company } });
      }
    });
  });

  describe('assigning conversations', () => {
    const assigneeOf = async id => (await prisma.chatRoom.findUnique({ where: { id } })).assigneeId;

    test('existing conversations start unassigned', async () => {
      const page = await Q('chatRoomPage', {}, who.admin);
      assert.ok(page.rooms.every(({ assignee, assignedAt }) => assignee === null && assignedAt === null));
    });

    test('an agent takes an unassigned conversation, and everyone in the channel sees it live', async () => {
      const before = (await prisma.chatRoom.findUnique({ where: { id: ids.fbRoom } })).updatedAt;
      const room = await M('assignChatRoom', { id: ids.fbRoom, assigneeId: who.fbAgent.account_id }, who.fbAgent);
      assert.deepEqual(room.assignee, { id: who.fbAgent.account_id, name: 'fbAgent', email: `fbAgent-${run}@teamwork.test`, role: 'user' });
      assert.ok(room.assignedAt instanceof Date);
      // Assigning isn't new activity: the conversation keeps its place in the list.
      assert.deepEqual((await prisma.chatRoom.findUnique({ where: { id: ids.fbRoom } })).updatedAt, before);

      for (const account of [who.admin, who.fbAgent, who.fbAgent2]) {
        const [update] = updatesFor(account, 'chatRoomUpdated');
        assert.equal(update?.payload.chatRoomUpdated.assignee.id, who.fbAgent.account_id, account.account_id);
      }
      assert.deepEqual(updatesFor(who.waAgent, 'chatRoomUpdated'), []);
      const log = await prisma.auditLog.findFirst({ where: { companyId: ids.company, resourceId: ids.fbRoom }, orderBy: { createdAt: 'desc' } });
      assert.equal(log.action, 'chat_room.assign');
      assert.deepEqual(log.metadata, { from: null, to: who.fbAgent.account_id });
    });

    test('the list filters by mine, unassigned and agent', async () => {
      const list = async (account, filter) => roomIdsOf((await Q('chatRoomPage', { filter }, account)).rooms);
      assert.deepEqual(await list(who.fbAgent, { assignment: 'mine' }), [ids.fbRoom]);
      assert.deepEqual(await list(who.fbAgent2, { assignment: 'mine' }), []);
      assert.deepEqual(await list(who.fbAgent, { assignment: 'unassigned' }), [ids.fbRoom2]);
      assert.deepEqual(await list(who.admin, { assignment: 'unassigned' }), [ids.fbRoom2, ids.waRoom].sort());
      assert.deepEqual(await list(who.admin, { assignee_id: who.fbAgent.account_id }), [ids.fbRoom]);
      assert.deepEqual(await list(who.admin, { assignment: 'all' }), [ids.fbRoom, ids.fbRoom2, ids.waRoom].sort());
      // Someone else's conversations in a channel the agent can't see stay hidden.
      assert.deepEqual(await list(who.waAgent, { assignee_id: who.fbAgent.account_id }), []);
      await assert.rejects(Q('chatRoomPage', { filter: { assignment: 'everyone' } }, who.admin), { extensions: { code: 'BAD_USER_INPUT' } });
    });

    test('only agents who work in the channel can be picked', async () => {
      const names = async (id, account) => (await Q('chatRoomAssignees', { id }, account)).map(({ name }) => name).sort();
      assert.deepEqual(await names(ids.fbRoom, who.fbAgent), ['admin', 'fbAgent', 'fbAgent2']);
      assert.deepEqual(await names(ids.waRoom, who.admin), ['admin', 'waAgent']);
      // Without a conversation: everyone in the company, for the list's agent filter.
      assert.deepEqual((await Q('chatRoomAssignees', {}, who.fbAgent)).map(({ name }) => name).sort(), ['admin', 'fbAgent', 'fbAgent2', 'waAgent']);
      await assert.rejects(M('assignChatRoom', { id: ids.fbRoom2, assigneeId: who.waAgent.account_id }, who.admin), { extensions: { code: 'BAD_USER_INPUT' } });
      await assert.rejects(M('assignChatRoom', { id: ids.fbRoom2, assigneeId: who.stranger.account_id }, who.admin), { extensions: { code: 'BAD_USER_INPUT' } });
      assert.equal(await assigneeOf(ids.fbRoom2), null);
    });

    test('an agent can pass on its own conversation but not take a colleague\'s', async () => {
      await assert.rejects(M('assignChatRoom', { id: ids.fbRoom, assigneeId: who.fbAgent2.account_id }, who.fbAgent2), { extensions: { code: 'FORBIDDEN' } });
      await assert.rejects(M('assignChatRoom', { id: ids.fbRoom, assigneeId: null }, who.fbAgent2), { extensions: { code: 'FORBIDDEN' } });
      assert.equal(await assigneeOf(ids.fbRoom), who.fbAgent.account_id);

      const passed = await M('assignChatRoom', { id: ids.fbRoom, assigneeId: who.fbAgent2.account_id }, who.fbAgent);
      assert.equal(passed.assignee.id, who.fbAgent2.account_id);
      const log = await prisma.auditLog.findFirst({ where: { companyId: ids.company, resourceId: ids.fbRoom }, orderBy: { createdAt: 'desc' } });
      assert.equal(log.action, 'chat_room.transfer');

      // An admin can move anyone's conversation, and give it up.
      assert.equal((await M('assignChatRoom', { id: ids.fbRoom, assigneeId: who.admin.account_id }, who.admin)).assignee.id, who.admin.account_id);
      assert.equal((await M('assignChatRoom', { id: ids.fbRoom, assigneeId: null }, who.admin)).assignee, null);
      assert.equal(await assigneeOf(ids.fbRoom), null);
    });

    test('two agents taking the same conversation at once: the second is told', async () => {
      const room = await prisma.chatRoom.findUnique({ where: { id: ids.fbRoom2 } });
      await conversations.assignRoom(who.fbAgent, room, who.fbAgent.account_id);
      // fbAgent2 still has the conversation as it was before fbAgent took it.
      await assert.rejects(conversations.assignRoom(who.fbAgent2, room, who.fbAgent2.account_id), error => ['FORBIDDEN', 'CONFLICT'].includes(error.extensions?.code));
      await assert.rejects(conversations.assignRoom(who.admin, room, who.admin.account_id), { extensions: { code: 'CONFLICT' } });
      assert.equal(await assigneeOf(ids.fbRoom2), who.fbAgent.account_id);
    });

    test('losing a channel, being disabled or deleted hands the conversations back to the team', async () => {
      await M('assignChatRoom', { id: ids.waRoom, assigneeId: who.waAgent.account_id }, who.waAgent);
      const update = (account, input) => accountResolvers.Mutation.updateAccount(null, { _id: account.account_id, input }, ctx(who.admin));

      // fbAgent has fbRoom2. Given WhatsApp instead of Facebook, it lets fbRoom2 go.
      const changed = await update(who.fbAgent, { channel_ids: [ids.wa] });
      assert.deepEqual(changed.channel_ids, [ids.wa]);
      assert.equal(await assigneeOf(ids.fbRoom2), null);
      assert.equal(updatesFor(who.admin, 'chatRoomUpdated').at(-1).payload.chatRoomUpdated.assignee, null);
      assert.deepEqual(roomIdsOf(await Q('chatRooms', {}, who.fbAgent)), [ids.waRoom]);
      await assert.rejects(accountResolvers.Mutation.updateAccount(null, { _id: who.fbAgent.account_id, input: { channel_ids: ['not-ours'] } }, ctx(who.admin)), { extensions: { code: 'BAD_USER_INPUT' } });
      await update(who.fbAgent, { channel_ids: [ids.fb] });

      // Disabled: everything it had goes back.
      await update(who.waAgent, { enabled: false });
      assert.equal(await assigneeOf(ids.waRoom), null);
      await update(who.waAgent, { enabled: true });

      // Deleted: its conversations stay, unassigned.
      const temp = await accountResolvers.Mutation.createAccount(null, { company_id: ids.company, input: { email: `temp-${run}@teamwork.test`, password: 'secret1', role: 'user', channel_ids: [ids.wa] } }, ctx(who.admin));
      assert.deepEqual(temp.channel_ids, [ids.wa]);
      const tempAgent = { account_id: temp._id, company_id: ids.company };
      await M('assignChatRoom', { id: ids.waRoom, assigneeId: temp._id }, tempAgent);
      await accountResolvers.Mutation.deleteAccount(null, { _id: temp._id }, ctx(who.admin));
      assert.equal(await assigneeOf(ids.waRoom), null);
      assert.ok(await prisma.chatRoom.findUnique({ where: { id: ids.waRoom } }));
    });

    test('accounts list their channels for the admin', async () => {
      const { items } = await accountResolvers.Query.listAccounts(null, {}, ctx(who.admin));
      const byName = Object.fromEntries(items.map(item => [item.info.name, item.channel_ids]));
      assert.deepEqual(byName.fbAgent, [ids.fb]);
      assert.deepEqual(byName.waAgent, [ids.wa]);
      assert.deepEqual(byName.admin, []);
    });
  });
});
