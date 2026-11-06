import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux'
import { getUserSubscribedChannels, saveChannels, selectChannels } from '../src/redux/slices/messagesSlices'
import { apolloApiHelpers } from '../src/graphQL'
import { CREATE_META_CONNECT_URL, SET_CHANNEL_ENABLED } from '../src/graphQL/channel'
import Table from '../src/stories/components/Table'
import TableTop from '../src/components/Table/TableTop'
import Pagination from '../src/stories/components/Pagination'
import AlertStack from '../src/stories/components/AlertStack'
import PopupChannel from '../src/components/channels-management/PopupChannel'
import WhatsappWebConnect from '../src/components/channels-management/WhatsappWebConnect'
import useAlerts from '../src/utils/useAlerts'
import usePagination from '../src/utils/usePagination'

const PLATFORMS = [
  { value: 'all', name: '所有平台' },
  { value: 'fb', name: 'Facebook' },
  { value: 'ig', name: 'Instagram' },
  { value: 'whatsapp', name: 'WhatsApp' },
  { value: 'line', name: 'LINE' },
  { value: 'wechat', name: 'WeChat' },
]
const platformName = (value) => PLATFORMS.find((platform) => platform.value === value)?.name || value

// How a WhatsApp number connected by QR code is doing, in the list's words. reconnect: it needs a new scan.
const connectionStatus = (web) => {
  switch (web?.state) {
    case 'ready': return { tone: 'ok', text: '已連線' }
    case 'syncing': {
      const { chats_total: total, chats_done: done } = web.progress || {}
      return { tone: 'busy', text: `同步聊天記錄中${total ? ` ${Math.round((done / total) * 100)}%` : ''}` }
    }
    case 'disconnected': return { tone: 'busy', text: '連線中斷，正在重新連線' }
    case 'qr':
    case 'starting':
    case 'authenticated': return { tone: 'busy', text: '等待掃碼' }
    case 'logged_out': return { tone: 'error', text: web.error || '已斷線，請重新掃碼', reconnect: true }
    case 'rejected': return { tone: 'error', text: web.error || '掃描的號碼不符', reconnect: true }
    default: return { tone: 'error', text: web?.error || '需重新掃碼', reconnect: true }
  }
}

function ConnectionCell({ channel, onReconnect }) {
  const status = connectionStatus(channel.whatsapp_web)
  return (
    <span className={`channel-connection channel-connection-${status.tone}`} title={status.text}>
      <span className='channel-connection-dot' aria-hidden='true' />
      <span className='truncate'>{status.text}</span>
      {status.reconnect && <button type='button' className='channel-connection-action' onClick={onReconnect}>重新掃碼</button>}
    </span>
  )
}

