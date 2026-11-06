// The conversation list and a conversation's messages, a page at a time, with each account's unread count.
import prismaClientPackage from '@prisma/client';
import { ApolloError } from 'apollo-server-errors';
import { prisma } from '../db/prisma.js';
import { messagePreview, encodeCursor, decodeCursor, pageSize, searchPattern, customerOf } from './conversationText.js';
import { replyWindow } from './replyWindow.js';

const { Prisma } = prismaClientPackage;

const PLATFORMS = ['fb', 'ig', 'whatsapp', 'line', 'wechat'];
const TAG_MAX_LENGTH = 20;

// Messages are linked to a conversation by its platform id (or its own id when it has none) and its channel.
const ROOM_KEY = Prisma.sql`COALESCE(r.chat_room_id, r.id)`;

// The messages of conversation r that can still be read. `now` keeps the comparison in the column's own time zone.
const roomMessages = now => Prisma.sql`
  FROM messages m
  JOIN message_recipients mr ON mr.message_id = m.id
  WHERE mr.to_chat_room_id @> ARRAY[${ROOM_KEY}]::text[]
    AND mr.channel_id = r.channel_id
    AND m.company_id = r.company_id
    AND (m.expires_at IS NULL OR m.expires_at > ${now})`;

// Customer messages after the account's read position, with rd being the account's chat_room_reads row.
const UNREAD = Prisma.sql`m.created_by IS NULL AND m.created_at > COALESCE(rd.last_read_at, '-infinity'::timestamp)`;

// The text people read in a message. Stored contents are often a JSON message kept as a string,
// so take its text, body or caption rather than matching keys and links in the JSON.
const TEXT_IN_JSON = '"(?:text|body|caption)"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"';
const MESSAGE_TEXT = Prisma.sql`(CASE
  WHEN jsonb_typeof(m.contents) = 'string' AND left(m.contents #>> '{}', 1) <> '{' THEN m.contents #>> '{}'
  WHEN jsonb_typeof(m.contents) = 'string' THEN substring(m.contents #>> '{}' from ${TEXT_IN_JSON})
  ELSE substring(m.contents::text from ${TEXT_IN_JSON})
END)`;

// The customer's names, username and platform id, so agents can search by any of them.
const CUSTOMER_MATCHES = pattern => Prisma.sql`EXISTS (
  SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.users) = 'array' THEN r.users ELSE '[]'::jsonb END) u
  WHERE COALESCE(u->>'id', '') <> r.channel_id
    AND concat_ws(' ', u->>'name', u->>'first_name', u->>'last_name', concat(u->>'first_name', u->>'last_name'),
      concat(u->>'last_name', u->>'first_name'), u->>'username', u->>'id') ILIKE ${pattern})`;

/** The channels an account works in; it only sees their conversations. */
const accountChannelIds = async (account) => {
  const channels = await prisma.companyChannel.findMany({
    where: { companyId: account.company_id, accounts: { some: { accountId: account.account_id } } },
    select: { id: true },
  });
  return channels.map(({ id }) => id);
};

/**
 * A conversation the account may open, by its own id, or by its platform id and channel as messages carry them.
 * @throws NOT_FOUND when it doesn't exist or is in a channel the account doesn't work in
 */
export const findAccountRoom = async (account, { id, chatRoomId, channelId }) => {
  const channelIds = await accountChannelIds(account);
  const where = id
    ? { id }
    : { channelId, OR: [{ chatRoomId }, { id: chatRoomId }] };
  const room = (id || (chatRoomId && channelId))
    ? await prisma.chatRoom.findFirst({ where: { ...where, companyId: account.company_id, channelId: { in: channelIds } } })
    : null;
  if (!room) throw new ApolloError('找不到這段對話', 'NOT_FOUND');
  return room;
};

/**
 * For each conversation: its last message and how many customer messages the account hasn't read.
 * @returns {Map<string, { unread: number, last?: object }>}
 */
