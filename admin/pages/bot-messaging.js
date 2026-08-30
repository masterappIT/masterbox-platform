import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

const imgCard1 = 'https://www.figma.com/api/mcp/asset/4c950e1d-88b2-4c4e-9a1e-16dab7c3b2f0.png'
const imgCard2 = 'https://www.figma.com/api/mcp/asset/8ce6705c-fb86-4783-a02c-2fa566b8ee00.png'
const imgCard3 = 'https://www.figma.com/api/mcp/asset/3cd877a6-c939-4a8b-8210-8e5c5b558d0c.png'
const imgCard4 = 'https://www.figma.com/api/mcp/asset/6f5acd1f-153a-4eee-aa35-ca155cba9b0b.png'
const imgIconSearch = 'https://www.figma.com/api/mcp/asset/11db4689-1c58-425f-8ce6-1d0e703f054a.svg'
const imgDelete = 'https://www.figma.com/api/mcp/asset/d020a72d-8130-4c3f-89a0-008763536763.svg'
const imgPlus = 'https://www.figma.com/api/mcp/asset/5997c9eb-ad93-4ed5-b7fd-4272ed41301e.svg'
const imgToggle = 'https://www.figma.com/api/mcp/asset/aad4c99a-6554-4103-91a2-b3f52b5d99d9.svg'
const imgChevronDown = 'https://www.figma.com/api/mcp/asset/a32197c4-1f48-4126-b5b1-f38a79793442.svg'

const platformOptions = ['Facebook', 'Instagram']
const channelOptions = ['所有頻道', 'Messenger', 'Instagram DM']
const dateOptions = ['2022/09/26', new Date().toLocaleDateString('zh-TW')]
const filterPlatforms = ['全部', ...platformOptions]
const templates = [[imgCard1, '開頭訊息'], [imgCard2, '離線回覆'], [imgCard3, '關鍵字回覆'], [imgCard4, '常見問題']]
const initialBots = templates.map(([image, title], index) => ({ id: `bot-${index + 1}`, image, title, platform: '所有平台', channel: '所有頻道', date: '2022/09/26 13:39', enabled: index < 2 }))

function SelectField({ label, value, onChange, options = ['全部'] }) {
  return <label>{label}<span className='bot-select'><select value={value} onChange={onChange}>{options.map(item => <option key={item}>{item}</option>)}</select><img src={imgChevronDown} alt='' /></span></label>
}

