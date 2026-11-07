// Whether a conversation can still be answered, by its platform's rules. The server works this out too (each connector's
// replyRule); the admin repeats it so the notice counts down and follows live messages without asking again.
//
// Sources with the reply_window capability (Messenger, Instagram, WhatsApp 官方) can be answered for 24 hours after the
// customer's last message. After that, a source with templates (WhatsApp 官方) only takes an approved template; the
// others allow 7 days for a person replying with the human agent tag once Meta has approved it
// (the server says so in replyWindow.humanAgentAvailable).

import { can } from '../components/Chat/capabilities'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
export const STANDARD_WINDOW_MS = 24 * HOUR_MS
export const HUMAN_AGENT_WINDOW_MS = 7 * 24 * HOUR_MS
// Below this much time left, the agent is warned.
const ENDING_SOON_MS = 3 * HOUR_MS

/**
 * @param room - a conversation with lastCustomerMessageAt and replyWindow from the server
 * @param capabilities - the conversation's source's
 * @returns null when the source has no reply window, otherwise {{ state: 'open'|'human_agent'|'closed'|'no_customer_message'|'unsupported', closesAt: number|null, windowEndedAt: number|null, templateRequired: boolean, humanAgentAvailable: boolean }}
 *   windowEndedAt: when the 24 hours ran out, once they have
 */
export const replyWindowOf = (room, capabilities, now = Date.now()) => {
  if (room?.replyWindow?.state === 'unsupported') {
    return { state: 'unsupported', closesAt: null, windowEndedAt: null, templateRequired: false, humanAgentAvailable: false }
  }
  if (!can(capabilities, 'reply_window')) return null
  const hasTemplates = can(capabilities, 'templates')
  const humanAgentAvailable = Boolean(!hasTemplates && room?.replyWindow?.humanAgentAvailable)
  const last = room?.lastCustomerMessageAt ? new Date(room.lastCustomerMessageAt).getTime() : NaN
  const windowEndedAt = Number.isNaN(last) || now < last + STANDARD_WINDOW_MS ? null : last + STANDARD_WINDOW_MS
  const result = (state, closesAt = null) => ({ state, closesAt, windowEndedAt, templateRequired: hasTemplates && state !== 'open', humanAgentAvailable })
  if (Number.isNaN(last)) return result('no_customer_message')
  if (now < last + STANDARD_WINDOW_MS) return result('open', last + STANDARD_WINDOW_MS)
  if (humanAgentAvailable && now < last + HUMAN_AGENT_WINDOW_MS) return result('human_agent', last + HUMAN_AGENT_WINDOW_MS)
  return result('closed')
}

/** 2 天 3 小時, 5 小時 20 分, 12 分 */
export const formatRemaining = (ms) => {
  // Rounded down, so the agent never has less time than it says.
  const minutes = Math.max(1, Math.floor(ms / MINUTE_MS))
  const days = Math.floor(minutes / (24 * 60))
  const hours = Math.floor((minutes % (24 * 60)) / 60)
  const rest = minutes % 60
  if (days) return hours ? `${days} 天 ${hours} 小時` : `${days} 天`
  if (hours) return rest ? `${hours} 小時 ${rest} 分` : `${hours} 小時`
  return `${rest} 分`
}

/** 11/6 10:12 */
export const formatMoment = (time) => {
  const date = new Date(time)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * What the chat tells the agent about replying now, or null when there is nothing to warn about.
 * @param {string} sourceName - such as WhatsApp 官方, for a source that can't be answered here
 * @returns {{ title: string, detail?: string, templateAction: boolean } | null} templateAction: offer 選擇範本
 */
export const replyWindowNotice = (window, { capabilities, lastCustomerMessageAt, sourceName }, now = Date.now()) => {
  if (!window) return null
  const hasTemplates = can(capabilities, 'templates')
  const left = window.closesAt ? window.closesAt - now : 0
  const lastMessage = lastCustomerMessageAt ? `客戶最後一則訊息在 ${formatMoment(lastCustomerMessageAt)}。` : ''
  switch (window.state) {
    case 'open':
      if (left > ENDING_SOON_MS) return null
      return {
        title: `回覆期限剩 ${formatRemaining(left)}（${formatMoment(window.closesAt)} 截止）`,
        detail: hasTemplates ? '之後只能傳送已核准的範本，客戶回覆後會重新開放。' : '平台規定客戶最後一則訊息後 24 小時內可以回覆。',
        templateAction: false,
      }
    case 'human_agent':
      return {
        title: `已超過 24 小時，還能以真人客服身分回覆 ${formatRemaining(left)}`,
        detail: `${lastMessage}這段期間的訊息會加上 Meta 的 Human Agent 標籤，只能由真人回覆，不能用於自動回覆或行銷。`,
        templateAction: false,
      }
    case 'closed':
      if (hasTemplates) {
        return { title: '已超過 24 小時回覆期限', detail: `${lastMessage}${sourceName || '平台'}規定之後只能傳送已核准的範本，客戶回覆後會重新開放。`, templateAction: true }
      }
      return {
        title: '已超過回覆期限，訊息很可能會被拒絕',
        detail: `${lastMessage}${window.humanAgentAvailable ? '' : '要延長到 7 天，需要 Meta 核准 App 的 Human Agent 權限。'}若對話來自廣告，平台可能給更長的期限，仍可試著傳送。`,
        templateAction: false,
      }
    case 'no_customer_message':
      return hasTemplates
        ? { title: '客戶還沒傳訊息給你', detail: '只能用已核准的範本開啟對話。', templateAction: true }
        : { title: '客戶還沒傳訊息給你', detail: '平台不允許商家先傳訊息，訊息很可能會被拒絕。', templateAction: false }
    default:
      return { title: `目前還不支援回覆${sourceName ? ` ${sourceName} ` : '這個來源'}的訊息`, detail: '客戶的訊息仍會收進來。', templateAction: false }
  }
}

/**
 * Where the 24 hours of a source with reply_window ran out, among the messages: the index of the first message after
 * that moment (the messages' length when it comes after all of them), or -1 while the window is open.
 */
export const windowEndIndex = (messages, lastCustomerMessageAt, now = Date.now()) => {
  const last = lastCustomerMessageAt ? new Date(lastCustomerMessageAt).getTime() : NaN
  if (Number.isNaN(last) || now < last + STANDARD_WINDOW_MS) return -1
  const endedAt = last + STANDARD_WINDOW_MS
  const index = messages.findIndex(({ createdAt }) => new Date(createdAt).getTime() >= endedAt)
  return index === -1 ? messages.length : index
}
