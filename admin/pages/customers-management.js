import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useDispatch, useSelector } from 'react-redux'
import Table from '../src/stories/components/Table'
import TableTop from '../src/components/Table/TableTop'
import Avatar from '../src/stories/components/Avatar'
import Button from '../src/stories/components/Button'
import Pagination from '../src/stories/components/Pagination'
import usePagination from '../src/utils/usePagination'
import { customersFromRooms } from '../src/utils/customers'
import { platformLabel, TEMPLATE_PLATFORMS } from '../src/utils/messageTemplate'
import { findChatsRooms, getUserSubscribedChannels, selectChannels, selectChannelsStatus, selectChatRooms, selectChatRoomsStatus } from '../src/redux/slices/messagesSlices'

const NO_ROOMS = []

const formatDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-TW', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function CustomersManagementPage() {
  const router = useRouter()
  const dispatch = useDispatch()
  const channels = useSelector(selectChannels)
  const storedRooms = useSelector(selectChatRooms)
  const rooms = Array.isArray(storedRooms) ? storedRooms : NO_ROOMS
  const channelsStatus = useSelector(selectChannelsStatus)
  const roomsStatus = useSelector(selectChatRoomsStatus)
  const [requested, setRequested] = useState(false)
  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState('')
  const [channelId, setChannelId] = useState('')

  useEffect(() => {
    setRequested(true)
    dispatch(getUserSubscribedChannels())
    dispatch(findChatsRooms())
  }, [dispatch])

  const customers = useMemo(() => customersFromRooms(rooms, channels), [rooms, channels])
  const platformOptions = TEMPLATE_PLATFORMS.filter(({ value }) => channels.some((channel) => channel.platform === value))
  const channelOptions = channels.filter((channel) => !platform || channel.platform === platform)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return customers.filter((customer) => (!platform || customer.platform === platform)
      && (!channelId || customer.channelId === channelId)
      && (!query || [customer.name, customer.id].some((value) => String(value || '').toLowerCase().includes(query))))
  }, [customers, platform, channelId, search])
  const { page, pageCount, pageItems, setPage } = usePagination(filtered)

  const rows = pageItems.map((customer) => {
    const name = customer.name || '未命名客戶'
    return [
      { key: 'avatar', element: 'custom', value: <Avatar img={customer.avatar} name={name} size='small' /> },
      { key: 'name', element: 'text', value: name },
      { key: 'id', element: 'text', value: customer.id },
      { key: 'platform', element: 'custom', value: <span className='flex items-center gap-[8px] min-w-0 px-[8px]'><img src={`/svg/${customer.platform}.svg`} alt='' width={16} height={16} /><span className='truncate' title={customer.channelName}>{platformLabel(customer.platform)} · {customer.channelName}</span></span> },
      { key: 'last', element: 'text', value: formatDate(customer.lastInteraction) },
      { key: 'view', element: 'custom', value: <Button title='查看對話' customStyles='home-view' onClick={() => router.push(`/?room=${encodeURIComponent(customer.roomId)}`)} /> },
    ]
  })

  const isPending = (status) => !requested || status === 'loading' || status === 'idle'
  const loading = !customers.length && (isPending(channelsStatus) || isPending(roomsStatus))
  const failed = channelsStatus === 'failed' || roomsStatus === 'failed'
  let emptyText = '目前還沒有客戶。客戶傳訊息進來後，就會出現在這裡。'
  if (failed) emptyText = '目前無法讀取客戶，請稍後再試'
  else if (!channels.length) emptyText = '還沒有可用的社群平台，連接後客戶才會出現在這裡'
  else if (customers.length) emptyText = '找不到符合條件的客戶'

  return (
    <div className='w-full h-full'>
      <Table
        colsTemplate='40px minmax(140px,1fr) minmax(160px,1fr) minmax(200px,1.4fr) minmax(150px,0.8fr) 104px'
        header={['照片', '名稱', '帳號ID', '社群平台', '最後互動時間', '']}
        row={rows}
        rowIds={pageItems.map((customer) => customer.key)}
        loading={loading}
        emptyText={emptyText}
        topElms={<TableTop searchPlaceholder='依名稱或帳號ID搜尋' searchOnChange={(value) => { setSearch(value); setPage(1) }}>
          <div className='flex flex-wrap gap-x-[24px] gap-y-[12px]'>
            <label className='channel-filter'>
              <span>選擇平台</span>
              <select value={platform} onChange={(event) => { setPlatform(event.target.value); setChannelId(''); setPage(1) }}>
                <option value=''>所有平台</option>
                {platformOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className='channel-filter'>
              <span>選擇頻道</span>
              <select value={channelId} onChange={(event) => { setChannelId(event.target.value); setPage(1) }}>
                <option value=''>所有頻道</option>
                {channelOptions.map(({ account, name }) => <option key={account} value={account}>{name}</option>)}
              </select>
            </label>
          </div>
        </TableTop>}
        footer={<Pagination page={page} pageCount={pageCount} onChange={setPage} />}
      />
    </div>
  )
}

export default CustomersManagementPage
