import { prisma } from '../lib/db/prisma.js';
import { ApolloError } from 'apollo-server-errors';
import { pubsub } from '../config/redis.js';
import { sendFacebookMessage } from '../controller/meta_facebook.js';
import { sendWhatsappMessage, whatsappMessageId, fetchApprovedTemplates } from '../controller/meta_whatsapp.js';
import { replyContentsOf, replyParts, metaPayload, partContents, storedAttachment } from '../lib/messaging/outbound.js';
import { checkAttachment } from '../lib/storage/attachmentRules.js';
import { describeUrl } from '../lib/storage/index.js';
import { storeInboundAttachments } from '../lib/messaging/inbound.js';
import { messagePreview, encodeCursor } from '../lib/messaging/conversationText.js';
import { replyWindow, freeformBlockReason } from '../lib/messaging/replyWindow.js';
import { templateView, templateMessage } from '../lib/messaging/whatsappTemplates.js';
import { lastCustomerMessageAt } from '../lib/messaging/conversations.js';
import { channelAccountIds } from '../lib/messaging/access.js';

export const errorTypes = {
  MISS_REQUEUED_PRAMS: 'MISS_REQUEUED_PRAMS',
  ID_NOT_FOUND: 'ID_NOT_FOUND',
  FIND_FIELD_DETAIL_FAILED: 'FIND_FIELD_DETAIL_FAILED',
};

export const objectIdGenerator = (id) => {
  if (typeof id !== 'string' || !id.trim()) throw new ApolloError('Invalid id', 'BAD_USER_INPUT');
  return id;
};

export const trialDateGenerator = (trialDays) => new Date(Date.now() + trialDays * 86400000);
export const channelPlatforms = ['fb', 'ig', 'whatsapp', 'line', 'wechat'];
export const SEND_MESSAGE = 'sendMessage';

const textOf = value => typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
const recipientRooms = message => (message.recipients || []).flatMap(r => r.chatRoomIds || []);
/**
 * A stored message as the API shows it.
 * @param {string} [viewerId] - the account looking at it, for isMine; without it isMine is null
 */
export const messageView = (message, requestedRoom, viewerId) => {
  const text = textOf(message.contents);
  const rooms = recipientRooms(message);
  return {
    id: message.id || message._id?.toString(), _id: message.id || message._id?.toString(),
    platform: message.platform, contents: text, text, recipients: rooms,
    to_chat_room_id: requestedRoom || rooms[0] || null,
    channel_id: message.recipients?.[0]?.channelId || message.channel_id || null,
    encryption_mode: message.encryptionMode || message.encryption_mode || 'server', disappearing_after_seconds: message.disappearingAfterSeconds || null, expiresAt: message.expiresAt || null, readAt: message.readAt || null, sentAt: message.createdAt || message.created_at || null,
    // Sent by the account looking at it, rather than by the customer or a colleague.
    isMine: viewerId ? Boolean(message.createdBy) && message.createdBy === viewerId : null,
    inbound: !message.createdBy,
    delivery_error: message.deliveryError || null,
    preview: messagePreview(message.contents, message.encryptionMode),
    cursor: message.id && message.createdAt ? encodeCursor(message.createdAt, message.id) : null,
  };
};

// Everyone who works in the channel follows its conversations, not just whoever sent the message.
export const publishMessage = async (message) => {
  const channelId = message.recipients?.[0]?.channelId;
  if (!channelId) return;
  const accountIds = await channelAccountIds(message.companyId, channelId);
  // Each account gets its own copy, so isMine is right for whoever reads it.
  await Promise.all(accountIds.map(accountId => pubsub.publish(`${SEND_MESSAGE}-${accountId}`, { sendMessage: messageView(message, undefined, accountId) })));
};

const sendFailed = (error) => {
  let body = error.responseBody;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = undefined; } }
  console.error('Meta send failed:', body?.error || error.message);
  return metaFailureReason(body?.error || { message: error.message });
};

// WhatsApp's template errors, from its error code reference.
const TEMPLATE_ERRORS = {
  132000: '範本的變數數量和 Meta 上的不一致，請重新整理範本後再試',
  132001: '範本不存在或沒有這個語言版本，請重新選擇範本',
  132005: '填入變數後的內容太長',
  132007: '填入的內容不符合範本的格式規定',
  132012: '填入的變數格式和範本不符',
  132015: '這個範本已被 Meta 暫停，暫時無法發送',
  132016: '這個範本已被 Meta 停用，無法發送',
};

