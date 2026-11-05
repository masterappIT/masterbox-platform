export const TEMPLATE_PLATFORMS = [
  { value: 'fb', label: 'Facebook' },
  { value: 'ig', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'line', label: 'LINE' },
  { value: 'wechat', label: 'WeChat' },
]

export const TEMPLATE_TEXT_LIMIT = 160

export const platformLabel = (value) => TEMPLATE_PLATFORMS.find((platform) => platform.value === value)?.label || value

// Reads the stored JSON: `{ messages: [{ type: 'text', text }] }`, or the older `{ text }`.
export const parseTemplateMessages = (contents) => {
  let data = contents
  try { data = typeof contents === 'string' ? JSON.parse(contents) : contents } catch { return [] }
  if (Array.isArray(data?.messages)) return data.messages.filter((message) => message?.type === 'text').map((message) => String(message.text || ''))
  if (typeof data?.text === 'string') return [data.text]
  return []
}

export const serializeTemplateMessages = (messages) => JSON.stringify({ messages: messages.map((text) => ({ type: 'text', text: text.trim() })) })
