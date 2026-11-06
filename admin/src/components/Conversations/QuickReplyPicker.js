import React, { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useDispatch, useSelector } from 'react-redux'
import { loadQuickReplies, selectQuickReplies, selectQuickRepliesStatus } from '../../redux/slices/messagesSlices'
import { parseTemplateMessages, platformLabel } from '../../utils/messageTemplate'

// A template's messages, inserted as one reply.
export const quickReplyText = (template) => parseTemplateMessages(template.contents).join('\n\n')

/**
 * Picks one of the company's templates to put into the message box. Opens from the button or by typing / in an empty box.
 * @param platform - the conversation's; its templates come first
 * @param onPick (text: string) => void
 * @param onClose (reason: 'escape' | 'outside' | 'picked') => void
 */
function QuickReplyPicker({ platform, onPick, onClose, isAdmin }) {
  const dispatch = useDispatch()
  const templates = useSelector(selectQuickReplies)
  const status = useSelector(selectQuickRepliesStatus)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const ref = useRef(null)
  const listRef = useRef(null)

  // Read again each time, so a template an admin just added is there.
  useEffect(() => { dispatch(loadQuickReplies()) }, [dispatch])

  useEffect(() => {
    const handlePointer = (event) => {
      if (ref.current && !ref.current.contains(event.target) && !event.target.closest?.('[data-quick-reply-toggle]')) onClose('outside')
    }
    document.addEventListener('mousedown', handlePointer)
    return () => document.removeEventListener('mousedown', handlePointer)
  }, [onClose])

  const items = useMemo(() => {
    const words = query.trim().toLowerCase()
    return templates
      .map((template) => ({ ...template, text: quickReplyText(template) }))
      .filter(({ text }) => text.trim())
      .filter(({ name, text }) => !words || name.toLowerCase().includes(words) || text.toLowerCase().includes(words))
      .sort((a, b) => Number(b.platform === platform) - Number(a.platform === platform) || a.name.localeCompare(b.name))
  }, [templates, query, platform])

  useEffect(() => { setActive(0) }, [query])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  const pick = (item) => {
    if (!item) return
    onPick(item.text)
    onClose('picked')
  }

  const handleKeyDown = (event) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(index + 1, items.length - 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)) }
    else if (event.key === 'Enter') { event.preventDefault(); pick(items[active]) }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose('escape') }
  }

  const isLoading = status === 'loading' && !templates.length
  let empty = null
  if (isLoading) empty = '正在讀取範本…'
  else if (status === 'failed' && !templates.length) empty = '目前無法讀取範本，請稍後再試'
  else if (!templates.length) empty = isAdmin ? '還沒有範本，可以到左側「訊息範本」新增' : '還沒有範本，請管理員到「訊息範本」新增'
  else if (!items.length) empty = '找不到符合的範本'

  return (
    <div ref={ref} className='quick-reply' role='dialog' aria-label='插入快速回覆'>
      <input className='quick-reply-search' autoFocus type='search' value={query} placeholder='搜尋範本名稱或內容' aria-label='搜尋快速回覆'
        onChange={(event) => setQuery(event.target.value)} onKeyDown={handleKeyDown}
        role='combobox' aria-expanded='true' aria-controls='quick-reply-list' aria-activedescendant={items[active] ? `quick-reply-${items[active].id}` : undefined} />
      {empty ? <p className='quick-reply-empty'>{empty}</p> : (
        <ul ref={listRef} id='quick-reply-list' className='quick-reply-list' role='listbox'>
          {items.map((item, index) => (
            <li key={item.id} id={`quick-reply-${item.id}`} data-index={index} role='option' aria-selected={index === active}
              className={`quick-reply-item ${index === active ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => pick(item)}>
              <span className='quick-reply-item-name'>{item.name}{item.platform !== platform && <small>{platformLabel(item.platform)}</small>}</span>
              <span className='quick-reply-item-text'>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
      <p className='quick-reply-hint'>↑↓ 選擇・Enter 插入・Esc 關閉</p>
    </div>
  )
}

QuickReplyPicker.propTypes = {
  platform: PropTypes.string,
  onPick: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  isAdmin: PropTypes.bool,
}

export default QuickReplyPicker