// Turns Meta's error (from a send response or a status webhook) into something an agent can act on.
export const metaFailureReason = (error) => {
  if (error?.code === 190) return '頻道授權已失效，請到頻道管理重新串接';
  if (error?.code === 131047 || error?.error_subcode === 2018278) return '已超過 24 小時回覆期限，Meta 不允許傳送這則訊息';
  if (TEMPLATE_ERRORS[error?.code]) return TEMPLATE_ERRORS[error.code];
  return `Meta 無法送出這則訊息：${error?.message || error?.title || '未知錯誤'}`;
};

// The file an agent attached, checked against storage and the platform's limits.
const replyAttachment = async (platform, attachments) => {
  if (!attachments.length) return {};
  if (attachments.length > 1) throw new ApolloError('一次只能傳送一個附件', 'SEND_FAILED');
  const file = await describeUrl(attachments[0]?.payload?.url);
  if (!file) throw new ApolloError('找不到這個附件，請重新選擇檔案', 'SEND_FAILED');
  const check = checkAttachment(platform, { mime: file.mime_type, size: file.size });
  if (!check.ok) throw new ApolloError(check.reason, 'SEND_FAILED');
  return { attachment: storedAttachment(file), sendType: check.sendType };
};

/**
 * The channel and customer a reply in this conversation goes between, checked before anything is sent.
 * @returns {{ channel, token, pageId, phoneNumberId, customerId }}
 */
const replyTarget = async (room) => {
  if (!['fb', 'ig', 'whatsapp'].includes(room.platform)) throw new ApolloError(`尚未支援回覆 ${room.platform} 訊息`, 'SEND_FAILED');
  const channel = await prisma.companyChannel.findUnique({ where: { id: room.channelId } });
  const { access_token: token, page_id: pageId, phone_number_id: phoneNumberId } = channel?.accessInfo || {};
  if (channel && !channel.enabled) throw new ApolloError('此頻道已停用，請到社群平台管理啟用後再回覆', 'SEND_FAILED');
  if (!token) throw new ApolloError('此頻道尚未完成 Meta 串接，無法送出訊息', 'SEND_FAILED');

  // The recipient comes from the stored conversation rather than the client.
  const customerId = (Array.isArray(room.users) ? room.users[0]?.id : null) || (room.platform === 'whatsapp' ? room.chatRoomId : null);
  if (!customerId) throw new ApolloError('找不到這段對話的客戶，無法送出訊息', 'SEND_FAILED');
  return { channel, token, pageId, phoneNumberId, customerId };
};

/**
 * Works out how a reply goes to the customer, before anything is sent.
 * @returns {{ parts, send }} parts in the order they are sent; send(part) returns the platform's message id or throws
 */
const prepareReply = async (room, contents) => {
  if (!['fb', 'ig', 'whatsapp'].includes(room.platform)) throw new ApolloError(`尚未支援回覆 ${room.platform} 訊息`, 'SEND_FAILED');
  const { text, attachments } = replyContentsOf(contents);
  const { attachment, sendType } = await replyAttachment(room.platform, attachments);
  const parts = replyParts(room.platform, { text, attachment, sendType });
  if (!parts.length) throw new ApolloError('訊息內容不可空白', 'SEND_FAILED');

  const { token, pageId, phoneNumberId, customerId } = await replyTarget(room);

  // Meta counts its reply windows from the customer's last message. WhatsApp rejects anything but a template
  // outside it; Messenger and Instagram replies within 7 days go with the human agent tag when the app has it.
  const window = replyWindow({ platform: room.platform, lastCustomerMessageAt: await lastCustomerMessageAt(room) });
  const blocked = freeformBlockReason(window);
  if (blocked) throw new ApolloError(blocked, 'SEND_FAILED', { templateRequired: true });

  const send = async (part) => {
    const payload = metaPayload(room.platform, customerId, part, { messagingTag: window.messagingTag });
    if (room.platform === 'whatsapp') {
      const result = await sendWhatsappMessage(payload, phoneNumberId, token);
      return whatsappMessageId(result.messages[0].id);
    }
    const result = await sendFacebookMessage(pageId, payload, token);
    return result.message_id;
  };
  return { parts, send };
};

/**
 * Sends an agent's reply. Only what Meta accepted is stored, so nothing here can look sent when it wasn't.
 * A reply with a file may go as two messages; when only the file went out, the error says so and carries `sentAttachment`.
 * @returns the last stored message
 */
