// Whether a conversation can still be answered, by Meta's rules. The server works this out too
// (backend/lib/messaging/replyWindow.js); the admin repeats it so the notice counts down and
// follows live messages without asking again.
//
// WhatsApp: 24 hours after the customer's last message, then only an approved template.
// Messenger and Instagram: 24 hours, or 7 days for a person replying with the human agent tag once
// Meta has approved it (the server says so in replyWindow.humanAgentAvailable).

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
export const STANDARD_WINDOW_MS = 24 * HOUR_MS
export const HUMAN_AGENT_WINDOW_MS = 7 * 24 * HOUR_MS
// Below this much time left, the notice turns into a warning.
const ENDING_SOON_MS = 3 * HOUR_MS

const PLATFORM_NAMES = { fb: 'Facebook', ig: 'Instagram', whatsapp: 'WhatsApp', line: 'LINE', wechat: 'WeChat' }

/**
 * @param room - a conversation with platform, lastCustomerMessageAt and replyWindow from the server
 * @returns {{ state: 'open'|'human_agent'|'closed'|'no_customer_message'|'unsupported', closesAt: number|null, templateRequired: boolean, humanAgentAvailable: boolean }}
 */
export const replyWindowOf = (room, now = Date.now()) => {
  const platform = room?.platform
  const isMeta = platform === 'fb' || platform === 'ig'
  const humanAgentAvailable = Boolean(isMeta && room?.replyWindow?.humanAgentAvailable)
  const result = (state, closesAt = null) => ({ state, closesAt, templateRequired: platform === 'whatsapp' && state !== 'open', humanAgentAvailable })
  if (!['fb', 'ig', 'whatsapp'].includes(platform)) return result('unsupported')
  const last = room?.lastCustomerMessageAt ? new Date(room.lastCustomerMessageAt).getTime() : NaN
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

const formatDeadline = (time) => new Date(time).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * What the chat tells the agent about replying now.
 * @returns {{ tone: 'info'|'warning'|'blocked', text: string, detail?: string }}
 */
export const replyWindowNotice = (window, platform, now = Date.now()) => {
  const left = window.closesAt ? window.closesAt - now : 0
  switch (window.state) {
    case 'open':
      return {
        tone: left <= ENDING_SOON_MS ? 'warning' : 'info',
        text: `可回覆，還剩 ${formatRemaining(left)}（${formatDeadline(window.closesAt)} 前）`,
        detail: `Meta 規定客戶最後一則訊息後 24 小時內可以回覆${platform === 'whatsapp' ? '，之後只能用已核准的範本' : ''}。`,
      }
    case 'human_agent':
      return {
        tone: 'warning',
        text: `已超過 24 小時，還能以真人客服身分回覆 ${formatRemaining(left)}（${formatDeadline(window.closesAt)} 前）`,
        detail: '這段期間的訊息會加上 Meta 的 Human Agent 標籤，只能由真人回覆，不能用於自動回覆或行銷。',
      }
    case 'closed':
      if (platform === 'whatsapp') {
        return { tone: 'blocked', text: '已超過 24 小時回覆期限，只能用已核准的 WhatsApp 範本發送', detail: '客戶再傳訊息後，就能恢復一般回覆。' }
      }
      return {
        tone: 'warning',
        text: `已超過 Meta 的回覆期限（客戶最後一則訊息後 ${window.humanAgentAvailable ? '7 天' : '24 小時'}），訊息很可能會被拒絕`,
        detail: `${window.humanAgentAvailable ? '' : '要延長到 7 天，需要 Meta 核准 App 的 Human Agent 權限。'}若對話來自 Facebook／Instagram 廣告，Meta 可能給更長的期限，仍可試著傳送。`,
      }
    case 'no_customer_message':
      return platform === 'whatsapp'
        ? { tone: 'blocked', text: '這位客戶還沒傳訊息給你，只能用已核准的 WhatsApp 範本開啟對話' }
        : { tone: 'warning', text: '這位客戶還沒傳訊息給你，Meta 不允許商家先傳訊息，訊息很可能會被拒絕' }
    default:
      return { tone: 'blocked', text: `目前還不支援回覆 ${PLATFORM_NAMES[platform] || platform || '這個平台'} 的訊息` }
  }
}

export const canSendFreeform = (window) => !window.templateRequired && window.state !== 'unsupported'
