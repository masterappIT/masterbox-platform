import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import ChatAvatar from './ChatAvatar'
import ChatEmptyState from './ChatEmptyState'
import Composer from './Composer'
import MessageBubble from './MessageBubble'
import SourceBadge from './SourceBadge'
import SystemMessage from './SystemMessage'
import { can, channelSubtitle } from './capabilities'
import { dayKey, dayLabel, timeLabel } from '../../utils/messageTime'
import { formatMoment, STANDARD_WINDOW_MS, windowEndIndex } from '../../utils/replyWindow'
import { customerOfRoom } from '../Messenger/ChatroomList'

// Within this distance of the end still counts as being at the latest message.
const AT_BOTTOM_THRESHOLD_PX = 48
// Within this distance of the top, earlier messages start loading.
const LOAD_OLDER_THRESHOLD_PX = 120

// The conversation's title bar (Figma Admin/對話標頭): the customer, where the conversation comes from, its agent,
// and the button that opens the customer panel.
function ChatHeader({ room, channel, onTogglePanel, isPanelOpen }) {
  const { t } = useTranslation()
  const customer = customerOfRoom(room)
  const name = customer.name && customer.name !== 'null' ? customer.name : t('no_name')
  const where = channel ? (channel.phone || channel.name) : room.channel_name
  return (
    <div className='flex h-[72px] shrink-0 items-center gap-[12px] border-b border-border-default bg-surface-card px-[24px]'>
      <ChatAvatar photo={customer.avatar} name={name} size={40} />
      <div className='flex min-w-0 flex-1 flex-col gap-[4px]'>
        <p className='truncate text-[16px] font-bold leading-[1.4] text-text-primary'>{name}</p>
        <div className='flex min-w-0 items-center gap-[8px]'>
          <SourceBadge source={room.source} />
          {where && <span className='truncate text-[12px] leading-[1.4] text-text-secondary' title={channelSubtitle(channel) || where}>{where}</span>}
        </div>
      </div>
      <span className='flex max-w-[200px] shrink-0 items-center gap-[6px] rounded-full border border-border-default px-[10px] py-[4px] text-[12px] leading-[1.4] text-text-secondary' title={t('assignee')}>
        <img src='/design/chat/user-small.svg' alt='' width={14} height={14} />
        <span className='truncate'>{room.assignee ? room.assignee.name : t('assignment_unassigned')}</span>
      </span>
      {onTogglePanel && (
        <button type='button' className={`flex size-[36px] shrink-0 items-center justify-center rounded-[8px] hover:bg-surface-page ${isPanelOpen ? 'bg-surface-page' : ''}`}
          aria-label={t('customer_info')} title={t('customer_info')} aria-pressed={isPanelOpen} onClick={onTogglePanel}>
          <img src='/design/chat/panel.svg' alt='' width={20} height={20} />
        </button>
      )}
    </div>
  )
}

/**
 * The chat room every chat source shares (Figma 聊天室 v1, Admin Web): the header, the messages and the message box.
 * Given a conversation, its messages and its source's capabilities, it shows the basic features for every source and
 * an optional one only when the capabilities declare it; nothing here asks which platform the conversation is on.
 *
 * onLoadOlder, hasOlder and loadingOlder page back through the conversation; without them every message is already here.
 * The page remounts it for each conversation (key), so each one starts at its latest message.
 */