export default function BotMessagingPage() {
  const router = useRouter()
  const preview = router.query.preview
  const [screen, setScreen] = useState(2)
  useEffect(() => {
    if (router.isReady) setScreen(router.query.preview === '0' ? 1 : router.query.preview === '5' ? 5 : router.query.preview === '6' ? 6 : 2)
  }, [router.isReady, router.query.preview])
  const [bots, setBots] = useState(initialBots)
  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState('全部')
  const [channel, setChannel] = useState('全部')
  const [date, setDate] = useState('全部')
  const [selected, setSelected] = useState([])
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('')
  const [sendPlatform, setSendPlatform] = useState('')
  const [sendChannel, setSendChannel] = useState('')
  const [trigger, setTrigger] = useState('關鍵字')
  const [delay, setDelay] = useState('2')
  const [keyword, setKeyword] = useState('')
  const [behavior, setBehavior] = useState('傳送內容')
  const [match, setMatch] = useState('完全相符')
  const [action, setAction] = useState('文字訊息')
  const [text, setText] = useState('')
  const [conditionCount, setConditionCount] = useState(1)
  const [savedAt, setSavedAt] = useState(null)
  useEffect(() => {
    let active = true
    fetch('/api/bots').then(response => response.ok ? response.json() : Promise.reject(new Error('BOT API unavailable'))).then(data => { if (active && Array.isArray(data.bots)) setBots(current => data.bots.map(bot => ({ ...bot, image: templates.find(([, title]) => title === bot.title)?.[0] || imgCard1 }))) }).catch(() => {})
    return () => { active = false }
  }, [])
  const filteredBots = bots.filter(bot => bot.title.includes(search) && (platform === '全部' || bot.platform === platform || bot.platform === '所有平台') && (channel === '全部' || bot.channel === channel) && (date === '全部' || bot.date.startsWith(date)))
  const chooseTemplate = ([, title]) => { setTemplate(title); setName(title); setScreen(5) }
  const removeSelected = async () => { const ids = selected; setBots(current => current.filter(bot => !ids.includes(bot.id))); setSelected([]); await fetch('/api/bots', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }) }
  const toggleBot = async id => { const bot = bots.find(item => item.id === id); if (!bot) return; const enabled = !bot.enabled; setBots(current => current.map(item => item.id === id ? { ...item, enabled } : item)); await fetch('/api/bots', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, enabled }) }) }
  const saveBot = async () => {
    const image = templates.find(([, title]) => title === template)?.[0] || imgCard1
    const payload = { image, title: name || '新建BOT', platform: sendPlatform || '所有平台', channel: sendChannel || '所有頻道', enabled: true, flow: { behavior, trigger, match, keyword, action, text, conditionCount }, settings: { delay } }
    const response = await fetch('/api/bots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!response.ok) return
    const bot = await response.json()
    setBots(current => [...current, bot])
    setSavedAt(new Date())
    setScreen(2)
  }
  const renderToolbar = () => <section className='bot-panel'><div className='bot-toolbar'><label className='bot-search'><img src={imgIconSearch} alt='' /><input value={search} onChange={event => setSearch(event.target.value)} placeholder='依標題搜尋名稱' /></label><div className='bot-toolbar-actions'><button className='bot-delete' disabled={!selected.length} onClick={removeSelected}><img src={imgDelete} alt='' />刪除</button><button className='bot-add' onClick={() => setScreen(4)}><img src={imgPlus} alt='' />新增BOT</button></div></div><div className='bot-filters'><SelectField label='選擇平台' value={platform} onChange={event => setPlatform(event.target.value)} options={filterPlatforms} /><SelectField label='選擇頻道' value={channel} onChange={event => setChannel(event.target.value)} options={['全部', ...channelOptions]} /><SelectField label='建立日期' value={date} onChange={event => setDate(event.target.value)} options={['全部', ...dateOptions]} /></div></section>

  if (screen === 1) return <main className='bot-page'><section className='bot-empty-state bot-panel'><p>還沒建立任何一台機器人，立即試試我們強大的機器人功能吧</p><button className='bot-add' onClick={() => setScreen(4)}><img src={imgPlus} alt='' />新增BOT</button></section></main>

  if (screen === 2) return <main className='bot-page'>{renderToolbar()}<section className='bot-grid'>{filteredBots.map((bot, index) => <article className={`bot-card ${selected.includes(bot.id) ? 'is-selected' : ''}`} key={bot.id || `${bot.title}-${index}`} role='button' tabIndex={0} onClick={() => { setName(bot.title); setScreen(5) }} onKeyDown={event => event.key === 'Enter' && setScreen(5)}><div className='bot-art'><img src={bot.image} alt='' /></div><div className='bot-card-body'><div className='bot-card-title'><h3>{bot.title}</h3><button className={`bot-switch ${bot.enabled ? 'is-on' : ''}`} aria-label={`${bot.title}啟用`} onClick={event => { event.stopPropagation(); toggleBot(bot.id) }}><img src={imgToggle} alt='' /></button></div><p>適用於：{bot.platform}</p><small>編輯時間：{bot.date}</small><label className='bot-card-check' onClick={event => event.stopPropagation()}><input type='checkbox' checked={selected.includes(bot.id)} onChange={() => setSelected(current => current.includes(bot.id) ? current.filter(item => item !== bot.id) : [...current, bot.id])} />選取</label></div></article>)}</section></main>

  if (screen === 4) return <main className='bot-page'><section className='bot-template-grid bot-panel'><header><h2>新增機器人</h2><button className='bot-close' onClick={() => setScreen(bots.length ? 2 : 1)}>×</button></header><div className='bot-grid'>{templates.map(item => <article className='bot-card' key={item[1]} role='button' tabIndex={0} onClick={() => chooseTemplate(item)} onKeyDown={event => event.key === 'Enter' && chooseTemplate(item)}><div className='bot-art'><img src={item[0]} alt='' /></div><div className='bot-card-body'><h3>{item[1]}</h3><p>適用於：所有平台</p></div></article>)}</div></section></main>

  if (screen === 5) return <main className='bot-page'><section className='bot-editor bot-panel'><header><h2>對話BOT設定</h2><button className='bot-close' onClick={() => setScreen(4)}>×</button></header><div className='bot-editor-fields'><label>BOT名稱<input value={name} onChange={event => setName(event.target.value)} placeholder='請輸入' /></label><label>匯入範本<select value={template} onChange={event => { setTemplate(event.target.value); setName(event.target.value) }}><option value=''>選擇或輸入以查詢範本</option>{templates.map(([, title]) => <option key={title}>{title}</option>)}</select></label><label>發送平台<select value={sendPlatform} onChange={event => setSendPlatform(event.target.value)}><option value=''>選擇或輸入以查詢平台</option>{platformOptions.map(item => <option key={item}>{item}</option>)}</select></label><label>發送頻道<select value={sendChannel} onChange={event => setSendChannel(event.target.value)}><option value=''>請選擇一個平台</option><option>所有頻道</option></select></label><label>觸發形式<select value={trigger} onChange={event => setTrigger(event.target.value)}><option>關鍵字</option><option>顧客回覆內容後觸發</option></select></label><label>訊息回覆延遲時間<div className='bot-delay'><input type='number' min='0' value={delay} onChange={event => setDelay(event.target.value)} /><span>秒</span></div></label><label className='wide'>機器人關鍵字發生衝突時回傳文字<textarea maxLength={160} value={text} onChange={event => setText(event.target.value)} placeholder='請輸入文字（必填）' /><small>{text.length}/160</small></label></div><footer><button onClick={() => setScreen(4)}>取消</button><button className='primary' onClick={() => setScreen(6)}>儲存</button></footer></section></main>

  return <main className='bot-page bot-g6-page'><section className='bot-flow-panel bot-panel'><header><h2>流程設定</h2><button className='bot-close' onClick={() => setScreen(5)} aria-label='關閉'>×</button></header><div className='bot-flow-fields'><label>流程名稱<input value={name} onChange={event => setName(event.target.value)} placeholder='請輸入' /></label><label>行為模式<select value={behavior} onChange={event => setBehavior(event.target.value)}><option>傳送內容</option><option>等待回覆</option></select></label></div><div className='bot-flow-condition'><h3>條件</h3>{Array.from({ length: conditionCount }, (_, index) => <div className='bot-condition' key={index}><label>條件<select value={trigger} onChange={event => setTrigger(event.target.value)}><option>關鍵字</option><option>顧客回覆內容後觸發</option></select></label><label>完全相符<select value={match} onChange={event => setMatch(event.target.value)}><option>完全相符</option><option>包含</option></select></label><input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder='填入關鍵字' /></div>)}<button className='bot-add-condition' onClick={() => setConditionCount(count => count + 1)}>新增條件</button></div><div className='bot-flow-actions'><h3>新增動作</h3><div className='bot-actions'>{['文字訊息', '圖片訊息', '輪播訊息', '用戶輸入'].map(item => <button className={action === item ? 'active' : ''} key={item} onClick={() => setAction(item)}>{item}</button>)}</div><div className='bot-action-editor'><h4>{action}</h4>{action === '文字訊息' ? <textarea maxLength={2000} value={text} onChange={event => setText(event.target.value)} placeholder='請輸入訊息內容' /> : <button type='button'>上傳{action.replace('訊息', '')}</button>}</div></div><footer><button onClick={() => setScreen(5)}>上一步</button><button className='primary' onClick={saveBot}>儲存</button></footer></section></main>
}


