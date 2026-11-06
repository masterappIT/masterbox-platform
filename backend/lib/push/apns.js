// Sends push notifications straight to Apple (APNs) over HTTP/2, signing in with the MasterBox Push key.
// The key comes from a .p8 file mounted into the container (APNS_KEY_FILE); it is never part of the repository or
// the image. That key only covers production, the environment TestFlight and App Store builds use.
import { createPrivateKey } from 'node:crypto';
import fs from 'node:fs';
import http2 from 'node:http2';
import jwt from 'jsonwebtoken';

const APNS_ORIGIN = 'https://api.push.apple.com';
const TIMEOUT_MS = 10000;
// Apple refuses a sign-in token older than an hour, and one replaced more often than every 20 minutes.
const PROVIDER_TOKEN_MS = 40 * 60 * 1000;
// The token will never work again. A wrong topic also fails every token, but that is this server's mistake,
// so those tokens are kept and the error logged.
const GONE_REASONS = new Set(['BadDeviceToken', 'Unregistered']);

/**
 * The APNs settings, or null when push isn't set up.
 * @throws when a key is configured but unusable, so a mistake shows at startup rather than as silence
 */
export const readApnsConfig = (env = process.env, readFile = path => fs.readFileSync(path, 'utf8')) => {
  const keyFile = env.APNS_KEY_FILE?.trim();
  if (!keyFile) return null;
  const keyId = env.APNS_KEY_ID?.trim();
  const teamId = env.APNS_TEAM_ID?.trim();
  const topic = env.APNS_TOPIC?.trim();
  if (!keyId || !teamId || !topic) throw new Error('APNS_KEY_FILE also needs APNS_KEY_ID, APNS_TEAM_ID and APNS_TOPIC');
  let key;
  try { key = readFile(keyFile); } catch { throw new Error(`APNs key can't be read at ${keyFile}`); }
  let type;
  try { type = createPrivateKey(key).asymmetricKeyType; } catch { type = null; }
  if (type !== 'ec') throw new Error(`APNs key at ${keyFile} is not a .p8 signing key`);
  return { key, keyId, teamId, topic };
};

/** Reads an APNs answer: delivered, or why not. */
export const readApnsResponse = (status, body) => {
  if (status === 200) return { ok: true };
  let reason = '';
  try { reason = JSON.parse(body).reason || ''; } catch { /* the status says enough */ }
  return { ok: false, unregistered: status === 410 || GONE_REASONS.has(reason), reason: reason || `HTTP ${status}` };
};

const post = (session, path, headers, body, timeoutMs) => new Promise((resolve, reject) => {
  const stream = session.request({ ':method': 'POST', ':path': path, ...headers });
  let status;
  const chunks = [];
  stream.setTimeout(timeoutMs, () => {
    const error = new Error('APNs did not answer in time');
    error.timedOut = true;
    reject(error);
    stream.close(http2.constants.NGHTTP2_CANCEL);
  });
  stream.on('response', (responseHeaders) => { status = responseHeaders[':status']; });
  stream.on('data', chunk => chunks.push(chunk));
  stream.on('end', () => resolve({ status, body: Buffer.concat(chunks).toString() }));
  stream.on('error', reject);
  stream.on('close', () => reject(new Error('APNs closed the connection')));
  stream.end(body);
});

/**
 * A sender for one key, keeping one connection open as Apple asks.
 * @param {{ key, keyId, teamId, topic }} config
 * @param {{ origin?: string, connect?: typeof http2.connect, now?: () => number, timeoutMs?: number }} [options] - for tests
 */
export const createApnsSender = (config, { origin = APNS_ORIGIN, connect = http2.connect, now = Date.now, timeoutMs = TIMEOUT_MS } = {}) => {
  let session = null;
  let providerToken = null;

  const signIn = () => {
    if (providerToken && now() - providerToken.issuedAt < PROVIDER_TOKEN_MS) return providerToken.value;
    const issuedAt = now();
    const value = jwt.sign({ iss: config.teamId, iat: Math.floor(issuedAt / 1000) }, config.key, { algorithm: 'ES256', keyid: config.keyId });
    providerToken = { value, issuedAt };
    return value;
  };

  const connection = () => {
    if (session && !session.closed && !session.destroyed) return session;
    const opened = connect(origin);
    const forget = () => { if (session === opened) session = null; };
    // Failures reach the requests in flight; this only keeps an idle connection's end from being an uncaught error.
    opened.on('error', forget);
    opened.on('close', forget);
    opened.on('goaway', () => { forget(); opened.close(); });
    session = opened;
    return opened;
  };

  const deliver = async (token, body) => {
    const used = connection();
    try {
      return await post(used, `/3/device/${token}`, {
        authorization: `bearer ${signIn()}`,
        'apns-topic': config.topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      }, body, timeoutMs);
    } catch (error) {
      if (session === used) session = null;
      used.destroy();
      throw error;
    }
  };

  /**
   * Sends one notification to one phone.
   * @param {string} token - the phone's APNs device token, in hex
   * @param {object} payload - the APNs JSON payload
   * @returns {Promise<{ ok: true } | { ok: false, unregistered: boolean, reason: string }>} unregistered: forget the token
   */
  const send = async (token, payload) => {
    const body = JSON.stringify(payload);
    let response;
    try {
      response = await deliver(token, body);
    } catch (error) {
      // An idle connection Apple has closed fails like this, so it gets one more try on a new one. After a timeout
      // the notification may already be on its way, and trying again could show it twice.
      if (error.timedOut) throw error;
      response = await deliver(token, body);
    }
    const result = readApnsResponse(response.status, response.body);
    if (result.reason === 'ExpiredProviderToken' || result.reason === 'InvalidProviderToken') providerToken = null;
    return result;
  };

  const close = () => { session?.destroy(); session = null; };

  return { send, close };
};

let sender;

/** The sender for this server's key, or null when push isn't set up. */
export const apnsSender = () => {
  if (sender === undefined) {
    const config = readApnsConfig();
    sender = config ? createApnsSender(config) : null;
  }
  return sender;
};