export const handleSendMessage = async (accountId, roomId, contents, channelId) => {
  if (!accountId) throw new ApolloError('A PostgreSQL account is required', 'SEND_FAILED');
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new ApolloError('Invalid account', 'SEND_FAILED');
  const room = await prisma.chatRoom.findFirst({
    where: { companyId: account.companyId, ...(channelId ? { channelId } : {}), OR: [{ id: roomId }, { chatRoomId: roomId }] },
  });
  if (!room) throw new ApolloError('Chat room not found', 'SEND_FAILED');
  const { parts, send } = await prepareReply(room, contents);

  let message = null;
  for (const part of parts) {
    let externalId;
    try {
      externalId = await send(part);
    } catch (error) {
      const reason = sendFailed(error);
      if (!message) throw new ApolloError(reason, 'SEND_FAILED');
      throw new ApolloError(`附件已送出，但文字沒有送出：${reason}`, 'SEND_FAILED', { sentAttachment: true });
    }
    message = await prisma.message.create({
      data: {
        companyId: account.companyId,
        createdBy: account.id,
        platform: room.platform,
        contents: partContents(contents, part),
        externalId,
        recipients: { create: [{ channelId: room.channelId, chatRoomIds: [room.chatRoomId || room.id] }] },
      },
      include: { recipients: true },
    });
    await prisma.chatRoom.update({ where: { id: room.id }, data: { updatedAt: new Date() } });
    await publishMessage(message);
  }
  return message;
};

/** A room's channel, checked to be a connected WhatsApp number with a business account, for its templates. */
const whatsappChannel = async (room) => {
  if (room.platform !== 'whatsapp') throw new ApolloError('只有 WhatsApp 對話可以使用 WhatsApp 範本', 'BAD_USER_INPUT');
  const target = await replyTarget(room);
  const wabaId = target.channel?.accessInfo?.whatsapp_business_account_id;
  if (!wabaId) throw new ApolloError('這個 WhatsApp 頻道缺少商業帳號資料，請到社群平台管理重新串接後再使用範本', 'TEMPLATES_UNAVAILABLE');
  return { ...target, wabaId };
};

/** The channel's approved templates, ready for the agent to fill in. */
export const listWhatsappTemplates = async (room) => {
  const { wabaId, token } = await whatsappChannel(room);
  try {
    const templates = await fetchApprovedTemplates(wabaId, token);
    return templates.map(templateView).sort((a, b) => Number(b.supported) - Number(a.supported) || a.name.localeCompare(b.name));
  } catch (error) {
    throw new ApolloError(`無法讀取 WhatsApp 範本：${sendFailed(error)}`, 'TEMPLATES_UNAVAILABLE');
  }
};

/**
 * Sends an approved template, which WhatsApp allows outside the 24-hour window too. The conversation keeps the filled-in text.
 * @param {{ templateId: string, values: { key, value }[], headerMediaUrl?: string }} input
 * @returns the stored message
 */
export const sendWhatsappTemplate = async (accountId, room, { templateId, values, headerMediaUrl }) => {
  const { wabaId, token, phoneNumberId, customerId } = await whatsappChannel(room);
  let templates;
  try {
    templates = await fetchApprovedTemplates(wabaId, token);
  } catch (error) {
    throw new ApolloError(`無法讀取 WhatsApp 範本：${sendFailed(error)}`, 'SEND_FAILED');
  }
  // Read again rather than trusting the client: the template may have been paused or changed since the list was shown.
  const template = templates.find(({ id }) => String(id) === String(templateId));
  if (!template) throw new ApolloError('找不到這個範本，可能已被停用或尚未核准，請重新選擇', 'SEND_FAILED');
  const view = templateView(template);

  let headerMedia;
  if (headerMediaUrl) {
    const file = await describeUrl(headerMediaUrl);
    if (!file) throw new ApolloError('找不到標題的檔案，請重新上傳', 'SEND_FAILED');
    const check = checkAttachment('whatsapp', { mime: file.mime_type, size: file.size });
    if (!check.ok) throw new ApolloError(check.reason, 'SEND_FAILED');
    headerMedia = { url: file.url, filename: file.filename, kind: file.kind, mimeType: file.mime_type, file };
  }
  const built = templateMessage(view, values, { to: customerId, headerMedia });
  if (built.error) throw new ApolloError(built.error, 'BAD_USER_INPUT');

  let externalId;
  try {
    const result = await sendWhatsappMessage(built.payload, phoneNumberId, token);
    externalId = whatsappMessageId(result.messages[0].id);
  } catch (error) {
    throw new ApolloError(sendFailed(error), 'SEND_FAILED');
  }
  const contents = {
    text: built.text,
    template: { id: view.id, name: view.name, language: view.language },
    ...(headerMedia ? { attachments: [storedAttachment(headerMedia.file)] } : {}),
  };
  const message = await prisma.message.create({
    data: {
      companyId: room.companyId,
      createdBy: accountId,
      platform: room.platform,
      contents: JSON.stringify(contents),
      externalId,
      recipients: { create: [{ channelId: room.channelId, chatRoomIds: [room.chatRoomId || room.id] }] },
    },
    include: { recipients: true },
  });
  await prisma.chatRoom.update({ where: { id: room.id }, data: { updatedAt: new Date() } });
  await publishMessage(message);
  return message;
};

