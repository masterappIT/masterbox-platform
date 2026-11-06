import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import StatusMessage from '../src/components/Messenger/StatusMessage'
import Avatar from '../src/stories/components/Avatar'
import Button from '../src/stories/components/Button'
import Loading from '../src/stories/components/Loading'
import { apolloApiHelpers } from '../src/graphQL'
import { LIST_ACCOUNTS } from '../src/graphQL/account'
import { selectUserInfo } from '../src/redux/slices/userSlices'
import { findChatsRooms, getUserSubscribedChannels, selectChannels, selectChannelsStatus, selectChatRooms, selectChatRoomsStatus } from '../src/redux/slices/messagesSlices'

const RECENT_CONVERSATIONS = 10
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const NO_CHATROOMS = []

const PLATFORMS = {
  fb: { name: 'Facebook', color: '#2B84FF' },
  ig: { name: 'Instagram', color: '#E1306C' },
  whatsapp: { name: 'WhatsApp', color: '#93C976' },
  line: { name: 'LINE', color: '#06C755' },
  wechat: { name: 'WeChat', color: '#2DC100' },
}

const getCustomer = ({ channel_id, users }) => (users || []).find((user) => user.id !== channel_id)
const getCustomerName = (room) => {
  const customer = getCustomer(room)
  return `${customer?.first_name || ''}${customer?.last_name || ''}`.trim()
}
const countCustomers = (rooms) => new Set(rooms.map((room) => getCustomer(room)?.id).filter(Boolean)).size
const isRecent = ({ updatedAt }) => Date.now() - new Date(updatedAt).getTime() < RECENT_WINDOW_MS

const UNITS = [['day', 86400], ['hour', 3600], ['minute', 60]]
const formatRelativeTime = (value, language) => {
  const time = new Date(value).getTime()
  if (!value || Number.isNaN(time)) return ''
  const seconds = Math.round((time - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  const [unit, size] = UNITS.find(([, length]) => Math.abs(seconds) >= length) || ['minute', 60]
  return formatter.format(Math.trunc(seconds / size), unit)
}

function HomeTabs({ label, tabs, active, onChange }) {
  return (
    <div className='home-tabs' role='tablist' aria-label={label}>
      {tabs.map(({ key, title, icon, disabled, hint }) => (
        <button key={key} type='button' role='tab' aria-selected={active === key} disabled={disabled} title={hint} className={`home-tab ${active === key ? 'home-tab-active' : ''}`} onClick={() => onChange(key)}>
          <img src={`/design/ui/${icon}.svg`} alt='' width={20} height={20} />{title}
        </button>
      ))}
    </div>
  )
}

function ChannelColumn({ title, color, icon, rooms, channelCount, t }) {
  const metrics = [
    [t('home_stat_channels'), channelCount],
    [t('home_stat_customers'), countCustomers(rooms)],
    [t('home_stat_conversations'), rooms.length],
    [t('home_active_7d'), rooms.filter(isRecent).length],
  ]
  return (
    <article className='home-channel'>
      <header>
        <div><h3 style={{ color }}>{title}</h3><p>{t('home_all_time')}</p></div>
        <img src={icon} alt='' width={32} height={32} />
      </header>
      <dl>
        {metrics.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value.toLocaleString()}</dd></div>)}
      </dl>
    </article>
  )
}

