const bots = globalThis.__masterboxBots || (globalThis.__masterboxBots = [])

const seedBots = () => {
  if (bots.length) return
  bots.push(
    { id: 'bot-1', title: '開頭訊息', platform: '所有平台', channel: '所有頻道', date: '2022/09/26 13:39', enabled: true },
    { id: 'bot-2', title: '離線回覆', platform: '所有平台', channel: '所有頻道', date: '2022/09/26 13:39', enabled: true },
    { id: 'bot-3', title: '關鍵字回覆', platform: '所有平台', channel: '所有頻道', date: '2022/09/26 13:39', enabled: false },
    { id: 'bot-4', title: '常見問題', platform: '所有平台', channel: '所有頻道', date: '2022/09/26 13:39', enabled: false }
  )
}

export default function handler(req, res) {
  seedBots()
  if (req.method === 'GET') return res.status(200).json({ bots })
  if (req.method === 'POST') {
    const bot = { ...req.body, id: `bot-${Date.now()}`, date: new Date().toLocaleString('zh-TW'), enabled: req.body.enabled !== false }
    bots.push(bot)
    return res.status(201).json(bot)
  }
  if (req.method === 'PATCH') {
    const index = bots.findIndex(item => item.id === req.body.id)
    if (index < 0) return res.status(404).json({ error: 'BOT not found' })
    bots[index] = { ...bots[index], ...req.body }
    return res.status(200).json(bots[index])
  }
  if (req.method === 'DELETE') {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    const remaining = bots.filter(item => !ids.includes(item.id))
    bots.splice(0, bots.length, ...remaining)
    return res.status(200).json({ bots })
  }
  res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE'])
  return res.status(405).json({ error: 'Method not allowed' })
}