function ChannelsManagementPage() {
  const router = useRouter()
  const dispatch = useDispatch()
  const allChannels = useSelector(selectChannels)
  const channelsStatus = useSelector((state) => state.messages?.channelsStatus)
  const { alerts, pushAlert, dismissAlert } = useAlerts()
  const [platform, setPlatform] = useState('all')
  const [search, setSearch] = useState('')
  const [isPicking, setIsPicking] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [pendingIds, setPendingIds] = useState([])
  // false: closed; null: connecting a new number; a channel: scanning again for it.
  const [scanning, setScanning] = useState(false)

  useEffect(() => { dispatch(getUserSubscribedChannels()) }, [dispatch])

  // While a number is syncing or reconnecting, its status is read again every few seconds.
  const changing = allChannels.some((channel) => ['syncing', 'disconnected'].includes(channel.whatsapp_web?.state))
  useEffect(() => {
    if (!changing || scanning !== false) return undefined
    const timer = setInterval(() => dispatch(getUserSubscribedChannels()), 8000)
    return () => clearInterval(timer)
  }, [changing, scanning, dispatch])

  // The backend sends the browser back here with the outcome of a Meta connection.
  useEffect(() => {
    const { searchParams } = new URL(window.location.href)
    const connected = searchParams.get('meta_connected')
    const error = searchParams.get('meta_error')
    if (connected === null && !error) return
    const skipped = searchParams.get('meta_skipped')
    const failed = searchParams.get('meta_failed')
    const problems = [error, skipped && `已連接其他公司，未串接：${skipped}`, failed && `串接失敗：${failed}`].filter(Boolean)
    if (problems.length) pushAlert('error', problems.join('；'))
    if (connected !== null) pushAlert(Number(connected) > 0 ? 'success' : 'error', Number(connected) > 0 ? `已串接 ${connected} 個頻道` : '沒有新串接的頻道')
    router.replace('/channels-management')
  }, [router, pushAlert])

  const channels = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allChannels.filter((channel) => (platform === 'all' || channel.platform === platform) && (!query || String(channel.name || '').toLowerCase().includes(query)))
  }, [allChannels, platform, search])
  const { page, pageCount, pageItems, setPage } = usePagination(channels)

  const handleToggle = async (index, enabled) => {
    const channel = pageItems[index]
    if (!channel) return
    setPendingIds((ids) => [...ids, channel.channel_id])
    const res = await apolloApiHelpers('mutation', SET_CHANNEL_ENABLED, { channelId: channel.channel_id, enabled })
    setPendingIds((ids) => ids.filter((id) => id !== channel.channel_id))
    if (res.error) return pushAlert('error', `無法${enabled ? '啟用' : '停用'}「${channel.name}」：${res.error}`)
    dispatch(saveChannels(allChannels.map((item) => (item.channel_id === channel.channel_id ? { ...item, enabled: res.enabled } : item))))
    pushAlert('success', `已${res.enabled ? '啟用' : '停用'}「${channel.name}」`)
  }

  const handleConnect = async () => {
    if (isConnecting) return
    setIsConnecting(true)
    const res = await apolloApiHelpers('mutation', CREATE_META_CONNECT_URL, { returnUrl: `${window.location.origin}/channels-management` })
    if (res.error) {
      setIsConnecting(false)
      setIsPicking(false)
      return pushAlert('error', `無法開始串接：${res.error}`)
    }
    window.location.assign(res)
  }

  const closeScan = (changed) => {
    setScanning(false)
    if (changed) dispatch(getUserSubscribedChannels())
  }
  const finishScan = (name) => {
    setScanning(false)
    dispatch(getUserSubscribedChannels())
    pushAlert('success', name ? `已連結「${name}」` : '已重新連結')
  }

  const rows = pageItems.map((channel) => [
    { key: 'enabled', element: 'toggle', value: channel.enabled ? 1 : 0, label: `啟用「${channel.name}」` },
    { key: 'name', element: 'text', value: channel.name },
    { key: 'account', element: 'custom', value: <span className='flex items-center gap-[8px] min-w-0 px-[8px]'><img src={`/svg/${channel.platform}.svg`} alt='' width={16} height={16} /><span className='truncate' title={channel.channel_id}>{platformName(channel.platform)} · {channel.whatsapp_web?.phone || channel.channel_id}</span></span> },
    { key: 'connection', element: 'custom', value: channel.whatsapp_web ? <ConnectionCell channel={channel} onReconnect={() => setScanning(channel)} /> : <span className='channel-connection'>—</span> },
  ])

  const isLoading = channelsStatus === 'loading' && !allChannels.length
  const loadFailed = channelsStatus === 'failed'
  return (
    <div className='w-full h-full'>
      <Table
        colsTemplate='minmax(64px,0.3fr) minmax(200px,1.2fr) minmax(240px,1.4fr) minmax(220px,1.2fr)'
        header={['狀態', '社群名稱', '連結社群', '連線狀態']}
        row={rows}
        rowIds={pageItems.map((channel) => channel.channel_id)}
        loading={isLoading}
        emptyText={loadFailed ? '目前無法讀取社群，請稍後再試' : allChannels.length ? '這個平台目前沒有社群' : '尚未連結任何社群，趕快新增一個吧'}
        onToggle={handleToggle}
        pendingToggles={pageItems.map((channel, index) => (pendingIds.includes(channel.channel_id) ? index : null)).filter((index) => index !== null)}
        topElms={<TableTop
          searchPlaceholder='依社群名稱搜尋'
          searchOnChange={(value) => { setSearch(value); setPage(1) }}
          addTitle='新增社群'
          addOnClick={() => setIsPicking(true)}
        >
          <label className='channel-filter'>
            <span>選擇平台</span>
            <select value={platform} onChange={(event) => { setPlatform(event.target.value); setPage(1) }}>
              {PLATFORMS.map(({ value, name }) => <option key={value} value={value}>{name}</option>)}
            </select>
          </label>
        </TableTop>}
        footer={<Pagination page={page} pageCount={pageCount} onChange={setPage} />}
      />
      <PopupChannel isShow={isPicking} onClick={() => { if (!isConnecting) setIsPicking(false) }} onConnectMeta={handleConnect} onConnectWhatsapp={() => { setIsPicking(false); setScanning(null) }} connecting={isConnecting} />
      <WhatsappWebConnect isShow={scanning !== false} channel={scanning || null} onClose={closeScan} onDone={finishScan} pushAlert={pushAlert} />
      <AlertStack alerts={alerts} onDismiss={dismissAlert} />
    </div>
  )
}

export default ChannelsManagementPage
