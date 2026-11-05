import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import StatusMessage from '../src/components/Messenger/StatusMessage'
import { findChatsRooms, getUserSubscribedChannels, selectChannels, selectChannelsStatus, selectChatRooms, selectChatRoomsStatus } from '../src/redux/slices/messagesSlices'

const RECENT_CONVERSATIONS = 5
const NO_CHATROOMS = []

const PLATFORM_ICONS = {
  fb: '/svg/fb.svg',
  facebook: '/svg/fb.svg',
  ig: '/svg/ig.svg',
  instagram: '/svg/ig.svg',
  whatsapp: '/svg/whatsapp.svg',
  line: '/svg/line.svg',
  wechat: '/svg/wechat.svg',
}

const getCustomerName = ({ channel_id, users }) => {
  const customer = (users || []).find((user) => user.id !== channel_id)
  return `${customer?.first_name || ''}${customer?.last_name || ''}`.trim()
}

const formatTime = (value, language) => {
  const date = new Date(value)
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleString(language) : ''
}

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const dispatch = useDispatch()
  const channels = useSelector(selectChannels)
  const storedChatrooms = useSelector(selectChatRooms)
  const chatrooms = Array.isArray(storedChatrooms) ? storedChatrooms : NO_CHATROOMS
  const channelsStatus = useSelector(selectChannelsStatus)
  const chatRoomsStatus = useSelector(selectChatRoomsStatus)
  // Persisted statuses describe an earlier visit, so only trust them once this visit has asked.
  const [requested, setRequested] = useState(false)

  const refresh = () => {
    setRequested(true)
    dispatch(getUserSubscribedChannels())
    dispatch(findChatsRooms())
  }

  useEffect(() => {
    refresh()
  }, [])

  // chatRooms returns the whole company, so keep to the channels this account can use.
  const conversations = useMemo(() => chatrooms.filter(({ channel_id }) => channels.some(({ account }) => account === channel_id)), [chatrooms, channels])

  const isPending = (status) => !requested || status === 'loading' || status === 'idle'
  const retry = { title: t('retry'), onClick: refresh }
  const loadingMessage = { title: t('home_loading') }
  const failedMessage = { title: t('home_load_failed'), description: t('home_load_failed_hint'), action: retry }

  const channelsMessage = isPending(channelsStatus) ? loadingMessage
    : channelsStatus === 'failed' ? failedMessage
    : { title: t('no_channel_connected'), description: t('connect_channel_hint'), action: { title: t('go_to_channels_management'), onClick: () => router.push('/channels-management') } }

  const conversationsMessage = isPending(chatRoomsStatus) ? loadingMessage
    : chatRoomsStatus === 'failed' ? failedMessage
    : { title: t('no_conversations_yet'), description: t('no_conversations_hint') }

  return <main className='dashboard-page'>
    <div className='dashboard-heading'><div><h1>{t('home')}</h1><p>{t('home_subtitle')}</p></div><button className='dashboard-refresh' onClick={refresh}>↻ {t('home_refresh')}</button></div>
    {channels.length === 0
      ? <section className='dashboard-card'><StatusMessage {...channelsMessage} /></section>
      : <>
        <section className='dashboard-stats dashboard-stats-pair'>
          <article><span className='stat-icon stat-green'>◒</span><div><small>{t('home_connected_channels')}</small><strong>{channels.length}</strong></div></article>
          <article><span className='stat-icon stat-orange'>◉</span><div><small>{t('home_conversations')}</small><strong>{conversations.length}</strong></div></article>
        </section>
        <section className='dashboard-card messages-card'>
          <div className='card-header'><div><h2>{t('home_recent_conversations')}</h2><p>{t('home_recent_conversations_hint')}</p></div><button onClick={() => router.push('/')}>{t('home_view_all')}</button></div>
          {conversations.length === 0
            ? <StatusMessage {...conversationsMessage} />
            : conversations.slice(0, RECENT_CONVERSATIONS).map((room) => {
              const name = getCustomerName(room) || t('home_unnamed_customer')
              return <div className='message-row' key={room.chat_room_id}><span className='message-avatar'>{name[0]}</span><div><strong>{name}</strong><p>{channels.find(({ account }) => account === room.channel_id)?.name}</p></div><time>{formatTime(room.updatedAt, i18n.language)}</time></div>
            })}
        </section>
        <section className='dashboard-card platform-card'>
          <div className='card-header'><div><h2>{t('home_channels_overview')}</h2><p>{t('home_channels_overview_hint')}</p></div></div>
          <div className='platform-grid'>{channels.map(({ account, name, platform }) => {
            const icon = PLATFORM_ICONS[String(platform).toLowerCase()]
            return <div className='platform-item' key={account}><div>{icon && <img src={icon} alt='' style={{ padding: 0 }} />}<strong>{name}</strong></div><b>{conversations.filter(({ channel_id }) => channel_id === account).length}</b><em>{t('home_conversations')}</em></div>
          })}</div>
        </section>
      </>}
  </main>
}
