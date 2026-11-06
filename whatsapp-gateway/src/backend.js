// Tells the MasterBox backend what happens on each WhatsApp number. Every request carries the shared secret.

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');
const SECRET = process.env.WHATSAPP_GATEWAY_SECRET;
const RETRIES = 6;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends one event and returns the backend's answer, such as { action: 'logout' }.
 * Retries while the backend is down or restarting; a 4xx answer is final.
 * @returns {Promise<object>} the answer, or { gone: true } when the backend no longer has this channel
 */
const post = async (event) => {
  let lastError;
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${BACKEND_URL}/internal/whatsapp-web/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(120000),
      });
      if (response.status === 410) return { gone: true };
      const body = await response.json().catch(() => ({}));
      if (response.ok) return body;
      if (response.status < 500) throw Object.assign(new Error(body.error || `HTTP ${response.status}`), { final: true });
      lastError = new Error(body.error || `HTTP ${response.status}`);
    } catch (error) {
      if (error.final) throw error;
      lastError = error;
    }
    await wait(Math.min(30000, 1000 * 2 ** attempt));
  }
  throw lastError;
};

// Each channel's events go one at a time, so the backend sees them in the order they happened.
const queues = new Map();

/**
 * Queues an event for the backend.
 * @param {string} channelId - the MasterBox channel
 * @param {{ type: 'status' | 'message' | 'history' | 'ack' }} event
 * @returns {Promise<object>} the backend's answer
 */
export const report = (channelId, event) => {
  const previous = queues.get(channelId) || Promise.resolve();
  const next = previous.catch(() => {}).then(() => post({ channelId, ...event }));
  queues.set(channelId, next);
  next.finally(() => { if (queues.get(channelId) === next) queues.delete(channelId); }).catch(() => {});
  return next;
};
