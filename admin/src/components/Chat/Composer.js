import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import EmojiPicker from './EmojiPicker'
import QuickReplyPicker from './QuickReplyPicker'
import WhatsappTemplateDialog from './WhatsappTemplateDialog'
import ChatNotice from './ChatNotice'
import { canSendFiles, canSendKind, composerTools, sourceLabel } from './capabilities'
import { replyWindowOf, replyWindowNotice } from '../../utils/replyWindow'
import useNow from '../../utils/useNow'
import { selectUserInfo } from '../../redux/slices/userSlices'
import { checkAttachment, ACCEPT_ATTRIBUTE } from '../../utils/attachmentRules'
import { uploadAttachment, toMessageAttachment } from '../../utils/uploadAttachment'

// The text box grows with what is typed up to this height, then scrolls.
const MAX_INPUT_HEIGHT = 120

const KIND_LABELS = { image: '圖片', video: '影片', audio: '音訊', file: '檔案' }

const formatSize = (bytes) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`

function AttachmentPreview({ attachment, progress, isBusy, onRemove }) {
  const { file, previewUrl, kind } = attachment
  return (
    <div className='flex items-center gap-[10px] rounded-[10px] border border-border-default bg-surface-card p-[8px]'>
      {kind === 'image' && previewUrl && <img src={previewUrl} alt={file.name} className='size-[48px] shrink-0 rounded-[6px] object-cover' />}
      {kind === 'video' && previewUrl && <video src={previewUrl} muted className='size-[48px] shrink-0 rounded-[6px] object-cover' />}
      {!previewUrl && (
        <span className='flex size-[48px] shrink-0 items-center justify-center rounded-[6px] bg-surface-page' aria-hidden='true'>
          <img src='/design/chat/paperclip.svg' alt='' width={18} height={18} />
        </span>
      )}
      <div className='min-w-0 flex-1'>
        <div className='truncate text-[13px] leading-[1.4] text-text-primary' title={file.name}>{file.name}</div>
        <div className='text-[12px] leading-[1.4] text-text-tertiary'>
          {KIND_LABELS[kind] || '檔案'}・{formatSize(file.size)}{attachment.uploaded ? '・已上傳' : progress !== null ? `・上傳中 ${progress}%` : ''}
        </div>
        {progress !== null && !attachment.uploaded && (
          <div className='mt-[4px] h-[3px] overflow-hidden rounded-full bg-border-default' role='progressbar' aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className='h-full bg-brand-primary transition-[width]' style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      {!isBusy && (
        <button type='button' className='flex size-[28px] shrink-0 items-center justify-center rounded-full text-[14px] text-text-secondary hover:bg-surface-page' aria-label='移除附件' onClick={onRemove}>✕</button>
      )}
    </div>
  )
}

// One of the round tool buttons left of the text box; disabled ones fade.
function ToolButton({ icon, label, title, onClick, disabled, expanded, ...rest }) {
  return (
    <button type='button' aria-label={label} title={title || label} aria-expanded={expanded} onClick={onClick} disabled={disabled}
      className='flex size-[36px] shrink-0 items-center justify-center rounded-full hover:bg-surface-page disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'
      onMouseDown={(event) => event.preventDefault()} {...rest}>
      <img src={icon} alt='' width={18} height={18} />
    </button>
  )
}

/**
 * The message box of the chat room (Figma Admin/輸入區) with the limit notice above it.
 * Text, emoji and quick replies are there for every source. Attaching files and templates show only when the
 * conversation's source declares send_* and templates; a source with reply_window counts down its 24 hours and,
 * with templates, takes only a template once they have passed.
 * @param room - the open conversation: id, platform, source, lastCustomerMessageAt, replyWindow
 * @param capabilities - its source's
 * @param onSend ({ text, attachments }) => Promise, rejecting with { message, sentAttachment, templateRequired }
 */
function Composer({ room, capabilities, onSend }) {
  const [message, setMessage] = useState('')
  const [attachment, setAttachment] = useState(null)
  // 'idle' | 'uploading' | 'sending'
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(null)
  const [sendError, setSendError] = useState('')
  const [pickError, setPickError] = useState('')
  const [isEmojiOpen, setIsEmojiOpen] = useState(false)
  // 'button' or 'slash': typing / in an empty box opens it too, and Esc gives the / back.
  const [quickReplyOpenedBy, setQuickReplyOpenedBy] = useState(null)
  const [isTemplateOpen, setIsTemplateOpen] = useState(false)
  // The send failed because the 24 hours ran out while the agent was typing.
  const [needsTemplate, setNeedsTemplate] = useState(false)
  const userInfo = useSelector(selectUserInfo)
  const isAdmin = String(userInfo?.role || '').toLowerCase() === 'admin'
  const now = useNow()
  const replyState = replyWindowOf(room, capabilities, now)
  const tools = composerTools(capabilities, replyState)
  const notice = replyWindowNotice(replyState, { capabilities, lastCustomerMessageAt: room?.lastCustomerMessageAt, sourceName: sourceLabel(room?.source) }, now)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  // Where the cursor was, so an emoji goes there even after the text box lost focus.
  const selectionRef = useRef({ start: 0, end: 0 })
  const caretAfterRenderRef = useRef(null)
  const isBusy = status !== 'idle'
  const hasContent = Boolean(message.trim() || attachment)

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_INPUT_HEIGHT)}px`
    textarea.style.overflowY = textarea.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden'
    if (caretAfterRenderRef.current !== null) {
      const caret = caretAfterRenderRef.current
      caretAfterRenderRef.current = null
      textarea.focus()
      textarea.setSelectionRange(caret, caret)
      selectionRef.current = { start: caret, end: caret }
    }
  }, [message])

  // The preview's object URL holds the file in memory until it is released.
  useEffect(() => () => { if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl) }, [attachment?.previewUrl])

  function rememberSelection() {
    const textarea = textareaRef.current
    if (textarea) selectionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd }
  }

  // Puts text where the cursor was, replacing any selection, and leaves the cursor after it.
  function insertText(text) {
    if (isBusy) return
    const textarea = textareaRef.current
    const { start, end } = document.activeElement === textarea
      ? { start: textarea.selectionStart, end: textarea.selectionEnd }
      : selectionRef.current
    const safeStart = Math.min(start, message.length)
    const safeEnd = Math.min(Math.max(end, safeStart), message.length)
    caretAfterRenderRef.current = safeStart + text.length
    setMessage(message.slice(0, safeStart) + text + message.slice(safeEnd))
  }

  const closeEmoji = useCallback(() => setIsEmojiOpen(false), [])

  const quickReplyRef = useRef(null)
  quickReplyRef.current = quickReplyOpenedBy
  const closeQuickReply = useCallback((reason) => {
    const openedBy = quickReplyRef.current
    setQuickReplyOpenedBy(null)
    if (reason !== 'escape') return
    if (openedBy === 'slash') {
      caretAfterRenderRef.current = 1
      setMessage((current) => current || '/')
    }
    textareaRef.current?.focus()
  }, [])

  function handleChange(event) {
    const { value } = event.target
    // A / in an empty box is the shortcut for quick replies.
    if (!message && value === '/' && tools.canWrite) {
      selectionRef.current = { start: 0, end: 0 }
      setIsEmojiOpen(false)
      setQuickReplyOpenedBy('slash')
      return
    }
    setMessage(value)
  }

  function pickFile(file) {
    if (!file || isBusy || !tools.files) return
    setSendError('')
    // The platform's limits for each kind of file; the source decides which kinds it sends at all.
    const check = checkAttachment(room?.platform, { mime: file.type, filename: file.name, size: file.size })
    if (!check.ok) {
      setPickError(`無法附加「${file.name}」：${check.reason}`)
      return
    }
    if (!canSendKind(capabilities, check.kind)) {
      setPickError(`無法附加「${file.name}」：${sourceLabel(room?.source) || '這個來源'}不能傳送${KIND_LABELS[check.kind] || '這種檔案'}`)
      return
    }
    setPickError('')
    setProgress(null)
    setAttachment({ file, kind: check.kind, previewUrl: ['image', 'video'].includes(check.kind) ? URL.createObjectURL(file) : null })
  }

  function removeAttachment() {
    setAttachment(null)
    setProgress(null)
  }

  function openTemplates() {
    setIsEmojiOpen(false)
    setQuickReplyOpenedBy(null)
    setIsTemplateOpen(true)
  }

  async function send() {
    if (isBusy) return
    if (!tools.canWrite) {
      if (tools.templateOnly) openTemplates()
      return
    }
    const text = message.trim()
    if (!text && !attachment) return
    setSendError('')
    setPickError('')
    setNeedsTemplate(false)
    setIsEmojiOpen(false)
    try {
      // A file uploaded on an earlier try is sent again without uploading it twice.
      let uploaded = attachment?.uploaded
      if (attachment && !uploaded) {
        setStatus('uploading')
        setProgress(0)
        uploaded = await uploadAttachment(attachment.file, room?.platform, setProgress)
        setAttachment((current) => current && { ...current, uploaded })
      }
      setStatus('sending')
      await onSend({
        ...(text ? { text } : {}),
        ...(uploaded ? { attachments: [toMessageAttachment(uploaded)] } : {}),
      })
      setMessage('')
      removeAttachment()
    } catch (error) {
      // The file went out on its own and only the text failed, so only the text is left to send.
      if (error?.sentAttachment) removeAttachment()
      setNeedsTemplate(Boolean(error?.templateRequired) && tools.templates)
      setSendError(`${error?.sentAttachment ? '' : '訊息未送出：'}${error?.message || error}`)
    } finally {
      setStatus('idle')
    }
  }

  function handleKeyDown(event) {
    // Enter while choosing Chinese characters confirms the characters, not the message (Safari reports it as keyCode 229).
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    send()
  }

  function handlePaste(event) {
    const file = event.clipboardData?.files?.[0]
    if (!file || !tools.files) return
    event.preventDefault()
    pickFile(file)
  }

  const sendLabel = tools.templateOnly ? '選擇範本' : status === 'uploading' ? `上傳中 ${progress ?? 0}%` : status === 'sending' ? '發送中…' : '發送'
  const canPressSend = tools.templateOnly || (tools.canWrite && hasContent && !isBusy)
  const placeholder = tools.canWrite ? '輸入訊息，Enter 送出，輸入 / 插入快速回覆'
    : tools.templateOnly ? '已超過回覆期限，請改用範本' : '目前無法回覆這段對話'
  const error = sendError || pickError

  return (
    <div className='shrink-0 bg-surface-chat px-[16px] pb-[16px] sm:px-[24px]'>
      {notice && (
        <div className='mb-[8px]'>
          <ChatNotice kind='platform' title={notice.title} detail={notice.detail}
            action={notice.templateAction && tools.templates ? { title: '選擇範本', onClick: openTemplates } : null} />
        </div>
      )}
      {error && (
        <div className='mb-[8px] flex items-start gap-[8px] rounded-[10px] bg-feedback-alert-soft px-[12px] py-[8px] text-[13px] leading-[1.5]' role='alert'>
          <img src='/design/chat/alert-failed.svg' alt='' width={16} height={16} className='mt-[2px] shrink-0' />
          <span className='flex-1 text-feedback-alert'>{error}</span>
          {sendError && needsTemplate && <button type='button' className='shrink-0 font-bold text-brand-primary-dark' onClick={openTemplates}>選擇範本</button>}
          {sendError && !needsTemplate && <button type='button' className='shrink-0 font-bold text-brand-primary-dark disabled:opacity-50' onClick={send} disabled={isBusy}>重試</button>}
        </div>
      )}
      <div className='relative flex flex-col gap-[8px] rounded-[16px] border border-border-default bg-surface-card px-[8px] py-[8px] focus-within:border-brand-primary'>
        {attachment && <AttachmentPreview attachment={attachment} progress={progress} isBusy={isBusy} onRemove={removeAttachment} />}
        {/* A narrow chat room (side menu and list open on a small screen) wraps the send button rather than squeeze the text. */}
        <div className='flex flex-wrap items-end gap-[4px]'>
          <ToolButton icon={tools.canWrite ? '/design/chat/smile.svg' : '/design/chat/smile-disabled.svg'} label='插入表情' data-emoji-toggle=''
            expanded={isEmojiOpen} disabled={isBusy || !tools.canWrite}
            onClick={() => { setQuickReplyOpenedBy(null); setIsEmojiOpen((open) => !open) }} />
          <ToolButton icon={tools.canWrite ? '/design/chat/zap.svg' : '/design/chat/zap-disabled.svg'} label='插入快速回覆' title='插入快速回覆（也可以在空白輸入框輸入 /）'
            data-quick-reply-toggle='' expanded={Boolean(quickReplyOpenedBy)} disabled={isBusy || !tools.canWrite}
            onClick={() => { setIsEmojiOpen(false); setQuickReplyOpenedBy((open) => (open ? null : 'button')) }} />
          {canSendFiles(capabilities) && (
            <ToolButton icon={tools.files ? '/design/chat/paperclip.svg' : '/design/chat/paperclip-disabled.svg'} label='附加檔案'
              disabled={isBusy || !tools.files} onClick={() => fileInputRef.current?.click()} />
          )}
          {tools.templates && room?.id && (
            <ToolButton icon='/design/chat/template.svg' label='使用範本' title='傳送已核准的範本' disabled={isBusy} onClick={openTemplates} />
          )}
          <input ref={fileInputRef} type='file' accept={ACCEPT_ATTRIBUTE} hidden
            onChange={(event) => { pickFile(event.target.files?.[0]); event.target.value = '' }} />
          <textarea
            ref={textareaRef}
            className='min-h-[36px] min-w-[120px] flex-1 resize-none border-none bg-transparent px-[8px] py-[7px] text-[14px] leading-[22px] text-text-primary outline-none placeholder:text-text-tertiary focus:shadow-none disabled:cursor-not-allowed'
            rows={1}
            placeholder={placeholder}
            title='Enter 送出，Shift+Enter 換行，輸入 / 插入快速回覆'
            value={message}
            readOnly={isBusy}
            disabled={!tools.canWrite}
            aria-label='訊息'
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={rememberSelection}
            onBlur={rememberSelection}
            onPaste={handlePaste}
          />
          <button type='button' aria-label={sendLabel} title={sendLabel} onClick={send} disabled={!canPressSend}
            className={`ml-auto flex h-[36px] shrink-0 items-center justify-center gap-[6px] rounded-full px-[12px] text-[13px] font-medium ${canPressSend ? 'bg-brand-primary text-text-on-primary hover:bg-brand-primary-dark' : 'bg-border-default text-text-tertiary'} ${isBusy ? 'opacity-70' : ''}`}>
            {tools.templateOnly ? <img src='/design/chat/template.svg' alt='' width={16} height={16} className='brightness-0 invert' /> : <img src={canPressSend ? '/design/chat/send.svg' : '/design/chat/send-disabled.svg'} alt='' width={16} height={16} />}
            <span className='hidden sm:inline'>{sendLabel}</span>
          </button>
        </div>
        {isEmojiOpen && <EmojiPicker onSelect={insertText} onClose={closeEmoji} />}
        {quickReplyOpenedBy && <QuickReplyPicker platform={room?.platform} isAdmin={isAdmin} onPick={insertText} onClose={closeQuickReply} />}
      </div>
      {isTemplateOpen && room?.id && (
        <WhatsappTemplateDialog room={room} onClose={() => setIsTemplateOpen(false)} onSent={() => { setSendError(''); setNeedsTemplate(false) }} />
      )}
    </div>
  )
}

Composer.propTypes = {
  room: PropTypes.shape({
    id: PropTypes.string,
    platform: PropTypes.string,
    source: PropTypes.string,
    lastCustomerMessageAt: PropTypes.string,
    replyWindow: PropTypes.object,
  }).isRequired,
  capabilities: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSend: PropTypes.func.isRequired,
}

export default Composer
