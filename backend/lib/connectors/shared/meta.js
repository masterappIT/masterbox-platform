// What Messenger, Instagram and WhatsApp's Cloud API share: Meta's Graph API, its errors and its connection checks.
import metaClient from '../../../api/metaClient.js';
import { status, markChannelAuthExpired } from './connection.js';

/** Meta's error from a failed Graph request, or null when the request never got an answer. */
export const graphError = (error) => {
  let body = error?.responseBody;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = undefined; } }
  return body?.error || null;
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

/** Turns Meta's error (from a send response or a status webhook) into something an agent can act on. */
export const metaFailureReason = (error) => {
  if (error?.code === 190) return '頻道授權已失效，請到頻道管理重新串接';
  if (error?.code === 131047 || error?.error_subcode === 2018278) return '已超過 24 小時回覆期限，Meta 不允許傳送這則訊息';
  if (TEMPLATE_ERRORS[error?.code]) return TEMPLATE_ERRORS[error.code];
  return `Meta 無法送出這則訊息：${error?.message || error?.title || '未知錯誤'}`;
};

/** Why a send failed. A refused authorization (code 190) shows on 社群平台管理 straight away. */
export const sendFailureReason = (error, channel) => {
  const graph = graphError(error);
  console.error('Meta send failed:', graph || error.message);
  if (graph?.code === 190 && channel?.id) markChannelAuthExpired(channel.id);
  return metaFailureReason(graph || { message: error.message });
};

/** Why the channel can't send at all, or null when it can. */
export const metaNotReady = channel => (channel?.accessInfo?.access_token ? null : '此頻道尚未完成 Meta 串接，無法送出訊息');

// --- Connection status ---------------------------------------------------------------------------------------

/** What a failed Graph request means for the channel. */
export const failureStatus = (error) => {
  const graph = graphError(error);
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

const notAuthorized = () => ({ connection: status('auth_expired', '尚未完成 Meta 授權，請重新串接') });

/** Asks Meta whether a Facebook page or Instagram account still sends us its messages. */
export const checkPage = async (channel) => {
  const { access_token: token, page_id: pageId, id } = channel.accessInfo || {};
  if (!token) return notAuthorized();
  const problem = subscribedStatus(await graph(`${pageId || id}/subscribed_apps`, token), true);
  return { connection: problem || status('ok') };
};

const PHONE_STATES = {
  PENDING: '號碼尚未完成註冊', DISCONNECTED: '號碼已中斷連線', FLAGGED: '號碼已被 Meta 標記', RESTRICTED: '號碼已被限制傳訊',
  BANNED: '號碼已被停用', RATE_LIMITED: '號碼傳訊次數已達上限', DELETED: '號碼已從商業帳號移除', MIGRATED: '號碼已移到其他商業帳號',
  UNVERIFIED: '號碼尚未驗證',
};

/** Asks Meta how a WhatsApp Cloud API number is doing. */
export const checkWhatsappNumber = async (channel) => {
  const { access_token: token, id, phone_number_id: phoneNumberId, whatsapp_business_account_id: wabaId } = channel.accessInfo || {};
  if (!token) return notAuthorized();
  const number = await graph(phoneNumberId || id, token, 'display_phone_number,status,quality_rating');
  const info = number.display_phone_number ? { display_phone_number: number.display_phone_number } : {};
  if (number.status && number.status !== 'CONNECTED') return { info, connection: status('error', PHONE_STATES[number.status] || `號碼狀態：${number.status}`) };
  if (wabaId) {
    const problem = subscribedStatus(await graph(`${wabaId}/subscribed_apps`, token), false);
    if (problem) return { info, connection: problem };
  }
  return { info, connection: status('ok', number.quality_rating === 'RED' ? '訊息品質評等偏低，請留意' : null) };
};