// Marks a reply the platform accepted but later could not deliver.
export const markMessageFailed = async (externalId, reason) => {
  const message = await prisma.message.findUnique({ where: { externalId } });
  if (!message) return null;
  const updated = await prisma.message.update({ where: { id: message.id }, data: { deliveryError: reason }, include: { recipients: true } });
  await publishMessage(updated);
  return updated;
};

const findChannelByExternalId = async (externalId, where) => {
  const channels = await prisma.companyChannel.findMany({ where });
  return channels.find(({ accessInfo }) => accessInfo && [accessInfo.id, accessInfo.page_id, accessInfo.phone_number_id].includes(externalId));
};

const definedFields = (object) => Object.fromEntries(Object.entries(object || {}).filter(([, value]) => value !== undefined && value !== null && value !== ''));

// The conversation's users with the customer's latest profile, or null when nothing changed.
// A lookup that found nothing keeps the name and picture stored before; Meta's picture links expire, so newer ones replace them.
const usersWithCustomer = (users, customer) => {
  if (!customer?.id) return null;
  const stored = Array.isArray(users) ? users : [];
  const current = stored.find(user => user?.id === customer.id);
  const merged = { ...current, ...definedFields(customer) };
  if (current && Object.keys(merged).every(key => merged[key] === current[key])) return null;
  return [merged, ...stored.filter(user => user?.id !== customer.id)];
};

// The platform's conversation id may not have been available earlier, so also match on the customer.
const findCustomerRoom = (channel, chatRoomId, customer) => prisma.chatRoom.findFirst({
  where: { companyId: channel.companyId, channelId: channel.id, OR: [{ chatRoomId }, ...(customer?.id ? [{ users: { array_contains: [{ id: customer.id }] } }] : [])] },
});

// Stores a customer's message from a platform webhook and tells the channel's accounts about it.
export const saveInboundMessage = async ({ externalChannelId, platform, chatRoomId, contents, customer, externalId }) => {
  // A disabled channel takes in nothing; the message stays in the platform's own inbox.
  const channel = await findChannelByExternalId(externalChannelId, { platform, enabled: true });
  if (!channel) return null;
  // The platform retried a message that is already stored; don't download its files again.
  if (externalId && await prisma.message.findUnique({ where: { externalId }, select: { id: true } })) return null;
  const stored = typeof contents === 'string' ? contents : JSON.stringify(await storeInboundAttachments(contents, channel));

  const room = await findCustomerRoom(channel, chatRoomId, customer);
  const users = usersWithCustomer(room?.users, customer);
  const roomId = room?.chatRoomId || room?.id || chatRoomId;
  if (room) await prisma.chatRoom.update({ where: { id: room.id }, data: { updatedAt: new Date(), ...(users ? { users } : {}) } });
  else await prisma.chatRoom.create({ data: { companyId: channel.companyId, platform, channelId: channel.id, chatRoomId, users: users || [] } });

  try {
    const message = await prisma.message.create({
      data: { companyId: channel.companyId, platform, contents: stored, externalId, recipients: { create: [{ channelId: channel.id, chatRoomIds: [roomId] }] } },
      include: { recipients: true },
    });
    await publishMessage(message);
    return message;
  } catch (error) {
    // The platform retried a message that is already stored.
    if (error.code === 'P2002') return null;
    throw error;
  }
};

/**
 * Stores conversations from before the channel was connected. Messages already stored are left alone,
 * so connecting the same channel again only adds what is new.
 * @param conversations [{ chatRoomId, customer, messages: [{ externalId, sentAt, fromCompany, contents }] }]
 * @param accountId who connected the channel; Meta doesn't say which agent sent the company's replies, so they are recorded under this account
 * @returns the number of messages stored
 */