const roomStats = async (accountId, roomIds) => {
  if (!roomIds.length) return new Map();
  const now = new Date();
  const rows = await prisma.$queryRaw`
    SELECT r.id AS room_id,
      (SELECT count(DISTINCT m.id) ${roomMessages(now)} AND ${UNREAD})::int AS unread,
      (SELECT max(m.created_at) ${roomMessages(now)} AND m.created_by IS NULL) AS last_inbound_at,
      lm.id AS last_id, lm.contents AS last_contents, lm.created_at AS last_at,
      lm.created_by AS last_created_by, lm.encryption_mode::text AS last_encryption_mode
    FROM chat_rooms r
    LEFT JOIN chat_room_reads rd ON rd.room_id = r.id AND rd.account_id = ${accountId}
    LEFT JOIN LATERAL (
      SELECT m.id, m.contents, m.created_at, m.created_by, m.encryption_mode ${roomMessages(now)}
      ORDER BY m.created_at DESC, m.id DESC LIMIT 1
    ) lm ON true
    WHERE r.id IN (${Prisma.join(roomIds)})`;
  return new Map(rows.map(row => [row.room_id, row]));
};

const tagView = ({ id, name }) => ({ id, name });

/** Whether the conversation can still be answered, as the GraphQL ReplyWindow type has it. */
export const replyWindowView = (platform, lastCustomerMessageAt, now = new Date()) => {
  const window = replyWindow({ platform, lastCustomerMessageAt, now });
  return {
    state: window.state,
    closesAt: window.closesAt,
    templateRequired: window.templateRequired,
    humanAgentAvailable: window.humanAgentAvailable,
  };
};

