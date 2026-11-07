// A channel's connection status as SubscribedChannel.connection shows it, saved on the channel so lists don't ask
// the platform every time. Each connector says how to check its platform; this keeps the result fresh.
import { prisma } from '../../db/prisma.js';

const FRESH_MS = Number(process.env.CHANNEL_CHECK_FRESH_MS || 10 * 60 * 1000);
const CHECK_TIMEOUT_MS = Number(process.env.CHANNEL_CHECK_TIMEOUT_MS || 6000);

/**
 * ok, auth_expired (connect again), not_subscribed (the platform doesn't send us its messages), error,
 * disabled, or unknown (not checked, or the platform can't be checked).
 */
export const status = (state, message = null, checkedAt = new Date()) => ({ state, message, checked_at: checkedAt ? new Date(checkedAt).toISOString() : null });

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

/** Records that the channel's authorization no longer works, such as when a send was refused with Meta's code 190. */
export const markChannelAuthExpired = (channelId, message = '授權已失效，請重新串接') => saveConnection(channelId, status('auth_expired', message))
  .catch((error) => console.error(`Channel ${channelId} status not saved:`, error.message));

const stale = (saved) => !saved?.checked_at || Date.now() - new Date(saved.checked_at).getTime() > FRESH_MS;

/** For a platform nobody can check yet. */
export const uncheckedConnection = (channel) => (channel.enabled ? status('unknown', '這個平台無法檢查連線', null) : status('disabled', '已停用', null));

/**
 * The saved status, or a new check when it is asked for.
 * @param {(channel) => Promise<{ connection, info? }>} check - asks the platform; info is merged into the channel's info
 * @param {(error) => object} failed - the status for a check that threw
 * @param {{ refresh?: boolean, force?: boolean }} [options] - refresh: check when the last check is older than
 *   10 minutes; force: check now
 */
export const checkedConnection = async (channel, check, failed, { refresh = false, force = false } = {}) => {
  if (!channel.enabled) return status('disabled', '已停用', null);
  const saved = channel.info?.connection;
  if (!force && !(refresh && stale(saved))) return saved || status('unknown', '尚未檢查', null);

  let result;
  try {
    result = await withTimeout(check(channel));
  } catch (error) {
    result = { connection: failed(error) };
  }
  await saveConnection(channel.id, result.connection, result.info).catch((error) => console.error(`Channel ${channel.id} status not saved:`, error.message));
  return result.connection;
};
