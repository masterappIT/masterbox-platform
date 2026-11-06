// Removing a channel from 社群平台管理, and how each channel's connection to its platform is doing.
// A removed channel keeps its conversations: connecting the same Meta account or WhatsApp number again brings them back.
import { ApolloError } from 'apollo-server-errors';
import { prisma } from '../db/prisma.js';
import metaClient from '../../api/metaClient.js';
import { isWebChannel, removeSession } from './whatsappGateway.js';

/**
 * Removes one of the admin's company channels. It stops taking in and sending messages and disappears from the
 * channel list and the conversation lists. A QR-connected number is logged out, which removes the linked device from
 * the phone; one no phone ever connected is deleted outright.
 * @returns {Promise<boolean>}
 */
export const deleteChannel = async (admin, channelId) => {
  const channel = await prisma.companyChannel.findUnique({ where: { id: channelId } });
  if (!channel || channel.companyId !== admin.company_id || channel.deletedAt) throw new ApolloError('找不到這個頻道', 'NOT_FOUND');

  if (isWebChannel(channel)) {
    // The gateway is told again on its next report, which a removed channel answers with 410, so it may be down now.
    await removeSession(channel.id).catch((error) => console.warn(`WhatsApp channel ${channel.id} not logged out now: ${error.message}`));
    if (!channel.accessInfo?.phone) {
      await prisma.companyChannel.delete({ where: { id: channel.id } });
      return true;
    }
  }

  const { access_token: _token, user_access_token: _userToken, ...accessInfo } = channel.accessInfo || {};
  await prisma.companyChannel.update({
    where: { id: channel.id },
    data: { deletedAt: new Date(), enabled: false, accessInfo, info: { ...(channel.info || {}), connection: null } },
  });
  return true;
};

// --- Connection status ---------------------------------------------------------------------------------------

const FRESH_MS = Number(process.env.CHANNEL_CHECK_FRESH_MS || 10 * 60 * 1000);
const CHECK_TIMEOUT_MS = Number(process.env.CHANNEL_CHECK_TIMEOUT_MS || 6000);
const CHECKABLE = ['fb', 'ig', 'whatsapp'];

/**
 * ok, auth_expired (connect again through Meta), not_subscribed (Meta doesn't send us its messages), error,
 * disabled, or unknown (not checked, or the platform can't be checked).
 */
const status = (state, message = null, checkedAt = new Date()) => ({ state, message, checked_at: checkedAt ? new Date(checkedAt).toISOString() : null });

const metaError = (error) => {
  let body = error?.responseBody;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = undefined; } }
  return body?.error || null;
};

/** What a failed Graph request means for the channel. */
export const failureStatus = (error) => {
  const graph = metaError(error);
  if (!graph) return status('error', error?.timedOut ? '檢查逾時，Meta 沒有回應' : '無法連到 Meta，請稍後再試');
  if (graph.code === 190 || graph.code === 102) return status('auth_expired', '授權已失效，請重新串接');
  if (graph.code === 10 || (graph.code >= 200 && graph.code < 300)) return status('auth_expired', '權限不足，請重新串接並允許所需權限');
  if (graph.code === 100 && graph.error_subcode === 33) return status('auth_expired', '找不到這個帳號，或授權已移除，請重新串接');
  return status('error', `Meta 回應錯誤：${graph.message || graph.code}`);
};

const graph = async (endPoints, token, fields) => JSON.parse(await metaClient({
  endPoints, method: 'GET', queryStrings: { access_token: token, ...(fields ? { fields } : {}) },
}));

// Meta only sends a page's or business account's messages to apps subscribed to it.
const subscribedStatus = (apps, needsMessages) => {
  const appId = process.env.FB_APP_ID;
  const ours = (apps?.data || []).find((app) => !appId || String(app.id) === String(appId));
  if (!ours) return status('not_subscribed', 'Meta 沒有把訊息傳給 MasterBox，請重新串接');
  if (needsMessages && Array.isArray(ours.subscribed_fields) && !ours.subscribed_fields.includes('messages')) {
    return status('not_subscribed', '沒有訂閱訊息通知，請重新串接');
  }
  return null;
};

