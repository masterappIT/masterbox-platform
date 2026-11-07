// Talks to whatsapp-gateway, the service that keeps a WhatsApp Web connection for each WhatsApp channel connected
// by scanning a QR code. Both sides prove themselves with WHATSAPP_GATEWAY_SECRET; the gateway is only reachable
// on the internal network.
import { timingSafeEqual } from 'node:crypto';
import { sourceOf } from '../connectors/source.js';

const gatewayUrl = () => (process.env.WHATSAPP_GATEWAY_URL || '').replace(/\/$/, '');
const secret = () => process.env.WHATSAPP_GATEWAY_SECRET || '';

export const gatewayConfigured = () => Boolean(gatewayUrl() && secret().length >= 32);

/** A channel connected by QR code, rather than through Meta's Cloud API. */
export const isWebChannel = (channel) => sourceOf(channel) === 'whatsapp_web';

/** The external id webhooks and the gateway's events find a QR channel by. */
export const webExternalId = (channelId) => `waweb:${channelId}`;

/** Whether a request carries the gateway's secret. */
export const isFromGateway = (authorization) => {
  if (!gatewayConfigured()) return false;
  const expected = Buffer.from(`Bearer ${secret()}`);
  const received = Buffer.from(String(authorization || ''));
  return expected.length === received.length && timingSafeEqual(expected, received);
};

export class GatewayError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const call = async (method, path, body, { timeoutMs = 30000 } = {}) => {
  if (!gatewayConfigured()) throw new GatewayError('尚未設定 WhatsApp 掃碼服務（WHATSAPP_GATEWAY_URL、WHATSAPP_GATEWAY_SECRET）', 503);
  let response;
  try {
    response = await fetch(`${gatewayUrl()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secret()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new GatewayError(`無法連到 WhatsApp 掃碼服務：${error.message}`, 503);
  }
  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new GatewayError(result.error || `WhatsApp 掃碼服務回應 HTTP ${response.status}`, response.status);
  return result;
};

const channelPath = (channelId) => `/channels/${encodeURIComponent(channelId)}`;

/** Starts the channel's connection, or returns the one already running. */
export const startSession = (channelId) => call('PUT', channelPath(channelId));

/** The channel's live connection with its QR code, or null when the gateway isn't running it. */
export const sessionStatus = async (channelId) => {
  try {
    return await call('GET', channelPath(channelId), undefined, { timeoutMs: 10000 });
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
};

/** Logs the number out, which also removes the linked device from the phone. */
export const removeSession = (channelId) => call('DELETE', channelPath(channelId));

export const requestPairingCode = (channelId, phone) => call('POST', `${channelPath(channelId)}/pairing-code`, { phone });

/**
 * Sends one part of a reply.
 * @param {{ to: string, text?: string, media?: { url, mimetype, filename }, sendType?: string }} part
 * @returns {Promise<{ id: string }>}
 */
export const sendThroughGateway = (channelId, part) => call('POST', `${channelPath(channelId)}/messages`, part, { timeoutMs: 120000 });

/** Where the backend downloads a file a customer sent, with the headers it needs. */
export const mediaRequest = (channelId, messageId) => ({
  url: `${gatewayUrl()}${channelPath(channelId)}/messages/${encodeURIComponent(messageId)}/media`,
  headers: { Authorization: `Bearer ${secret()}` },
});
