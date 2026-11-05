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

  useEffect(() => { dispatch(getUserSubscribedChannels()) }, [dispatch])

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

  const rows = pageItems.map((channel) => [
    { key: 'enabled', element: 'toggle', value: channel.enabled ? 1 : 0, label: `啟用「${channel.name}」` },
    { key: 'name', element: 'text', value: channel.name },
    { key: 'account', element: 'custom', value: <span className='flex items-center gap-[8px] min-w-0 px-[8px]'><img src={`/svg/${channel.platform}.svg`} alt='' width={16} height={16} /><span className='truncate' title={channel.channel_id}>{platformName(channel.platform)} · {channel.channel_id}</span></span> },
  ])

  const isLoading = channelsStatus === 'loading' && !allChannels.length
  const loadFailed = channelsStatus === 'failed'
  return (
    <div className='w-full h-full'>
      <Table
        colsTemplate='minmax(64px,0.3fr) minmax(200px,1.4fr) minmax(240px,1.6fr)'
        header={['狀態', '社群名稱', '連結社群']}
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
      <PopupChannel isShow={isPicking} onClick={() => { if (!isConnecting) setIsPicking(false) }} onConnectMeta={handleConnect} connecting={isConnecting} />
      <AlertStack alerts={alerts} onDismiss={dismissAlert} />
    </div>
  )
}

export default ChannelsManagementPage
