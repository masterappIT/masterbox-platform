import React from 'react'
import PropTypes from 'prop-types'
import ChatAvatar from './ChatAvatar'
import SourceBadge from './SourceBadge'

/**
 * A conversation in the list (Figma Admin/對話列表項目): the customer, where it comes from, the last message, when,
 * who handles it and how many messages are unread. Selected rows use the brand tint; others tint on hover.
 */
function ChatListItem({ name, photo, source, lastMessage, time, assignee, unread, isSelected, onClick }) {
  return (
    <button type='button' onClick={onClick} aria-current={isSelected ? 'true' : undefined}
      className={`flex w-full items-start gap-[12px] border-b border-border-default px-[16px] py-[12px] text-left ${isSelected ? 'bg-brand-primary-tint' : 'bg-surface-card hover:bg-surface-page'}`}>
      <ChatAvatar photo={photo} name={name} size={40} />
      <span className='flex min-w-0 flex-1 flex-col gap-[4px]'>
        <span className='flex min-w-0 items-center gap-[8px]'>
          <span className={`min-w-0 flex-1 truncate text-[14px] leading-[1.4] text-text-primary ${unread ? 'font-bold' : 'font-medium'}`}>{name}</span>
          <span className='shrink-0 whitespace-nowrap text-[12px] leading-[1.4] text-text-tertiary'>{time}</span>
        </span>
        <span className='flex min-w-0 items-center gap-[8px]'>
          <span className={`min-w-0 flex-1 truncate text-[13px] leading-[1.5] ${unread ? 'text-text-primary' : 'text-text-secondary'}`}>{lastMessage}</span>
          {unread > 0 && (
            <span className='inline-flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-full bg-brand-primary px-[6px] text-[12px] font-medium leading-none text-text-on-primary' aria-label={`${unread} 則未讀`}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
        <span className='flex min-w-0 items-center gap-[6px]'>
          <SourceBadge source={source} />
          {assignee && (
            <span className='flex min-w-0 items-center gap-[4px] text-[12px] leading-[1.4] text-text-secondary' title={`負責人：${assignee}`}>
              <img src='/design/chat/user-small.svg' alt='' width={12} height={12} className='shrink-0' />
              <span className='truncate'>{assignee}</span>
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

ChatListItem.propTypes = {
  name: PropTypes.string.isRequired,
  photo: PropTypes.string,
  source: PropTypes.string,
  lastMessage: PropTypes.string,
  time: PropTypes.string,
  // The agent's name, or nothing while it is unassigned.
  assignee: PropTypes.string,
  unread: PropTypes.number,
  isSelected: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
}

ChatListItem.defaultProps = {
  photo: null,
  source: null,
  lastMessage: '',
  time: '',
  assignee: null,
  unread: 0,
  isSelected: false,
}

export default ChatListItem
