import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useQuery } from '@apollo/client'
import Button from '../src/stories/components/Button'
import EmptyState from '../src/stories/components/EmptyState'
import PendingNote from '../src/components/PendingNote'
import TableTop from '../src/components/Table/TableTop'
import { MESSAGE_TEMPLATES } from '../src/graphQL/messageTemplate'
import { parseTemplateMessages, platformLabel, TEMPLATE_PLATFORMS } from '../src/utils/messageTemplate'
import { getUserSubscribedChannels, selectChannels } from '../src/redux/slices/messagesSlices'

const UNAVAILABLE = '對話BOT 尚未開放，目前無法建立或儲存機器人'
const CONFLICT_TEXT_LIMIT = 160

const BOT_TYPES = [
  { title: '開頭訊息', image: 'opening', description: '讓顧客在第一次開啟對話，或是加入好友時，會開啟您設定的回覆。' },
  { title: '離線回覆', image: 'offline', description: '在非營業時間或離線時，讓顧客得知您將會盡快回覆。' },
  { title: '關鍵字回覆', image: 'keyword', description: '當顧客輸入特定關鍵字時，系統將自動回覆您設置好的回覆範本。' },
  { title: '客製化機器人', image: 'custom', description: '運用多種回覆模式，為專案量身打造機器人。' },
]

const PRESETS = [
  ['Instagram 限時動態@商業帳號', '自動向在個人限時動態中，用@提及你 Instagram 商業帳號的人傳送訊息。'],
  ['防疫實聯制', '提供從加入好友、填寫問卷、同步 Google 試算表、回覆訊息，一系列的規格化模組。'],
  ['訂閱回覆', '讓顧客在訂閱您的社群後，能有一個完善的後續體驗。'],
  ['飯店 / 旅館 / 民宿', '提供房型介紹、專案優惠、飯店設施以及用餐服務介紹，並提供顧客線上諮詢。'],
  ['餐廳派對企劃', '為您的顧客提供線上預訂餐敘、派對、慶生等企劃服務，提升顧客與餐廳黏著度。'],
  ['房地產買賣', '透過系列房產相關的線上諮詢，了解顧客更多資訊，將合格客戶轉化為仲介的銷售目標。'],
  ['餐廳訂位', '透過預訂餐廳所需要的問題，紀錄顧客的資訊，轉交給餐廳人員進行安排並回覆。'],
  ['找公寓 / 租房', '按照物件類型、地區、坪數、房間數量等條件，來協助顧客找到出租房屋及店面。'],
  ['保險業', '代表您從潛在客戶那裡獲取他們的繁瑣資訊並儲存記錄，您將有更多時間專注於銷售。'],
  ['用餐評論', '邀請消費顧客在多種社群上撰寫評論，以得到餐廳提供的優惠活動，獲得更多五星評價。'],
  ['行銷活動', '利用挑戰題抽獎，拓展您的電商營銷業務，將顧客的興趣轉化為數據，提高商品營收數字。'],
  ['婚禮企劃顧問', '以婚顧公司為主題，提供服務項目、經典服務案例、專案優惠、關於品牌以及線上諮詢。'],
  ['髮廊', '提供髮廊的服務項目、價目表、環境及位置，以及專業髮型設計師的介紹。'],
  ['美容沙龍', '提供美容沙龍的服務項目，如霧眉、接睫毛等，另有專案優惠及專業團隊介紹。'],
  ['餐廳優惠推薦', '透過網友好評、地點查詢，讓顧客選擇各式類型餐點優惠券並前往購買並訂閱優惠資訊。'],
  ['商城導購', '透過問答了解顧客喜好，並且引導到您官網或商城的特定類別及品項。'],
  ['品牌店舖介紹', '傳達您的品牌理念、生活提案、店舖或門市資訊，讓顧客輕易地認識您的企業。'],
  ['熱門排行', '將您的各種商品分類排行榜清楚列出，掌握最新潮流，吸引顧客選購慾望。'],
  ['優惠代碼', '將您品牌商城的優惠代碼傳達給特定顧客，適合發送給精準 TA 的優惠活動。'],
  ['活動懶人包', '包含活動報名、票務資訊、活動介紹、活動議程、活動報到、活動回饋流程。'],
  ['客訴與建議', '將常見的客訴問題彙整，減少客服人員面對負面情緒，並讓顧客適時地留下建議資訊。'],
  ['汽車經銷', '讓顧客可以瀏覽您的車輛規格，並填寫表單要求試乘，查詢車輛出售價格估算。'],
  ['新聞 / 媒體 / 出版', '透過簡單問題，讓顧客訂閱新聞類別，將可以利用顧客興趣標籤，主動提供新聞資訊。'],
  ['旅遊機構 / 旅行社', '提供旅遊線上諮詢、門市據點、景點介紹、專案優惠、國內外旅遊規劃以及代辦事項。'],
]

function BotList({ onAdd }) {
  return (
    <section className='pending-card min-h-[calc(100vh-125px)]'>
      <TableTop
        searchPlaceholder='依標題搜尋名稱'
        addTitle='新增BOT'
        addOnClick={onAdd}
        deleteOnClick={() => {}}
        deleteDisabled
        deleteHint='沒有可刪除的機器人'
      >
        <div className='flex flex-wrap gap-x-[24px] gap-y-[12px]'>
          {['選擇平台', '選擇頻道', '建立日期'].map((label) => (
            <label key={label} className='bot-filter'>
              <span>{label}</span>
              <select disabled><option>全部</option></select>
            </label>
          ))}
        </div>
      </TableTop>
      <div className='mt-[72px]'>
        <EmptyState title='還沒有任何一台機器人' description={`${UNAVAILABLE}。你可以先瀏覽機器人的類型。`} />
      </div>
    </section>
  )
}