function ChatRoomView({ room, channel, messages, capabilities, onSend, onLoadOlder, hasOlder, loadingOlder, isMobile, hidden, onTogglePanel, isPanelOpen, emptyState }) {
  const messagesRef = useRef(null)
  const messagesListRef = useRef(null)
  // Whether new content should keep the view at the latest message.
  const followLatestRef = useRef(true)
  const lastMessageIdRef = useRef(null)
  const lastScrollTopRef = useRef(0)
  // The message at the top of the view and how far it is from the top, so content added above it
  // (earlier messages, an image finishing loading) leaves it where the agent was reading.
  const anchorRef = useRef(null)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const [retrying, setRetrying] = useState(null)
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const hasRoom = Boolean(room)

  // Only moves the message area; scrollIntoView would also scroll the containers around it.
  function scrollToLatest() {
    followLatestRef.current = true
    setHasNewMessages(false)
    const area = messagesRef.current
    if (area) area.scrollTop = area.scrollHeight
  }

  function rememberAnchor() {
    const area = messagesRef.current
    const list = messagesListRef.current
    if (!area || !list) return
    const top = area.getBoundingClientRect().top
    const element = [...list.querySelectorAll('[data-anchor]')].find((candidate) => candidate.getBoundingClientRect().bottom > top)
    anchorRef.current = element ? { element, offset: element.getBoundingClientRect().top - top } : null
  }

  function restoreAnchor() {
    const area = messagesRef.current
    const anchor = anchorRef.current
    if (!area || !anchor?.element?.isConnected) return
    const moved = anchor.element.getBoundingClientRect().top - area.getBoundingClientRect().top - anchor.offset
    if (moved) area.scrollTop += moved
  }

  function loadOlderIfNearTop() {
    const area = messagesRef.current
    if (!area || !onLoadOlder || !hasOlder || loadingOlder) return
    if (area.scrollTop <= LOAD_OLDER_THRESHOLD_PX) onLoadOlder()
  }

  function handleMessagesScroll() {
    const area = messagesRef.current
    const isAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight <= AT_BOTTOM_THRESHOLD_PX
    // Content growing under the view (an image loading right after a jump to the end) also leaves it short of the
    // bottom; only scrolling up means the agent went back to read.
    const scrolledUp = area.scrollTop < lastScrollTopRef.current
    lastScrollTopRef.current = area.scrollTop
    if (isAtBottom) {
      followLatestRef.current = true
      setHasNewMessages(false)
    } else {
      if (scrolledUp) followLatestRef.current = false
      if (!followLatestRef.current) rememberAnchor()
    }
    loadOlderIfNearTop()
  }

  function send(reply) {
    return onSend(reply).then((result) => {
      scrollToLatest()
      return result
    })
  }

  // A message the platform turned down goes again with the same text and file.
  function retry(message) {
    setRetrying(message._id)
    const { text, attachments } = message.body || {}
    send({ ...(text ? { text } : {}), ...(attachments?.length ? { attachments } : {}) })
      .catch(() => null)
      .finally(() => setRetrying(null))
  }

  useLayoutEffect(() => {
    const lastId = messages?.length ? messages[messages.length - 1]._id : null
    // Earlier messages go above; only a different last message is news.
    const hasNewer = Boolean(lastMessageIdRef.current && lastId !== lastMessageIdRef.current)
    lastMessageIdRef.current = lastId
    if (followLatestRef.current) scrollToLatest()
    else {
      restoreAnchor()
      if (hasNewer) setHasNewMessages(true)
    }
  }, [messages])

  // A short page doesn't fill the area and can't be scrolled up, so load more until it does.
  useEffect(() => {
    const area = messagesRef.current
    if (area && area.scrollHeight <= area.clientHeight) loadOlderIfNearTop()
  }, [messages, hasOlder, loadingOlder])

  // Phones hide this view while the chat list shows, and hiding it loses the scroll position.
  useLayoutEffect(() => {
    if (!hidden) scrollToLatest()
  }, [hidden])

  // Images finishing loading, the keyboard, or an error bar change the size without a new message.
  useEffect(() => {
    const area = messagesRef.current
    const list = messagesListRef.current
    if (!area || !list || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => {
      if (followLatestRef.current) area.scrollTop = area.scrollHeight
      else restoreAnchor()
    })
    observer.observe(area)
    observer.observe(list)
    return () => observer.disconnect()
  }, [hasRoom])

  if (!room) {
    return (
      <div className={`messenger-room ${hidden ? 'hidden' : ''}`}>
        <div className='flex min-h-0 flex-1 items-center justify-center bg-surface-chat'>
          <ChatEmptyState kind='no_room' {...(emptyState || {})} />
        </div>
      </div>
    )
  }

  const windowEnd = can(capabilities, 'reply_window') ? windowEndIndex(messages || [], room.lastCustomerMessageAt) : -1
  const windowEndNote = windowEnd === -1 ? null : (
    <div data-anchor=''>
      <SystemMessage kind='event'>已超過 24 小時回覆期限・{formatMoment(new Date(room.lastCustomerMessageAt).getTime() + STANDARD_WINDOW_MS)}</SystemMessage>
    </div>
  )

  return (
    <div className={`messenger-room ${hidden ? 'hidden' : ''}`}>
      {!isMobile && <ChatHeader room={room} channel={channel} onTogglePanel={onTogglePanel} isPanelOpen={isPanelOpen} />}
      <div className='relative flex min-h-0 flex-1 flex-col bg-surface-chat'>
        <div ref={messagesRef} className='messenger-room-messages' onScroll={handleMessagesScroll}>
          <div ref={messagesListRef} className='flex flex-col gap-[8px]'>
            {onLoadOlder && messages?.length > 0 && (loadingOlder || !hasOlder) && (
              <p className='py-[4px] text-center text-[12px] leading-[1.4] text-text-tertiary'>{loadingOlder ? t('loading_older_messages') : t('no_older_messages')}</p>
            )}
            {(messages || []).map((message, i) => {
              const side = message.inbound ? 'customer' : 'company'
              const previous = messages[i - 1]
              const startsDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)
              // Only the first of a run from the same side has a tail; a day or the window note starts a new run.
              const hasTail = startsDay || i === windowEnd || Boolean(previous.inbound) !== Boolean(message.inbound)
              return (
                <React.Fragment key={message._id || i}>
                  {i === windowEnd && windowEndNote}
                  {startsDay && <div data-anchor='' className='py-[4px]'><SystemMessage kind='date'>{dayLabel(message.createdAt, { t, language })}</SystemMessage></div>}
                  <div data-anchor='' className={hasTail && !startsDay && i > 0 ? 'pt-[4px]' : ''}>
                    <MessageBubble message={message} side={side} hasTail={hasTail} time={timeLabel(message.createdAt, { language })} capabilities={capabilities}
                      onRetry={side === 'company' ? retry : null} retrying={retrying === message._id} />
                  </div>
                </React.Fragment>
              )
            })}
            {windowEnd === (messages || []).length && windowEndNote}
          </div>
        </div>
        {hasNewMessages && (
          <button type='button' className='absolute bottom-[12px] left-1/2 z-[1] h-[32px] -translate-x-1/2 whitespace-nowrap rounded-full bg-surface-card px-[14px] text-[13px] font-medium text-text-primary shadow-chat focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary-dark'
            onClick={scrollToLatest}>
            {t('new_messages')}
          </button>
        )}
      </div>
      <Composer room={room} capabilities={capabilities} onSend={send} />
    </div>
  )
}

