import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux'
import { getUserSubscribedChannels, saveChannels, selectChannels } from '../src/redux/slices/messagesSlices'
import { apolloApiHelpers } from '../src/graphQL'
import { CREATE_META_CONNECT_URL, SET_CHANNEL_ENABLED, DELETE_CHANNEL, CHECK_CHANNEL_CONNECTION } from '../src/graphQL/channel'
import Table from '../src/stories/components/Table'
import TableTop from '../src/components/Table/TableTop'
import Pagination from '../src/stories/components/Pagination'
import AlertStack from '../src/stories/components/AlertStack'
import ConfirmDialog from '../src/stories/components/ConfirmDialog'
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
const webStatus = (web) => {
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

const CHECKABLE = ['fb', 'ig', 'whatsapp']

// How a channel connected through Meta is doing, as the backend last checked it: a short label, with the backend's
// explanation on hover. reconnect: Meta must be connected again.
const metaStatus = (connection) => {
  const detail = connection?.message || ''
  switch (connection?.state) {
    case 'ok': return { tone: detail ? 'warn' : 'ok', text: '已連線', detail }
    case 'auth_expired': return { tone: 'error', text: '授權已失效', detail, reconnect: true }
    case 'not_subscribed': return { tone: 'error', text: '未收到訊息通知', detail, reconnect: true }
    case 'error': return { tone: 'error', text: '連線異常', detail }
    case 'unknown': return { tone: 'off', text: '尚未檢查', detail }
    // Not read yet, such as while the list is loading.
    default: return { tone: 'off', text: '—' }
  }
}

const checkedAt = (value) => (value ? `上次檢查：${new Date(value).toLocaleString('zh-TW', { hour12: false })}` : '')

const channelStatus = (channel) => {
  if (!channel.enabled) return { tone: 'off', text: '已停用' }
  if (channel.whatsapp_web) return { ...webStatus(channel.whatsapp_web), rescan: webStatus(channel.whatsapp_web).reconnect, reconnect: false }
  if (!CHECKABLE.includes(channel.platform)) return { tone: 'off', text: '無法檢查' }
  return { ...metaStatus(channel.connection), recheck: true }
}

function ConnectionCell({ channel, checking, onRescan, onReconnect, onRecheck }) {
  const status = channelStatus(channel)
  const title = [status.detail || status.text, checkedAt(channel.connection?.checked_at)].filter(Boolean).join('\n')
  return (
    <span className={`channel-connection channel-connection-${status.tone}`} title={title}>
      <span className='channel-connection-dot' aria-hidden='true' />
      <span className='truncate'>{checking ? '檢查中…' : status.text}</span>
      {status.detail && !checking && <span className='sr-only'>：{status.detail}</span>}
      {status.rescan && <button type='button' className='channel-connection-action' onClick={onRescan}>重新掃碼</button>}
      {status.reconnect && !checking && <button type='button' className='channel-connection-action' onClick={onReconnect}>重新串接</button>}
      {status.recheck && <button type='button' className='channel-connection-action' disabled={checking} onClick={onRecheck}>重新檢查</button>}
    </span>
  )
}

// What removing a channel does, for the confirmation.
const deleteDescription = (channel) => [
  '刪除後會停止收發這個社群的訊息，並從社群列表和對話列表中移除。',
  channel.whatsapp_web ? '這支 WhatsApp 號碼也會從手機的「已連結的裝置」登出。' : '',
  channel.whatsapp_web ? '之後重新掃碼連結同一支號碼，可以找回原本的對話。' : '之後重新串接同一個帳號，可以找回原本的對話。',
].filter(Boolean).join('')

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
  const [deleting, setDeleting] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [checkingIds, setCheckingIds] = useState([])

  const loadChannels = useCallback(() => dispatch(getUserSubscribedChannels({ withConnection: true })), [dispatch])
  useEffect(() => { loadChannels() }, [loadChannels])

  // While a number is syncing or reconnecting, its status is read again every few seconds.
  const changing = allChannels.some((channel) => ['syncing', 'disconnected'].includes(channel.whatsapp_web?.state))
  useEffect(() => {
    if (!changing || scanning !== false) return undefined
    const timer = setInterval(loadChannels, 8000)
    return () => clearInterval(timer)
  }, [changing, scanning, loadChannels])

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
    // A channel switched back on shows its connection again.
    if (res.enabled) loadChannels()
  }

  const handleDelete = async () => {
    if (!deleting || isDeleting) return
    setIsDeleting(true)
    const res = await apolloApiHelpers('mutation', DELETE_CHANNEL, { channelId: deleting.channel_id })
    setIsDeleting(false)
    if (res?.error) return pushAlert('error', `無法刪除「${deleting.name}」：${res.error}`)
    dispatch(saveChannels(allChannels.filter((item) => item.channel_id !== deleting.channel_id)))
    pushAlert('success', `已刪除「${deleting.name}」`)
    setDeleting(null)
  }

  const handleRecheck = async (channel) => {
    setCheckingIds((ids) => [...ids, channel.channel_id])
    const res = await apolloApiHelpers('mutation', CHECK_CHANNEL_CONNECTION, { channelId: channel.channel_id })
    setCheckingIds((ids) => ids.filter((id) => id !== channel.channel_id))
    if (res.error) return pushAlert('error', `無法檢查「${channel.name}」：${res.error}`)
    dispatch(saveChannels(allChannels.map((item) => (item.channel_id === channel.channel_id ? { ...item, phone: res.phone || item.phone, connection: res.connection } : item))))
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
    if (changed) loadChannels()
  }
  const finishScan = (name) => {
    setScanning(false)
    loadChannels()
    pushAlert('success', name ? `已連結「${name}」` : '已重新連結')
  }

  const rows = pageItems.map((channel) => [
    { key: 'enabled', element: 'toggle', value: channel.enabled ? 1 : 0, label: `啟用「${channel.name}」` },
    { key: 'name', element: 'text', value: channel.name },
    { key: 'account', element: 'custom', value: <span className='flex items-center gap-[8px] min-w-0 px-[8px]'><img src={`/svg/${channel.platform}.svg`} alt='' width={16} height={16} /><span className='truncate' title={channel.channel_id}>{platformName(channel.platform)} · {channel.phone || channel.whatsapp_web?.phone || channel.channel_id}</span></span> },
    { key: 'connection', element: 'custom', value: <ConnectionCell channel={channel} checking={checkingIds.includes(channel.channel_id)} onRescan={() => setScanning(channel)} onReconnect={handleConnect} onRecheck={() => handleRecheck(channel)} /> },
    { key: 'actions', element: 'custom', value: <span className='channel-actions'><button type='button' className='channel-delete' onClick={() => setDeleting(channel)} aria-label={`刪除「${channel.name}」`}>刪除</button></span> },
  ])

  const isLoading = channelsStatus === 'loading' && !allChannels.length
  const loadFailed = channelsStatus === 'failed'
  return (
    <div className='w-full h-full'>
      <Table
        colsTemplate='minmax(64px,0.3fr) minmax(180px,1.1fr) minmax(240px,1.4fr) minmax(260px,1.4fr) minmax(72px,0.35fr)'
        header={['狀態', '社群名稱', '連結社群', '連線狀態', '操作']}
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
      <ConfirmDialog
        isShow={Boolean(deleting)}
        title={deleting ? `確定要刪除「${deleting.name}」嗎？` : ''}
        description={deleting ? deleteDescription(deleting) : ''}
        busy={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
      <AlertStack alerts={alerts} onDismiss={dismissAlert} />
    </div>
  )
}

export default ChannelsManagementPage
