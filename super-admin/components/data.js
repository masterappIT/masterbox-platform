export const sections = [
  ['overview', '總覽', '▦', '/'],
  ['tenants', '租戶管理', '⌂', '/tenants'],
  ['subscriptions', '訂閱與方案', '◈', '/subscriptions'],
  ['health', '系統健康', '◉', '/health'],
  ['admins', '管理員帳戶', '♙', '/admins'],
  ['audit', '審計紀錄', '☷', '/audit'],
]

export const tenants = [
  { id: 'ec-travel', name: 'EC Travel', plan: 'Professional', status: '運作中', users: 18, usage: 72, admin: 'Mei Lin', region: '台灣 · ap-east-1', renewal: '2026/09/14' },
  { id: 'north-star', name: 'North Star Logistics', plan: 'Enterprise', status: '運作中', users: 42, usage: 48, admin: 'Jordan Wu', region: '新加坡 · ap-southeast-1', renewal: '2027/01/08' },
  { id: 'pacific-retail', name: 'Pacific Retail', plan: 'Starter', status: '付款逾期', users: 5, usage: 94, admin: 'Olivia Chen', region: '台灣 · ap-east-1', renewal: '2026/08/26' },
  { id: 'atlas-concierge', name: 'Atlas Concierge', plan: 'Trial', status: '試用中', users: 3, usage: 21, admin: 'Alex Huang', region: '日本 · ap-northeast-1', renewal: '2026/09/02' },
]

export const services = [
  { name: 'API Gateway', latency: '42ms', state: 'ok', uptime: '99.99%' },
  { name: 'Database', latency: '18ms', state: 'ok', uptime: '99.98%' },
  { name: 'Meta Graph API', latency: '126ms', state: 'ok', uptime: '99.95%' },
  { name: 'Webhook Queue', latency: '3 pending', state: 'warn', uptime: '99.91%' },
]

export const auditLogs = [
  ['Platform Admin', '更新 North Star Logistics 方案', '訂閱', '12 分鐘前', '成功'],
  ['Mei Lin', '登入租戶管理後台', '登入', '35 分鐘前', '成功'],
  ['Platform Admin', '重新執行系統健康檢查', '系統', '1 小時前', '成功'],
  ['Jordan Wu', '邀請 3 位團隊成員', '租戶', '2 小時前', '成功'],
  ['Billing Bot', 'Pacific Retail 付款失敗', '帳務', '3 小時前', '需要注意'],
  ['Platform Admin', '撤銷過期 Meta Token', '安全性', '昨天', '成功'],
]
