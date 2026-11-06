// Whether an agent can still reply to a conversation, by Meta's rules for each platform. No database here, so it is easy to test.
//
// - WhatsApp: a customer's message opens a 24-hour customer service window; each message restarts it.
//   Outside it only an approved template can be sent.
// - Messenger and Instagram: the standard messaging window is also 24 hours from the customer's last message.
//   A person (not a bot) can answer for 7 days with the HUMAN_AGENT tag, but only once Meta has approved
//   the app's Human Agent permission, so it is switched on with META_HUMAN_AGENT_ENABLED=true.
//   Meta retired the other message tags on 2026-04-27. Conversations that start from a Click to Messenger
//   ad can get up to 7 days too, which Meta doesn't tell us about, so a closed window there is a warning, not a block.
// - WhatsApp connected by QR code (a linked device of an ordinary WhatsApp account) has no window: state no_limit.

const HOUR_MS = 60 * 60 * 1000;
export const STANDARD_WINDOW_MS = 24 * HOUR_MS;
export const HUMAN_AGENT_WINDOW_MS = 7 * 24 * HOUR_MS;

const REPLY_PLATFORMS = ['fb', 'ig', 'whatsapp'];

export const humanAgentEnabled = () => process.env.META_HUMAN_AGENT_ENABLED === 'true';

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Where a conversation stands for replies.
 * @param {{ platform: string, lastCustomerMessageAt?: Date|string|null, now?: Date, humanAgent?: boolean, noLimit?: boolean }} options - noLimit for a channel connected by QR code
 * @returns {{
 *   state: 'open' | 'human_agent' | 'closed' | 'no_customer_message' | 'unsupported' | 'no_limit',
 *   closesAt: Date | null,          // when the current state ends; null when it doesn't
 *   templateRequired: boolean,      // WhatsApp can only send an approved template
 *   messagingTag: string | null,    // the tag Messenger and Instagram replies need now
 *   humanAgentAvailable: boolean,   // whether this platform and app can use the 7-day human agent window
 * }}
 */
export const replyWindow = ({ platform, lastCustomerMessageAt, now = new Date(), humanAgent = humanAgentEnabled(), noLimit = false }) => {
  if (noLimit) return { state: 'no_limit', closesAt: null, templateRequired: false, messagingTag: null, humanAgentAvailable: false };
  const isMeta = platform === 'fb' || platform === 'ig';
  const humanAgentAvailable = Boolean(isMeta && humanAgent);
  const result = (state, closesAt = null) => ({
    state,
    closesAt,
    templateRequired: platform === 'whatsapp' && state !== 'open',
    messagingTag: state === 'human_agent' ? 'HUMAN_AGENT' : null,
    humanAgentAvailable,
  });
  if (!REPLY_PLATFORMS.includes(platform)) return result('unsupported');
  const last = toDate(lastCustomerMessageAt);
  if (!last) return result('no_customer_message');
  const standardEnd = new Date(last.getTime() + STANDARD_WINDOW_MS);
  if (now < standardEnd) return result('open', standardEnd);
  const humanAgentEnd = new Date(last.getTime() + HUMAN_AGENT_WINDOW_MS);
  if (humanAgentAvailable && now < humanAgentEnd) return result('human_agent', humanAgentEnd);
  return result('closed');
};

/** Why a free-form reply can't go out right now, or null when it can. Only WhatsApp is blocked; see the notes above. */
export const freeformBlockReason = (window) => {
  if (!window.templateRequired) return null;
  return window.state === 'no_customer_message'
    ? '這位客戶還沒有傳訊息給你，WhatsApp 只能用已核准的範本開啟對話'
    : '已超過 24 小時回覆期限，WhatsApp 只能改用已核准的範本發送';
};
