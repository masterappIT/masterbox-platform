import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { can } from './capabilities'

// What an attachment is called when it can't be shown, such as [位置].
const ATTACHMENT_LABELS = {
  image: '圖片',
  video: '影片',
  audio: '語音訊息',
  file: '檔案',
  document: '文件',
  sticker: '貼圖',
  location: '位置',
  contacts: '聯絡人',
  share: '分享',
  story_mention: '限時動態提及',
  ig_reel: 'Reels',
  reel: 'Reels',
  order: '訂單',
  reaction: '表情回應',
}

// Files are served over HTTPS; local development serves them from the API on localhost.
const isFileUrl = (url) => /^https:\/\//.test(url || '') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url || '')

function MediaPlaceholder({ label }) {
  return (
    <div className='flex h-[160px] w-[240px] max-w-full items-center justify-center rounded-[10px] bg-surface-page' role='img' aria-label={label}>
      <img src='/design/chat/image.svg' alt='' width={32} height={32} />
    </div>
  )
}

// One attachment of a message's body. A link that stopped working falls back to the same text as having none.
function Attachment({ type, url, filename, caption }) {
  const [isBroken, setIsBroken] = useState(false)
  // Until an image arrives it keeps a grey box, so the bubble doesn't jump or look empty.
  const [isLoaded, setIsLoaded] = useState(false)
  const label = ATTACHMENT_LABELS[type] || '附件'
  const link = isFileUrl(url) && !isBroken ? url : null
  const captionLine = caption ? <div className='whitespace-pre-wrap break-words'>{caption}</div> : null

  if (type === 'image' || type === 'sticker') {
    const image = link
      ? <a href={link} target='_blank' rel='noopener noreferrer' className='block'><img src={link} alt={filename || label} className={`${type === 'sticker' ? 'block max-h-[120px] max-w-[120px]' : 'block max-h-[320px] w-[240px] max-w-full rounded-[10px] object-cover'} ${isLoaded ? '' : 'min-h-[120px] min-w-[120px] rounded-[10px] bg-surface-page'}`} onLoad={() => setIsLoaded(true)} onError={() => setIsBroken(true)} /></a>
      : <MediaPlaceholder label={label} />
    return <>{image}{captionLine}</>
  }
  if (link && type === 'video') {
    return <><video src={link} controls preload='metadata' className='block w-[240px] max-w-full rounded-[10px]' onError={() => setIsBroken(true)} />{captionLine}</>
  }
  if (link && type === 'audio') {
    return <><audio src={link} controls preload='metadata' className='block w-[240px] max-w-full' onError={() => setIsBroken(true)} />{captionLine}</>
  }
  if (link) {
    return (
      <>
        <a href={link} target='_blank' rel='noopener noreferrer' className='flex items-center gap-[8px] rounded-[8px] bg-surface-page/70 px-[10px] py-[8px] text-[13px] text-text-primary underline-offset-2 hover:underline'>
          <img src='/design/chat/paperclip.svg' alt='' width={16} height={16} />
          <span className='min-w-0 break-all'>{filename || `查看${label}`}</span>
        </a>
        {captionLine}
      </>
    )
  }
  return <div className='text-text-secondary'>[{label}{filename ? `：${filename}` : ''}]{caption ? ` ${caption}` : ''}</div>
}

// Sent: one grey tick. Read: the blue double tick, for sources that report reading (read_receipts).
function DeliveryTicks({ isRead }) {
  if (isRead) return <img src='/design/chat/check-double.svg' alt='已讀' width={14} height={14} />
  return (
    <svg width='14' height='14' viewBox='0 0 14 14' fill='none' role='img' aria-label='已送出'>
      <path d='M11.0833 4.08333L5.25 9.91667L2.91667 7.58333' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  )
}

/**
 * One message as a bubble (Figma Admin/訊息泡泡): the customer's in white on the left, the company's in soft orange on
 * the right. Only the first of a run from the same side has a tail. The time, who replied and the ticks sit inside.
 */
function MessageBubble({ message, side, hasTail, time, capabilities, onRetry, retrying }) {
  const { body, delivery_error: deliveryError, isMine, readAt } = message
  const isCompany = side === 'company'
  const text = body?.text
  const attachments = body?.attachments || []
  const isEmpty = !body || (!text && !attachments.length)
  // Who on the company's side replied, when it wasn't the agent looking at it, and from which template.
  const sender = isCompany && isMine === false ? '同事' : null
  const template = body?.template?.name ? `範本：${body.template.name}` : null
  const meta = [sender, template, time].filter(Boolean)

  return (
    <div className={`flex w-full flex-col gap-[4px] ${isCompany ? 'items-end' : 'items-start'}`}>
      <div className={`relative flex max-w-[min(480px,85%)] flex-col gap-[6px] rounded-[8px] px-[14px] py-[10px] text-[14px] leading-[1.5] text-text-primary ${isCompany ? 'bg-bubble-company' : 'border border-border-default bg-bubble-customer'}`}>
        {hasTail && (isCompany
          ? <img src='/design/chat/tail-company.svg' alt='' width={15} height={9} className='absolute right-[-7px] top-0' />
          : <img src='/design/chat/tail-customer.svg' alt='' width={15} height={9} className='absolute left-[-8px] top-[-1px]' />)}
        {attachments.map((attachment, i) => <Attachment key={i} {...attachment} />)}
        {text && <div className='whitespace-pre-wrap break-words'>{text}</div>}
        {isEmpty && <div className='text-text-tertiary'>[此訊息類型暫不支援顯示]</div>}
        <div className='flex items-center gap-[4px] whitespace-nowrap text-[11px] leading-[1.4] text-text-tertiary'>
          <span>{meta.join(' ・ ')}</span>
          {isCompany && !deliveryError && <DeliveryTicks isRead={Boolean(readAt) && can(capabilities, 'read_receipts')} />}
        </div>
      </div>
      {deliveryError && (
        // A long reason wraps in its own column, so the icon and 重試 stay beside it.
        <div className='flex max-w-[min(480px,85%)] items-start justify-end gap-x-[4px] text-[12px] leading-[1.4]'>
          <img src='/design/chat/alert-failed.svg' alt='' width={14} height={14} className='mt-[2px] shrink-0' />
          <span className='min-w-0 break-words text-feedback-alert'>未送出：{deliveryError}</span>
          {onRetry && (
            <button type='button' className='shrink-0 font-bold text-brand-primary-dark disabled:opacity-50' disabled={retrying} onClick={() => onRetry(message)}>
              {retrying ? '重試中…' : '重試'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

MessageBubble.propTypes = {
  // A message from the store: body { text, attachments, template }, delivery_error, isMine, readAt
  message: PropTypes.object.isRequired,
  side: PropTypes.oneOf(['customer', 'company']).isRequired,
  hasTail: PropTypes.bool,
  time: PropTypes.string,
  capabilities: PropTypes.arrayOf(PropTypes.string),
  // Sends the message again; without it a failed message only says why.
  onRetry: PropTypes.func,
  retrying: PropTypes.bool,
}

MessageBubble.defaultProps = {
  hasTail: false,
  time: '',
  capabilities: [],
  onRetry: null,
  retrying: false,
}

export default MessageBubble
