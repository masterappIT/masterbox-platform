import React, { useState } from 'react'

function DataAnalysisPage() {
  const [period, setPeriod] = useState('本週')
  const metrics = [{ label: '總訊息數', value: '0' }, { label: '活躍客戶', value: '0' }, { label: '平均回覆時間', value: '—' }]
  return <main className='p-8'><h1 className='text-2xl font-semibold'>數據分析</h1><div className='mt-6 flex items-center gap-3'><label htmlFor='analysis-period'>期間</label><select id='analysis-period' value={period} onChange={(event) => setPeriod(event.target.value)} className='rounded border p-2'><option>本週</option><option>本月</option><option>本季</option></select></div><div className='mt-6 grid gap-4 md:grid-cols-3'>{metrics.map((metric) => <section key={metric.label} className='rounded border bg-white p-5'><p className='text-sm text-gray-500'>{metric.label}</p><p className='mt-2 text-2xl font-bold'>{metric.value}</p></section>)}</div><p className='mt-8 text-gray-500'>目前尚無足夠資料可供分析。</p></main>
}

export default DataAnalysisPage