function MemberList({ t }) {
  const companyId = useSelector(selectUserInfo)?.company_id
  const [state, setState] = useState({ status: 'loading', members: [] })

  useEffect(() => {
    if (!companyId) return undefined
    let active = true
    apolloApiHelpers('query', LIST_ACCOUNTS, { input: { company_id: companyId } }, { fetchPolicy: 'no-cache' }).then((result) => {
      if (active) setState(result?.error ? { status: 'failed', members: [] } : { status: 'ready', members: result?.items || [] })
    })
    return () => { active = false }
  }, [companyId])

  if (state.status === 'loading') return <div className='home-empty'><Loading /></div>
  if (state.status === 'failed') return <div className='home-empty'><StatusMessage title={t('home_members_failed')} /></div>
  if (!state.members.length) return <div className='home-empty'><StatusMessage title={t('home_members_empty')} /></div>

  return (
    <div className='home-member-scroll'>
      <table className='home-members'>
        <thead><tr><th>{t('home_col_avatar')}</th><th>{t('home_col_name')}</th><th>{t('home_col_role')}</th><th>{t('home_col_email')}</th><th>{t('home_col_status')}</th></tr></thead>
        <tbody>
          {state.members.map(({ _id, email, role, enabled, info }) => {
            const name = info?.name || email
            const on = enabled !== false
            return (
              <tr key={_id}>
                <td><Avatar name={info?.avatar || name} size='normal' /></td>
                <td title={name}>{name}</td>
                <td>{t(`home_role_${role}`, { defaultValue: role })}</td>
                <td title={email}>{email}</td>
                <td><span className={`home-status ${on ? 'home-status-on' : ''}`}><i aria-hidden='true' />{t(on ? 'home_member_enabled' : 'home_member_disabled')}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
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
  const [listTab, setListTab] = useState('channels')

  const refresh = () => {
    setRequested(true)
    dispatch(getUserSubscribedChannels())
    dispatch(findChatsRooms())
  }

  useEffect(() => {
    refresh()
  }, [])

  // chatRooms only returns the account's channels, newest first, and new messages move theirs to the top.
  const conversations = Array.isArray(chatrooms) ? chatrooms : []
  const platforms = useMemo(() => [...new Set(channels.map(({ platform }) => platform))], [channels])

  const isPending = (status) => !requested || status === 'loading' || status === 'idle'
  const retry = { title: t('retry'), onClick: refresh }
  const failedMessage = { title: t('home_load_failed'), description: t('home_load_failed_hint'), action: retry }

  if (channels.length === 0) {
    return (
      <main className='home'>
        <section className='home-card home-empty'>
          {isPending(channelsStatus)
            ? <Loading />
            : <StatusMessage {...(channelsStatus === 'failed' ? failedMessage : { title: t('no_channel_connected'), description: t('connect_channel_hint'), action: { title: t('go_to_channels_management'), onClick: () => router.push('/channels-management') } })} />}
        </section>
      </main>
    )
  }

  const conversationsPending = isPending(chatRoomsStatus) && !conversations.length
  const stats = [
    { key: 'channels', tile: '#2B84FF', icon: '/design/ui/tab-channels.svg', title: t('home_stat_channels'), value: channels.length, sub: t('home_stat_channels_sub', { count: channels.filter(({ enabled }) => enabled).length }) },
    { key: 'customers', icon: '/design/ui/stat-interaction.svg', title: t('home_stat_customers'), value: countCustomers(conversations), sub: t('home_stat_customers_sub') },
    { key: 'conversations', icon: '/design/ui/stat-active.svg', title: t('home_stat_conversations'), value: conversations.length, sub: t('home_stat_conversations_sub', { count: conversations.filter(isRecent).length }) },
  ]

  return (
    <main className='home'>
      <div className='home-main'>
        <section className='home-stats' aria-label={t('home')}>
          {stats.map(({ key, tile, icon, title, value, sub }) => (
            <article key={key} className='home-stat'>
              {tile
                ? <span className='home-stat-tile' style={{ background: tile }}><img src={icon} alt='' width={24} height={24} /></span>
                : <img src={icon} alt='' width={40} height={40} />}
              <h2>{title}</h2>
              <strong>{conversationsPending && key !== 'channels' ? '—' : value.toLocaleString()}</strong>
              <p>{sub}</p>
            </article>
          ))}
        </section>

        <section className='home-card'>
          <HomeTabs
            label={t('home_tab_channels')}
            active={listTab}
            onChange={setListTab}
            tabs={[
              { key: 'channels', title: t('home_tab_channels'), icon: 'tab-channels' },
              { key: 'members', title: t('home_tab_members'), icon: 'tab-members' },
              { key: 'bots', title: t('home_tab_bots'), icon: 'tab-bot' },
            ]}
          />
          {listTab === 'channels' && (
            <div className='home-channels'>
              <ChannelColumn t={t} title={t('home_from_all')} color='#FFAB37' icon='/design/ui/platform-masterbox.svg' rooms={conversations} channelCount={channels.length} />
              {platforms.map((platform) => (
                <ChannelColumn
                  key={platform}
                  t={t}
                  title={t('home_from_platform', { name: PLATFORMS[platform]?.name || platform })}
                  color={PLATFORMS[platform]?.color}
                  icon={`/svg/${platform}.svg`}
                  rooms={conversations.filter((room) => room.platform === platform)}
                  channelCount={channels.filter((channel) => channel.platform === platform).length}
                />
              ))}
            </div>
          )}
          {listTab === 'members' && <MemberList t={t} />}
          {listTab === 'bots' && <div className='home-empty'><StatusMessage title={t('home_bots_empty')} description={t('home_bots_hint')} /></div>}
        </section>
      </div>

      <section className='home-card home-conversations'>
        <HomeTabs
          label={t('home_tab_active')}
          active='active'
          onChange={() => {}}
          tabs={[
            { key: 'active', title: t('home_tab_active'), icon: 'tab-chat' },
            { key: 'unassigned', title: t('home_tab_unassigned'), icon: 'tab-assign', disabled: true, hint: t('home_unassigned_hint') },
          ]}
        />
        {conversationsPending
          ? <div className='home-empty'><Loading /></div>
          : conversations.length === 0
            ? <div className='home-empty'><StatusMessage {...(chatRoomsStatus === 'failed' ? failedMessage : { title: t('no_conversations_yet'), description: t('no_conversations_hint') })} /></div>
            : (
              <ul className='home-conversation-list'>
                {conversations.slice(0, RECENT_CONVERSATIONS).map((room) => {
                  const name = getCustomerName(room) || t('home_unnamed_customer')
                  const channel = channels.find(({ account }) => account === room.channel_id)
                  return (
                    <li key={room.chat_room_id} className='home-conversation'>
                      <Avatar img={getCustomer(room)?.avatar} name={name} size='normal' />
                      <div className='home-conversation-text'>
                        <strong title={name}>{name}</strong>
                        <span title={channel?.name}><img src={`/svg/${room.platform}.svg`} alt='' width={16} height={16} />{channel?.name}</span>
                        <time dateTime={room.updatedAt}>{formatRelativeTime(room.updatedAt, i18n.language)}</time>
                      </div>
                      <Button title={t('home_view')} customStyles='home-view' onClick={() => router.push(`/?room=${encodeURIComponent(room.chat_room_id)}`)} />
                    </li>
                  )
                })}
              </ul>
            )}
      </section>
    </main>
  )
}
