import React, { useMemo, useState } from 'react'

const tenants = [
  { name: 'EC Travel', owner: '王小明', plan: 'Professional', status: 'active', users: 18, channels: 6, usage: '72%' },
  { name: 'North Star Logistics', owner: '陳小姐', plan: 'Enterprise', status: 'active', users: 42, channels: 11, usage: '48%' },
  { name: 'Pacific Retail', owner: '林先生', plan: 'Starter', status: 'past_due', users: 5, channels: 2, usage: '94%' },
  { name: 'Atlas Concierge', owner: 'Alice Chen', plan: 'Trial', status: 'trial', users: 3, channels: 1, usage: '21%' },
]

const statusLabel = { active: '運作中', trial: '試用中', past_due: '付款逾期', suspended: '已停用' }

function Metric({ label, value, detail, tone = 'orange' }) {
  return <article className={`platform-metric platform-metric-${tone}`}><span className='platform-metric-icon'>●</span><div><small>{label}</small><strong>{value}</strong><em>{detail}</em></div></article>
}

export default function PlatformAdminPage() {
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState(null)
  const [activeTab, setActiveTab] = useState('租戶總覽')
  const filteredTenants = useMemo(() => tenants.filter((tenant) => `${tenant.name} ${tenant.owner}`.toLowerCase().includes(query.toLowerCase())), [query])
  const notify = (message) => setNotice(message)

  return <main className='platform-admin-page'>
    <div className='platform-admin-heading'><div><span className='platform-eyebrow'>MASTERBOX PLATFORM</span><h1>平台管理中心</h1><p>管理所有租戶、訂閱與平台健康狀態</p></div><button className='platform-refresh' onClick={() => notify('平台資料已更新')}>↻ 更新資料</button></div>
    {notice && <button className='platform-notice' onClick={() => setNotice(null)}>{notice} ×</button>}
    <nav className='platform-tabs' aria-label='平台管理功能'>{['租戶總覽', '訂閱與方案', '平台健康', '審計紀錄'].map((tab) => <button key={tab} className={activeTab === tab ? 'is-active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
    <section className='platform-metrics'><Metric label='活躍租戶' value='128' detail='↑ 12.4% 較上月' /><Metric label='月度經常性收入' value='NT$ 486K' detail='↑ 8.6% 較上月' tone='green' /><Metric label='待處理事件' value='7' detail='3 個高優先級' tone='purple' /><Metric label='平台健康度' value='99.8%' detail='所有服務正常' tone='blue' /></section>
    <section className='platform-grid-main'>
      <article className='platform-card platform-health-card'><div className='platform-card-header'><div><h2>平台健康</h2><p>即時服務與整合狀態</p></div><button onClick={() => notify('健康檢查已重新執行')}>重新檢查</button></div><div className='health-list'>{[['Backend API', '正常', '42ms'], ['Database', '正常', '18ms'], ['Meta Graph API', '正常', '126ms'], ['Webhook Queue', '注意', '待處理 3 件']].map(([name, state, detail]) => <div className='health-row' key={name}><span className={`health-dot ${state === '注意' ? 'warning' : ''}`} /><strong>{name}</strong><b>{state}</b><small>{detail}</small></div>)}</div></article>
      <article className='platform-card platform-alert-card'><div className='platform-card-header'><div><h2>需要關注</h2><p>平台營運提醒</p></div><span className='platform-alert-count'>7</span></div><div className='alert-item'><span>!</span><div><strong>3 個租戶付款逾期</strong><p>請在 7 天內處理</p></div></div><div className='alert-item'><span>!</span><div><strong>2 個 Meta Token 即將到期</strong><p>需要重新授權</p></div></div><button className='platform-text-button' onClick={() => notify('即將開啟全部事件')}>查看全部事件 →</button></article>
    </section>
    <section className='platform-card platform-tenants-card'><div className='platform-card-header'><div><h2>租戶總覽</h2><p>目前平台上的所有公司與服務狀態</p></div><div className='platform-actions'><input aria-label='搜尋租戶' placeholder='搜尋租戶或管理員' value={query} onChange={(event) => setQuery(event.target.value)} /><button onClick={() => notify('新增租戶功能即將推出')}>＋ 新增租戶</button></div></div><div className='platform-table-wrap'><table><thead><tr><th>租戶</th><th>方案</th><th>狀態</th><th>用戶</th><th>渠道</th><th>用量</th><th>操作</th></tr></thead><tbody>{filteredTenants.map((tenant) => <tr key={tenant.name}><td><strong>{tenant.name}</strong><small>{tenant.owner}</small></td><td>{tenant.plan}</td><td><span className={`tenant-status ${tenant.status}`}>{statusLabel[tenant.status]}</span></td><td>{tenant.users}</td><td>{tenant.channels}</td><td><div className='usage-cell'><span><i style={{ width: tenant.usage }} /></span>{tenant.usage}</div></td><td><button className='row-action' onClick={() => notify(`已選取 ${tenant.name}`)}>查看</button></td></tr>)}</tbody></table>{filteredTenants.length === 0 && <p className='platform-empty'>找不到符合的租戶</p>}</div></section>
  </main>
}