/** How a conversation is shown, with the account's unread count. */
const roomView = (room, stats) => {
  const key = room.chatRoomId || room.id;
  const customer = customerOf(room);
  const lastCustomerMessageAt = stats?.last_inbound_at || null;
  return {
    id: room.id,
    title: customer?.name || key,
    platform: room.platform,
    channel_id: room.channelId,
    channel_name: room.channel?.name || null,
    chat_room_id: key,
    users: Array.isArray(room.users) ? room.users : [],
    customer,
    tags: (room.tags || []).map(({ tag }) => tagView(tag)).sort((a, b) => a.name.localeCompare(b.name)),
    lastMessage: stats?.last_id ? messagePreview(stats.last_contents, stats.last_encryption_mode) : null,
    lastMessageAt: stats?.last_at || null,
    lastMessageInbound: stats?.last_id ? !stats.last_created_by : null,
    unreadCount: stats?.unread || 0,
    lastCustomerMessageAt,
    replyWindow: replyWindowView(room.platform, lastCustomerMessageAt),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
};

const ROOM_DETAILS = { channel: { select: { name: true } }, tags: { include: { tag: true } } };

/** The conversations with these ids, in that order, as the account sees them. */
export const roomViews = async (account, roomIds) => {
  const [rooms, stats] = await Promise.all([
    prisma.chatRoom.findMany({ where: { id: { in: roomIds } }, include: ROOM_DETAILS }),
    roomStats(account.account_id, roomIds),
  ]);
  const byId = new Map(rooms.map(room => [room.id, room]));
  return roomIds.filter(id => byId.has(id)).map(id => roomView(byId.get(id), stats.get(id)));
};

/**
 * A page of the account's conversations, the one with the newest message first.
 * @param {{ first?: number, after?: string, filter?: { search?: string, platform?: string, channel_id?: string, unread_only?: boolean } }} options
 * @returns {{ rooms, nextCursor: string | null, hasMore: boolean }}
 */
export const listRooms = async (account, { first, after, filter = {} } = {}) => {
  const size = pageSize(first, 30, 100);
  const channelIds = await accountChannelIds(account);
  if (filter.channel_id && !channelIds.includes(filter.channel_id)) return { rooms: [], nextCursor: null, hasMore: false };
  const channels = filter.channel_id ? [filter.channel_id] : channelIds;
  if (!channels.length) return { rooms: [], nextCursor: null, hasMore: false };
  if (filter.platform && !PLATFORMS.includes(filter.platform)) throw new ApolloError('不支援這個平台', 'BAD_USER_INPUT');
  if (after && !decodeCursor(after)) throw new ApolloError('列表位置無效，請重新整理', 'BAD_USER_INPUT');

  const cursor = decodeCursor(after);
  const pattern = searchPattern(filter.search);
  const now = new Date();
  const conditions = [
    Prisma.sql`r.company_id = ${account.company_id}`,
    Prisma.sql`r.channel_id IN (${Prisma.join(channels)})`,
    ...(filter.platform ? [Prisma.sql`r.platform::text = ${filter.platform}`] : []),
    ...(cursor ? [Prisma.sql`(r.updated_at, r.id) < (${cursor.time}, ${cursor.id})`] : []),
    ...(filter.unread_only ? [Prisma.sql`EXISTS (SELECT 1 ${roomMessages(now)} AND ${UNREAD})`] : []),
    ...(pattern ? [Prisma.sql`(${CUSTOMER_MATCHES(pattern)} OR EXISTS (
      SELECT 1 ${roomMessages(now)} AND m.encryption_mode = 'server' AND ${MESSAGE_TEXT} ILIKE ${pattern}))`] : []),
  ];
  const rows = await prisma.$queryRaw`
    SELECT r.id, r.updated_at FROM chat_rooms r
    LEFT JOIN chat_room_reads rd ON rd.room_id = r.id AND rd.account_id = ${account.account_id}
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY r.updated_at DESC, r.id DESC
    LIMIT ${size + 1}`;
  const page = rows.slice(0, size);
  const last = page[page.length - 1];
  return {
    rooms: await roomViews(account, page.map(({ id }) => id)),
    nextCursor: rows.length > size && last ? encodeCursor(last.updated_at, last.id) : null,
    hasMore: rows.length > size,
  };
};

/**
 * A page of a conversation's messages, oldest first.
 * Without a cursor it is the newest messages; `before` pages back to older ones, `after` catches up on newer ones.
 * @returns {{ messages, hasOlder: boolean, hasNewer: boolean }} the stored messages, with their recipients
 */
export const listMessages = async (account, room, { first, before, after } = {}) => {
  const size = pageSize(first, 30, 100);
  if ((before && !decodeCursor(before)) || (after && !decodeCursor(after))) throw new ApolloError('訊息位置無效，請重新整理', 'BAD_USER_INPUT');
  if (before && after) throw new ApolloError('before 與 after 不能同時使用', 'BAD_USER_INPUT');
  const olderThan = decodeCursor(before);
  const newerThan = decodeCursor(after);
  const now = new Date();
  const conditions = [
    Prisma.sql`mr.to_chat_room_id @> ARRAY[${room.chatRoomId || room.id}]::text[]`,
    Prisma.sql`mr.channel_id = ${room.channelId}`,
    Prisma.sql`m.company_id = ${account.company_id}`,
    Prisma.sql`(m.expires_at IS NULL OR m.expires_at > ${now})`,
    ...(olderThan ? [Prisma.sql`(m.created_at, m.id) < (${olderThan.time}, ${olderThan.id})`] : []),
    ...(newerThan ? [Prisma.sql`(m.created_at, m.id) > (${newerThan.time}, ${newerThan.id})`] : []),
  ];
  // Catching up reads forward from the cursor; everything else reads back from the newest.
  const order = newerThan ? Prisma.sql`m.created_at ASC, m.id ASC` : Prisma.sql`m.created_at DESC, m.id DESC`;
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT m.id, m.created_at FROM messages m
    JOIN message_recipients mr ON mr.message_id = m.id
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY ${order}
    LIMIT ${size + 1}`;
  const ids = rows.slice(0, size).map(({ id }) => id);
  const stored = await prisma.message.findMany({ where: { id: { in: ids } }, include: { recipients: true } });
  const messages = stored.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const more = rows.length > size;
  return {
    messages,
    hasOlder: newerThan ? null : more,
    hasNewer: newerThan ? more : false,
  };
};

/** When the customer last wrote in the conversation, which is what Meta's reply windows count from. */
export const lastCustomerMessageAt = async (room) => {
  const [row] = await prisma.$queryRaw`
    SELECT max(m.created_at) AS created_at FROM messages m JOIN message_recipients mr ON mr.message_id = m.id
    WHERE m.company_id = ${room.companyId} AND m.created_by IS NULL
      AND mr.to_chat_room_id @> ARRAY[${room.chatRoomId || room.id}]::text[] AND mr.channel_id = ${room.channelId}`;
  return row?.created_at || null;
};

/**
 * Moves the account's read position up to a message in the conversation, or its newest message. It never moves back.
 * @param {string} [messageId] - the newest message the agent has seen; later ones stay unread
 */
export const markRoomRead = async (account, room, messageId) => {
  const now = new Date();
  let readUpTo;
  if (messageId) {
    const [message] = await prisma.$queryRaw`
      SELECT m.created_at FROM messages m JOIN message_recipients mr ON mr.message_id = m.id
      WHERE m.id = ${messageId} AND m.company_id = ${account.company_id}
        AND mr.to_chat_room_id @> ARRAY[${room.chatRoomId || room.id}]::text[] AND mr.channel_id = ${room.channelId}
      LIMIT 1`;
    if (!message) throw new ApolloError('這則訊息不在這段對話中', 'NOT_FOUND');
    readUpTo = message.created_at;
  } else {
    const [latest] = await prisma.$queryRaw`
      SELECT max(m.created_at) AS created_at FROM messages m JOIN message_recipients mr ON mr.message_id = m.id
      WHERE m.company_id = ${account.company_id}
        AND mr.to_chat_room_id @> ARRAY[${room.chatRoomId || room.id}]::text[] AND mr.channel_id = ${room.channelId}`;
    readUpTo = latest?.created_at || now;
  }
  await prisma.$executeRaw`
    INSERT INTO chat_room_reads (account_id, room_id, last_read_at, updated_at)
    VALUES (${account.account_id}, ${room.id}, ${readUpTo}, ${now})
    ON CONFLICT (account_id, room_id) DO UPDATE
      SET last_read_at = GREATEST(chat_room_reads.last_read_at, EXCLUDED.last_read_at), updated_at = EXCLUDED.updated_at`;
};

/** The company's customer tags, for suggestions while tagging. */
export const companyTags = async (account) => (await prisma.customerTag.findMany({
  where: { companyId: account.company_id },
  orderBy: { name: 'asc' },
})).map(tagView);

/** Tags the conversation's customer, creating the company's tag the first time it is used. */
export const addRoomTag = async (account, room, name) => {
  const tagName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!tagName) throw new ApolloError('請輸入標籤名稱', 'BAD_USER_INPUT');
  if ([...tagName].length > TAG_MAX_LENGTH) throw new ApolloError(`標籤最多 ${TAG_MAX_LENGTH} 個字`, 'BAD_USER_INPUT');
  const tag = await prisma.customerTag.upsert({
    where: { companyId_name: { companyId: account.company_id, name: tagName } },
    update: {},
    create: { companyId: account.company_id, name: tagName },
  });
  await prisma.chatRoomTag.createMany({ data: [{ roomId: room.id, tagId: tag.id }], skipDuplicates: true });
};

/** Takes a tag off the conversation's customer; the company keeps the tag for others. */
export const removeRoomTag = async (account, room, tagId) => {
  await prisma.chatRoomTag.deleteMany({ where: { roomId: room.id, tagId, tag: { companyId: account.company_id } } });
};

export { encodeCursor };