ChatRoomView.propTypes = {
  // The open conversation, or null to show emptyState.
  room: PropTypes.object,
  // Its channel, for the phone number or page name in the header.
  channel: PropTypes.object,
  // Oldest first, as the store keeps them: _id, body, inbound, createdAt, delivery_error, isMine
  messages: PropTypes.array,
  capabilities: PropTypes.arrayOf(PropTypes.string),
  // ({ text, attachments }) => Promise; rejects with why the reply wasn't sent
  onSend: PropTypes.func.isRequired,
  onLoadOlder: PropTypes.func,
  hasOlder: PropTypes.bool,
  loadingOlder: PropTypes.bool,
  // Phones show the header above the page instead.
  isMobile: PropTypes.bool,
  // Phones keep it mounted but hidden while the list shows.
  hidden: PropTypes.bool,
  onTogglePanel: PropTypes.func,
  isPanelOpen: PropTypes.bool,
  // What ChatEmptyState shows without a conversation: kind, title, description, action.
  emptyState: PropTypes.object,
}

ChatRoomView.defaultProps = {
  room: null,
  channel: null,
  messages: [],
  capabilities: [],
  onLoadOlder: null,
  hasOlder: false,
  loadingOlder: false,
  isMobile: false,
  hidden: false,
  onTogglePanel: null,
  isPanelOpen: false,
  emptyState: null,
}

export default ChatRoomView