const PHONE_STATES = {
  PENDING: '號碼尚未完成註冊', DISCONNECTED: '號碼已中斷連線', FLAGGED: '號碼已被 Meta 標記', RESTRICTED: '號碼已被限制傳訊',
  BANNED: '號碼已被停用', RATE_LIMITED: '號碼傳訊次數已達上限', DELETED: '號碼已從商業帳號移除', MIGRATED: '號碼已移到其他商業帳號',
  UNVERIFIED: '號碼尚未驗證',
};

/** Asks Meta how the channel is doing. */
const checkMeta = async (channel) => {
  const { access_token: token, page_id: pageId, id, phone_number_id: phoneNumberId, whatsapp_business_account_id: wabaId } = channel.accessInfo || {};
  if (!token) return { connection: status('auth_expired', '尚未完成 Meta 授權，請重新串接') };
  if (channel.platform === 'whatsapp') {
    const number = await graph(phoneNumberId || id, token, 'display_phone_number,status,quality_rating');
    const info = number.display_phone_number ? { display_phone_number: number.display_phone_number } : {};
    if (number.status && number.status !== 'CONNECTED') return { info, connection: status('error', PHONE_STATES[number.status] || `號碼狀態：${number.status}`) };
    if (wabaId) {
      const problem = subscribedStatus(await graph(`${wabaId}/subscribed_apps`, token), false);
      if (problem) return { info, connection: problem };
    }
    return { info, connection: status('ok', number.quality_rating === 'RED' ? '訊息品質評等偏低，請留意' : null) };
  }
  const problem = subscribedStatus(await graph(`${pageId || id}/subscribed_apps`, token), true);
  return { connection: problem || status('ok') };
};

const withTimeout = (promise) => {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { timedOut: true })), CHECK_TIMEOUT_MS); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// Merged into info rather than replacing it, so a Meta authorization saved meanwhile isn't undone.
const saveConnection = (channelId, connection, info = {}) => prisma.$executeRaw`
  UPDATE company_channels
  SET info = COALESCE(info, '{}'::jsonb) || ${JSON.stringify({ ...info, connection })}::jsonb
  WHERE id = ${channelId}`;

/** Records that the channel's Meta authorization no longer works, such as when a send was refused with code 190. */
export const markChannelAuthExpired = (channelId, message = '授權已失效，請重新串接') => saveConnection(channelId, status('auth_expired', message))
  .catch((error) => console.error(`Channel ${channelId} status not saved:`, error.message));

const stale = (saved) => !saved?.checked_at || Date.now() - new Date(saved.checked_at).getTime() > FRESH_MS;

/**
 * The channel's connection as SubscribedChannel.connection shows it. QR-connected numbers have whatsapp_web instead.
 * @param {{ refresh?: boolean, force?: boolean }} [options] - refresh: ask Meta when the last check is older than
 *   10 minutes; force: ask Meta now
 */
export const channelConnection = async (channel, { refresh = false, force = false } = {}) => {
  if (isWebChannel(channel)) return null;
  if (!channel.enabled) return status('disabled', '已停用', null);
  if (!CHECKABLE.includes(channel.platform)) return status('unknown', '這個平台無法檢查連線', null);
  const saved = channel.info?.connection;
  if (!force && !(refresh && stale(saved))) return saved || status('unknown', '尚未檢查', null);

  let result;
  try {
    result = await withTimeout(checkMeta(channel));
  } catch (error) {
    result = { connection: failureStatus(error) };
  }
  await saveConnection(channel.id, result.connection, result.info).catch((error) => console.error(`Channel ${channel.id} status not saved:`, error.message));
  return result.connection;
};