export const saveConversationHistory = async (channel, conversations, accountId) => {
  let stored = 0;
  for (const { chatRoomId, customer, messages } of conversations) {
    if (!messages.length) continue;
    const room = await findCustomerRoom(channel, chatRoomId, customer);
    const users = usersWithCustomer(room?.users, customer);
    const lastAt = new Date(Math.max(...messages.map(({ sentAt }) => new Date(sentAt).getTime())));
    // A conversation keeps its place unless the import has newer messages.
    const updatedAt = room && lastAt > room.updatedAt ? lastAt : room?.updatedAt;
    if (room && (users || updatedAt !== room.updatedAt)) await prisma.chatRoom.update({ where: { id: room.id }, data: { ...(users ? { users } : {}), updatedAt } });
    // A new conversation sorts by its last message, not by when it was imported.
    if (!room) await prisma.chatRoom.create({ data: { companyId: channel.companyId, platform: channel.platform, channelId: channel.id, chatRoomId, users: users || [], createdAt: lastAt, updatedAt: lastAt } });
    const roomId = room?.chatRoomId || room?.id || chatRoomId;

    // Only new messages get their files downloaded; connecting again leaves stored ones alone.
    const known = new Set((await prisma.message.findMany({ where: { externalId: { in: messages.map(({ externalId }) => externalId) } }, select: { externalId: true } })).map(({ externalId }) => externalId));
    const fresh = [];
    for (const message of messages.filter(({ externalId }) => !known.has(externalId))) {
      fresh.push({ ...message, contents: await storeInboundAttachments(message.contents, channel) });
    }
    if (!fresh.length) continue;
    const result = await prisma.message.createMany({
      data: fresh.map(({ externalId, sentAt, fromCompany, contents }) => ({
        companyId: channel.companyId, platform: channel.platform, contents: JSON.stringify(contents), externalId,
        createdAt: new Date(sentAt), createdBy: fromCompany ? accountId : null,
      })),
      skipDuplicates: true,
    });
    if (!result.count) continue;
    stored += result.count;
    // createMany can't add the recipients, so attach them to the messages it just made.
    const created = await prisma.message.findMany({ where: { externalId: { in: messages.map(({ externalId }) => externalId) }, recipients: { none: {} } }, select: { id: true } });
    await prisma.messageRecipient.createMany({ data: created.map(({ id }) => ({ messageId: id, channelId: channel.id, chatRoomIds: [roomId] })) });
  }
  return stored;
};

const channelRecords = ({ facebookPages = [], instagramAccounts = [], whatsappAccounts = [] }) => [
  ...facebookPages.map(({ id, name, access_token }) => ({
    platform: 'fb', name: name || id,
    accessInfo: { id, page_id: id, access_token }, info: {},
  })),
  ...instagramAccounts.map(({ id, name, username, page_id, access_token }) => ({
    platform: 'ig', name: username || name || id,
    accessInfo: { id, page_id, access_token }, info: {},
  })),
  ...whatsappAccounts.map(({ id, verified_name, display_phone_number, waid, access_token }) => ({
    platform: 'whatsapp', name: verified_name || display_phone_number || id,
    accessInfo: { id, phone_number_id: id, whatsapp_business_account_id: waid, access_token },
    info: { display_phone_number },
  })),
];

// Saves the channels from a Meta authorization. Authorizing again refreshes their tokens instead of adding copies.
// An external account can only belong to one company, because webhooks find their channel by its external id.
export const saveMetaChannels = async ({ companyId, accountId, ...accounts }) => {
  const records = channelRecords(accounts);
  const existing = await prisma.companyChannel.findMany({ where: { platform: { in: ['fb', 'ig', 'whatsapp'] } } });
  const saved = [], skipped = [];

  await prisma.$transaction(async (tx) => {
    for (const { platform, name, accessInfo, info } of records) {
      const owners = existing.filter(channel => channel.platform === platform && channel.accessInfo?.id === accessInfo.id);
      if (owners.some(channel => channel.companyId !== companyId)) {
        skipped.push(name);
        continue;
      }
      const channel = owners[0]
        ? await tx.companyChannel.update({ where: { id: owners[0].id }, data: { name, accessInfo, info } })
        : await tx.companyChannel.create({ data: { companyId, platform, name, accessInfo, info } });
      // Live messages reach the accounts in account_channels, so whoever connected it must be one.
      await tx.accountChannel.createMany({ data: [{ accountId, channelId: channel.id }], skipDuplicates: true });
      saved.push(channel);
    }
  });

  return { saved, skipped };
};

export const findChannelToken = async (channelId, platform) => {
  const channel = await findChannelByExternalId(channelId);
  if (!channel) return null;
  const accessInfo = channel.accessInfo || {};
  const token = accessInfo.access_token || accessInfo.user_access_token || null;
  return platform === 'instagram' || platform === 'whatsapp_business_account'
    ? { channel_id: accessInfo.page_id || accessInfo.id, access_token: token }
    : token;
};