function BotGallery({ onPick, onBack }) {
  return (
    <section className='pending-card'>
      <div className='user-form-head'>
        <h2 className='bot-gallery-title'>依據流程，為您的品牌建造與顧客進行自動化對話的各類型聊天機器人</h2>
        <Button title='返回' color='grayscale' onClick={onBack} />
      </div>
      <PendingNote>{`${UNAVAILABLE}，此頁僅供預覽。`}</PendingNote>
      <ul className='bot-grid'>
        {BOT_TYPES.map(({ title, image, description }) => (
          <li key={title}>
            <button type='button' className='bot-card' onClick={() => onPick(title)}>
              <img src={`/design/bot/${image}.jpg`} alt='' width={404} height={209} />
              <strong>{title}</strong>
              <span>{description}</span>
            </button>
          </li>
        ))}
      </ul>
      <h3 className='bot-section-title'><span>MasterBox預設機器人</span></h3>
      <ul className='bot-grid'>
        {PRESETS.map(([title, description]) => (
          <li key={title}>
            <button type='button' className='bot-card' onClick={() => onPick(title)}>
              <i className='bot-card-placeholder' aria-hidden='true' />
              <strong>{title}</strong>
              <span>{description}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function BotEditor({ initialName, onCancel }) {
  const dispatch = useDispatch()
  const channels = useSelector(selectChannels)
  const { data } = useQuery(MESSAGE_TEMPLATES)
  const [name, setName] = useState(initialName)
  const [platform, setPlatform] = useState('')
  const [channelId, setChannelId] = useState('')
  const [delay, setDelay] = useState('2')
  const [conflictText, setConflictText] = useState('')
  const [templateId, setTemplateId] = useState('')
  const templates = data?.messageTemplates || []

  useEffect(() => { dispatch(getUserSubscribedChannels()) }, [dispatch])

  const platforms = TEMPLATE_PLATFORMS.filter(({ value }) => channels.some((channel) => channel.platform === value))
  const channelOptions = channels.filter((channel) => !platform || channel.platform === platform)
  const importTemplate = (id) => {
    setTemplateId(id)
    const template = templates.find((item) => item.id === id)
    if (template) setConflictText(parseTemplateMessages(template.contents).join('\n'))
  }

  return (
    <div className='bot-editor'>
      <aside className='bot-editor-side'>
        <button type='button' className='bot-editor-step bot-editor-step-active'>BOT設定</button>
        <button type='button' className='bot-editor-step' disabled title={UNAVAILABLE}>＋ 新增流程</button>
      </aside>
      <div className='bot-editor-canvas'>
        <section className='pending-card'>
          <div className='user-form-head'>
            <h2 className='user-form-title'>對話BOT設定</h2>
            <div className='flex gap-[8px]'>
              <Button title='取消' color='grayscale' onClick={onCancel} />
              <Button title='儲存' disabled hint={UNAVAILABLE} />
            </div>
          </div>
          <PendingNote>{`${UNAVAILABLE}，此頁僅供預覽。`}</PendingNote>
          <div className='bot-editor-grid'>
            <label className='user-form-select'><span>BOT名稱</span><input className='pending-input' placeholder='請輸入' value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className='user-form-select'><span>匯入範本</span>
              <select value={templateId} onChange={(event) => importTemplate(event.target.value)} disabled={!templates.length}>
                <option value=''>{templates.length ? '選擇範本' : '還沒有訊息範本'}</option>
                {templates.map(({ id, name: templateName }) => <option key={id} value={id}>{templateName}</option>)}
              </select>
            </label>
            <label className='user-form-select'><span>發送平台</span>
              <select value={platform} onChange={(event) => { setPlatform(event.target.value); setChannelId('') }}>
                <option value=''>所有平台</option>
                {platforms.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className='user-form-select'><span>發送頻道</span>
              <select value={channelId} onChange={(event) => setChannelId(event.target.value)}>
                <option value=''>所有頻道</option>
                {channelOptions.map(({ account, name: channelName, platform: channelPlatform }) => <option key={account} value={account}>{`${platformLabel(channelPlatform)} · ${channelName}`}</option>)}
              </select>
            </label>
            <label className='user-form-select'><span>觸發形式</span>
              <select defaultValue='content'><option value='content'>顧客回覆內容後觸發</option></select>
            </label>
            <label className='user-form-select'><span>訊息回覆延遲時間</span>
              <span className='bot-delay'>
                <input className='pending-input' inputMode='numeric' aria-label='訊息回覆延遲秒數' value={delay} onChange={(event) => setDelay(event.target.value.replace(/\D/g, ''))} />
                <i>秒</i>
              </span>
            </label>
          </div>
          <label className='user-form-select mt-[16px]'>
            <span>機器人關鍵字發生衝突時回傳文字</span>
            <textarea className='pending-input pending-textarea' rows={7} placeholder='請輸入文字（必填）' value={conflictText} maxLength={CONFLICT_TEXT_LIMIT} onChange={(event) => setConflictText(event.target.value)} />
            <small className='user-form-hint'>{`${conflictText.length}/${CONFLICT_TEXT_LIMIT}`}</small>
          </label>
        </section>
      </div>
    </div>
  )
}

export default function BotMessagingPage() {
  const [screen, setScreen] = useState({ name: 'list' })

  if (screen.name === 'gallery') return <BotGallery onBack={() => setScreen({ name: 'list' })} onPick={(title) => setScreen({ name: 'editor', title })} />
  if (screen.name === 'editor') return <BotEditor initialName={screen.title} onCancel={() => setScreen({ name: 'gallery' })} />
  return <BotList onAdd={() => setScreen({ name: 'gallery' })} />
}
