// Sends push notifications through Firebase Cloud Messaging (HTTP v1). Firebase passes iOS notifications on to APNs
// with the APNs key uploaded to the Firebase project, so this server never holds that key.
//
// The service account comes from FCM_SERVICE_ACCOUNT_FILE (a JSON file mounted into the container) or
// FCM_SERVICE_ACCOUNT_JSON. Neither is ever part of the repository or the image.
import fs from 'node:fs';
import jwt from 'jsonwebtoken';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TIMEOUT_MS = 10000;

/**
 * The service account's project and signing key, or null when push isn't set up.
 * @throws when a service account is configured but unreadable, so a mistake shows at startup rather than as silence
 */
export const readServiceAccount = (env = process.env, readFile = path => fs.readFileSync(path, 'utf8')) => {
  const raw = env.FCM_SERVICE_ACCOUNT_JSON?.trim() || (env.FCM_SERVICE_ACCOUNT_FILE?.trim() ? readFile(env.FCM_SERVICE_ACCOUNT_FILE.trim()) : '');
  if (!raw) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('FCM service account is not valid JSON'); }
  const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = parsed || {};
  if (!projectId || !clientEmail || !privateKey) throw new Error('FCM service account needs project_id, client_email and private_key');
  return { projectId, clientEmail, privateKey };
};

/**
 * A sender for one service account.
 * @param {{ projectId, clientEmail, privateKey }} account
 * @param {{ fetchImpl?: typeof fetch, now?: () => number }} [options] - for tests
 */
export const createFcmSender = (account, { fetchImpl = fetch, now = Date.now } = {}) => {
  let cached = null;

  const post = (url, init) => fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

  // Google's OAuth tokens last an hour; one is reused until a minute before it runs out.
  const accessToken = async () => {
    if (cached && cached.expiresAt - 60000 > now()) return cached.token;
    const issuedAt = Math.floor(now() / 1000);
    const assertion = jwt.sign(
      { iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: issuedAt, exp: issuedAt + 3600 },
      account.privateKey,
      { algorithm: 'RS256' },
    );
    const response = await post(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) throw new Error(`FCM sign-in failed: ${body.error_description || body.error || response.status}`);
    cached = { token: body.access_token, expiresAt: now() + (Number(body.expires_in) || 3600) * 1000 };
    return cached.token;
  };

  /**
   * Sends one message to one device.
   * @param {object} message - an FCM v1 message without its token
   * @returns {Promise<{ ok: true } | { ok: false, unregistered: boolean, reason: string }>} unregistered: the app was removed or the token replaced
   */
  const send = async (token, message) => {
    const response = await post(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.projectId)}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { ...message, token } }),
    });
    if (response.ok) return { ok: true };
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) cached = null;
    return { ok: false, unregistered: isUnregistered(response.status, body), reason: body?.error?.message || `HTTP ${response.status}` };
  };

  return { send };
};

/** Whether FCM says the token will never work again, so it should be forgotten. */
export const isUnregistered = (status, body) => {
  const codes = (body?.error?.details || []).map(detail => detail?.errorCode).filter(Boolean);
  if (codes.includes('UNREGISTERED')) return true;
  // A token that isn't one at all.
  return status === 400 && codes.includes('INVALID_ARGUMENT') && /registration token/i.test(body?.error?.message || '');
};

let sender;

/** The sender for this server's service account, or null when push isn't set up. */
export const fcmSender = () => {
  if (sender === undefined) {
    const account = readServiceAccount();
    sender = account ? createFcmSender(account) : null;
  }
  return sender;
};
