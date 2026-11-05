import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useQuery } from '@apollo/client'
import Table from '../src/stories/components/Table'
import TableTop from '../src/components/Table/TableTop'
import Button from '../src/stories/components/Button'
import EmptyState from '../src/stories/components/EmptyState'
import PendingNote from '../src/components/PendingNote'
import { MESSAGE_TEMPLATES } from '../src/graphQL/messageTemplate'
import { parseTemplateMessages, platformLabel } from '../src/utils/messageTemplate'
import { customersFromRooms } from '../src/utils/customers'
import { findChatsRooms, getUserSubscribedChannels, selectChannels, selectChatRooms } from '../src/redux/slices/messagesSlices'

const UNAVAILABLE = '群發功能尚未開放，目前無法儲存或發送'
const NO_ROOMS = []

function BroadcastForm({ onCancel }) {
  const dispatch = useDispatch()
  const channels = useSelector(selectChannels)
  const storedRooms = useSelector(selectChatRooms)
  const rooms = Array.isArray(storedRooms) ? storedRooms : NO_ROOMS
  const { data: templateData } = useQuery(MESSAGE_TEMPLATES)
  const [name, setName] = useState('')
  const [channelId, setChannelId] = useState('')
  const [timing, setTiming] = useState('now')
  const [templateId, setTemplateId] = useState('')
  const [text, setText] = useState('')

  useEffect(() => {
    dispatch(getUserSubscribedChannels())
    dispatch(findChatsRooms())
  }, [dispatch])

  const customers = useMemo(() => customersFromRooms(rooms, channels), [rooms, channels])
  const channel = channels.find(({ account }) => account === channelId)
  const audience = channel ? customers.filter((customer) => customer.channelId === channelId).length : null
  const templates = templateData?.messageTemplates || []

  const importTemplate = (id) => {
    setTemplateId(id)
    const template = templates.find((item) => item.id === id)
    if (template) setText(parseTemplateMessages(template.contents).join('\n'))
  }

  return (
    <div className='pending-form'>
      <section className='pending-card'>
        <div className='user-form-head'>
          <h2 className='user-form-title'>新增群發</h2>
          <div className='flex gap-[8px]'>
            <Button title='取消' color='grayscale' onClick={onCancel} />
            <Button title='儲存' disabled hint={UNAVAILABLE} />
          </div>
        </div>
        <PendingNote>{`${UNAVAILABLE}，此頁僅供預覽。`}</PendingNote>
        <div className='pending-columns'>
          <div className='flex flex-col gap-[16px] flex-1 min-w-0'>
            <label className='user-form-select'>
              <span>訊息名稱</span>
              <input className='pending-input' placeholder='請輸入' value={name} onChange={(event) => setName(event.target.value)} />
              <small className='user-form-hint'>此名稱將顯示給 MasterBox 的共同編輯人員，與互動的用戶不會看到此名稱</small>
            </label>
            <label className='user-form-select'>
              <span>發送頻道</span>
              <select value={channelId} onChange={(event) => setChannelId(event.target.value)}>
                <option value=''>請選擇頻道</option>
                {channels.map(({ account, name: channelName, platform }) => <option key={account} value={account}>{`${platformLabel(platform)} · ${channelName}`}</option>)}
              </select>
            </label>
            <fieldset className='pending-fieldset'>
              <legend>發送時機</legend>
              <div className='flex flex-wrap items-center gap-[12px]'>
                <label><input type='radio' name='timing' checked={timing === 'now'} onChange={() => setTiming('now')} />立即發送</label>
                <label><input type='radio' name='timing' checked={timing === 'later'} onChange={() => setTiming('later')} />排程時間</label>
                <input className='pending-input pending-input-small' type='time' aria-label='排程時間' disabled={timing !== 'later'} />
                <input className='pending-input pending-input-small' type='date' aria-label='排程日期' disabled={timing !== 'later'} />
              </div>
            </fieldset>
            <div className='user-form-select'>
              <span>對象</span>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-[8px]'>
                <select aria-label='選擇群組標籤' disabled title='客戶標籤尚未開放'><option>選擇群組標籤</option></select>
                <select aria-label='查詢標籤' disabled title='客戶標籤尚未開放'><option>客戶標籤尚未開放</option></select>
              </div>
            </div>
          </div>
          <aside className='pending-summary' aria-label='預計發送人數'>
            <h3>預計發送人數</h3>
            <h4>發送渠道</h4>
            <p><span title={channel?.name}>{channel ? channel.name : '尚未選擇頻道'}</span><b>{audience ?? '—'}</b></p>
            <h4>對象</h4>
            <p><span>該頻道有過對話的客戶</span><b>{audience ?? '—'}</b></p>
            <p className='pending-summary-total'><span>總計人數</span><b>{audience ?? '—'}</b></p>
          </aside>
        </div>
      </section>

      <section className='pending-card'>
        <h2 className='user-form-title mb-[16px]'>訊息內容</h2>
        <label className='user-form-select'>
          <span>匯入範本</span>
          <select value={templateId} onChange={(event) => importTemplate(event.target.value)} disabled={!templates.length}>
            <option value=''>{templates.length ? '選擇範本' : '還沒有訊息範本'}</option>
            {templates.map(({ id, name: templateName }) => <option key={id} value={id}>{templateName}</option>)}
          </select>
        </label>
        <label className='user-form-select mt-[16px]'>
          <span>文字內容</span>
          <textarea className='pending-input pending-textarea' rows={8} placeholder='輸入回覆訊息' value={text} onChange={(event) => setText(event.target.value)} />
        </label>
      </section>
    </div>
  )
}

function GroupNotificationsPage() {
  const [isCreating, setIsCreating] = useState(false)
  if (isCreating) return <BroadcastForm onCancel={() => setIsCreating(false)} />

  return (
    <div className='w-full h-full'>
      <Table
        withCheckbox
        withEdit
        colsTemplate='24px minmax(70px,0.5fr) minmax(140px,1fr) minmax(140px,1fr) minmax(120px,1fr) minmax(90px,0.8fr) minmax(90px,0.8fr) 48px'
        header={['狀態', '訊息名稱', '發送頻道', '發送時間', '對象', '建立者']}
        row={[]}
        emptyContent={<EmptyState title='無任何一筆資料' description={`${UNAVAILABLE}。你可以先預覽新增畫面。`} />}
        topElms={<TableTop
          searchPlaceholder='依標題搜尋名稱'
          addTitle='新增群發'
          addOnClick={() => setIsCreating(true)}
          deleteOnClick={() => {}}
          deleteDisabled
          deleteHint='沒有可刪除的群發'
        />}
      />
    </div>
  )
}

export default GroupNotificationsPage
