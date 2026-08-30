import React, { useMemo, useState } from 'react'

const platforms = [
  { name: 'Facebook', icon: '/svg/fb.svg', color: '#4f8df7', value: '12,580', change: '+12.5%' },
  { name: 'Instagram', icon: '/svg/ig.svg', color: '#e5689b', value: '8,240', change: '+8.2%' },
  { name: 'WhatsApp', icon: '/svg/whatsapp.svg', color: '#5fc37b', value: '5,690', change: '+5.8%' },
]

const messages = [
  ['王小明', '您好，我想詢問訂單進度', '剛剛'],
  ['陳小姐', '請問可以修改配送地址嗎？', '3 分鐘前'],
  ['林先生', '謝謝您的協助！', '8 分鐘前'],
  ['Alice Chen', 'I need help with my booking', '12 分鐘前'],
]

function TrendChart({ period }) {
  const points = period === '本週' ? '0,84 45,70 90,76 135,48 180,55 225,25 270,38 315,12' : '0,78 45,62 90,70 135,42 180,48 225,30 270,36 315,18'
  return <svg className='dashboard-chart' viewBox='0 0 315 105' role='img' aria-label='訊息趨勢圖'>
    <defs><linearGradient id='chartFill' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stopColor='#ffab37' stopOpacity='.28' /><stop offset='1' stopColor='#ffab37' stopOpacity='0' /></linearGradient></defs>
    <path d={`M ${points.replaceAll(' ', ' L ')} L 315,105 L 0,105 Z`} fill='url(#chartFill)' />
    <polyline points={points} fill='none' stroke='#ffab37' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' />
    {[0, 1, 2, 3].map((item) => <line key={item} x1='0' x2='315' y1={item * 26} y2={item * 26} stroke='#eee' />)}
  </svg>
}

export default function HomePage() {
  const [period, setPeriod] = useState('本週')
  const [notice, setNotice] = useState(null)
  const total = useMemo(() => period === '本週' ? '26,510' : '98,420', [period])

  return <main className='dashboard-page'>
    <div className='dashboard-heading'><div><h1>首頁</h1><p>掌握您的社群平台營運狀況</p></div><button className='dashboard-refresh' onClick={() => setNotice('資料已更新')}>↻ 更新資料</button></div>
    {notice && <button className='dashboard-notice' onClick={() => setNotice(null)}>{notice} ×</button>}
    <section className='dashboard-stats'>
      <article><span className='stat-icon stat-orange'>◉</span><div><small>總訊息數</small><strong>{total}</strong><em>↑ 18.6% <i>較上期</i></em></div></article>
      <article><span className='stat-icon stat-blue'>♧</span><div><small>活躍客戶</small><strong>8,426</strong><em>↑ 12.4% <i>較上期</i></em></div></article>
      <article><span className='stat-icon stat-green'>◒</span><div><small>已連結平台</small><strong>8</strong><em>↑ 2 <i>個平台</i></em></div></article>
      <article><span className='stat-icon stat-purple'>◷</span><div><small>平均回覆時間</small><strong>2.4<span> 分鐘</span></strong><em>↓ 0.8 <i>較上期</i></em></div></article>
    </section>
    <section className='dashboard-main-grid'>
      <article className='dashboard-card trend-card'><div className='card-header'><div><h2>訊息趨勢</h2><p>各平台訊息數量統計</p></div><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>本週</option><option>本月</option></select></div><TrendChart period={period} /><div className='chart-labels'><span>週一</span><span>週二</span><span>週三</span><span>週四</span><span>週五</span><span>週六</span><span>週日</span></div></article>
      <article className='dashboard-banner'><div><small>本月營運表現</small><strong>表現優於 86% 的商家</strong><p>持續保持良好的服務品質！</p></div><span>✦</span></article>
      <article className='dashboard-card messages-card'><div className='card-header'><div><h2>即時訊息</h2><p>最新的客戶對話</p></div><button onClick={() => setNotice('即將前往即時訊息')}>查看全部</button></div>{messages.map(([name, text, time]) => <div className='message-row' key={name}><span className='message-avatar'>{name[0]}</span><div><strong>{name}</strong><p>{text}</p></div><time>{time}</time></div>)}</article>
    </section>
    <section className='dashboard-card platform-card'><div className='card-header'><div><h2>平台概況</h2><p>各社群平台的訊息與客戶數據</p></div><button onClick={() => setNotice('即將前往數據分析')}>查看詳細報表 →</button></div><div className='platform-grid'>{platforms.map((platform) => <div className='platform-item' key={platform.name}><div><img src={platform.icon} alt='' style={{ backgroundColor: platform.color }} /><strong>{platform.name}</strong></div><b>{platform.value}</b><em>{platform.change}</em><div className='platform-bar'><span style={{ width: `${parseInt(platform.value.replace(',', ''), 10) / 140}%`, backgroundColor: platform.color }} /></div></div>)}</div></section>
  </main>
}
