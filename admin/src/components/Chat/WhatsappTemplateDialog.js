import React, { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { createPortal } from 'react-dom'
import { useDispatch } from 'react-redux'
import Popup from '../../stories/components/Popup'
import Button from '../../stories/components/Button'
import { loadWhatsappTemplates, sendWhatsappTemplate } from '../../redux/slices/messagesSlices'
import { checkAttachment } from '../../utils/attachmentRules'
import { uploadAttachment } from '../../utils/uploadAttachment'

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g
const CATEGORY_LABELS = { MARKETING: '行銷', UTILITY: '交易通知', AUTHENTICATION: '驗證碼' }
const MEDIA = {
  image: { label: '圖片', kind: 'image', accept: 'image/jpeg,image/png' },
  video: { label: '影片', kind: 'video', accept: 'video/mp4,video/3gpp' },
  document: { label: '文件', kind: 'file', accept: 'application/pdf' },
}

// The template's text with what has been filled in so far; blanks stay as {{1}} and are marked.
function Filled({ text, component, values }) {
  if (!text) return null
  const parts = []
  let last = 0
  for (const match of text.matchAll(PLACEHOLDER)) {
    parts.push(text.slice(last, match.index))
    const value = values[`${component}:${match[1]}`]
    parts.push(value ? <mark key={match.index} className='wa-template-filled'>{value}</mark> : <mark key={match.index} className='wa-template-blank'>{match[0]}</mark>)
    last = match.index + match[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}

function Preview({ template, values, media }) {
  const mediaInfo = template.header_format && MEDIA[template.header_format.toLowerCase()]
  return (
    <div className='wa-template-preview' aria-label='預覽'>
      <div className='wa-template-bubble'>
        {mediaInfo && (media?.previewUrl && mediaInfo.kind === 'image'
          ? <img src={media.previewUrl} alt='' className='wa-template-media' />
          : <div className='wa-template-media-placeholder'>{media?.file ? `📎 ${media.file.name}` : `［${mediaInfo.label}］`}</div>)}
        {template.header_text && <strong className='wa-template-header'><Filled text={template.header_text} component='header' values={values} /></strong>}
        <p className='wa-template-body'><Filled text={template.body_text} component='body' values={values} /></p>
        {template.footer_text && <small className='wa-template-footer'>{template.footer_text}</small>}
      </div>
      {template.buttons.length > 0 && (
        <div className='wa-template-buttons'>
          {template.buttons.map((button, index) => <span key={index}>{button.text || (button.type === 'COPY_CODE' ? '複製優惠碼' : button.type)}</span>)}
        </div>
      )}
    </div>
  )
}

/**
 * Sends one of the WhatsApp number's approved templates, with its variables filled in.
 * WhatsApp only accepts templates once 24 hours have passed since the customer's last message.
 */
function WhatsappTemplateDialog({ room, onClose, onSent }) {
  const dispatch = useDispatch()
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [templates, setTemplates] = useState([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [values, setValues] = useState({})
  const [media, setMedia] = useState(null)
  const [progress, setProgress] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const load = () => {
    setStatus('loading')
    setLoadError('')
    dispatch(loadWhatsappTemplates({ id: room.id })).unwrap()
      .then((list) => { setTemplates(list); setStatus('ready') })
      .catch((reason) => { setLoadError(typeof reason === 'string' ? reason : reason?.message || '無法讀取範本'); setStatus('failed') })
  }
  useEffect(load, [room.id])
  useEffect(() => () => { if (media?.previewUrl) URL.revokeObjectURL(media.previewUrl) }, [media?.previewUrl])

  const selected = templates.find(({ id }) => id === selectedId) || null
  const shown = useMemo(() => {
    const words = search.trim().toLowerCase()
    return words ? templates.filter(({ name, body_text }) => name.toLowerCase().includes(words) || body_text.toLowerCase().includes(words)) : templates
  }, [templates, search])

  const choose = (template) => {
    if (!template.supported || sending) return
    setSelectedId(template.id)
    // Start from Meta's examples' shape but empty, so nothing is sent by accident.
    setValues({})
    setMedia(null)
    setProgress(null)
    setError('')
  }

  const mediaVariable = selected?.variables.find(({ component }) => component === 'header_media')
  const textVariables = selected?.variables.filter(({ component }) => component !== 'header_media') || []
  const mediaInfo = mediaVariable ? MEDIA[mediaVariable.name] : null
  const missing = textVariables.filter(({ key }) => !String(values[key] || '').trim()).length + (mediaInfo && !media ? 1 : 0)

  const pickMedia = (file) => {
    if (!file || !mediaInfo) return
    const check = checkAttachment('whatsapp', { mime: file.type, filename: file.name, size: file.size })
    if (!check.ok) { setError(`無法使用「${file.name}」：${check.reason}`); return }
    if (check.kind !== mediaInfo.kind) { setError(`這個範本的標題需要${mediaInfo.label}`); return }
    if (mediaInfo.kind === 'file' && check.mime !== 'application/pdf') { setError('WhatsApp 範本的標題文件只能是 PDF'); return }
    setError('')
    setProgress(null)
    setMedia({ file, previewUrl: check.kind === 'image' ? URL.createObjectURL(file) : null, uploaded: null })
  }

  const send = async () => {
    if (!selected || sending) return
    if (missing) { setError('請填完所有欄位'); return }
    setSending(true)
    setError('')
    try {
      let uploaded = media?.uploaded
      if (media && !uploaded) {
        setProgress(0)
        uploaded = await uploadAttachment(media.file, 'whatsapp', setProgress)
        setMedia((current) => current && { ...current, uploaded })
      }
      await dispatch(sendWhatsappTemplate({
        id: room.id,
        templateId: selected.id,
        values: textVariables.map(({ key }) => ({ key, value: values[key] || '' })),
        headerMediaUrl: uploaded?.url,
      })).unwrap()
      onSent?.()
      onClose()
    } catch (reason) {
      setError(`範本未送出：${typeof reason === 'string' ? reason : reason?.message || reason}`)
    } finally {
      setSending(false)
    }
  }

  // The chat panel is its own stacking context, so the dialog goes on the page itself to cover the conversation list too.
  return createPortal(
    <Popup isShow size='fit' label='使用 WhatsApp 範本發送' onClick={() => { if (!sending) onClose() }}>
      <div className='wa-template'>
        <h2 className='wa-template-title'>使用 WhatsApp 範本發送</h2>
        <p className='wa-template-intro'>只會列出 Meta 已核准的範本。範本要在 WhatsApp 管理工具（Meta Business Suite）建立並通過審核。</p>
        <div className='wa-template-layout'>
          <div className='wa-template-list'>
            <input type='search' value={search} placeholder='搜尋範本' aria-label='搜尋範本' onChange={(event) => setSearch(event.target.value)} />
            {status === 'loading' && <p className='wa-template-note'>正在向 Meta 讀取範本…</p>}
            {status === 'failed' && <div className='wa-template-note wa-template-error'><p>{loadError}</p><button type='button' className='messenger-room-send-retry' onClick={load}>重試</button></div>}
            {status === 'ready' && !templates.length && <p className='wa-template-note'>這個 WhatsApp 號碼還沒有已核准的範本。</p>}
            {status === 'ready' && templates.length > 0 && !shown.length && <p className='wa-template-note'>找不到符合的範本</p>}
            <ul>
              {shown.map((template) => (
                <li key={template.id}>
                  <button type='button' disabled={!template.supported || sending} aria-pressed={template.id === selectedId}
                    className={`wa-template-item ${template.id === selectedId ? 'is-selected' : ''}`} onClick={() => choose(template)}
                    title={template.unsupported_reason || undefined}>
                    <span className='wa-template-item-name'>{template.name}<small>{template.language}{template.category ? `・${CATEGORY_LABELS[template.category] || template.category}` : ''}</small></span>
                    <span className='wa-template-item-text'>{template.body_text}</span>
                    {!template.supported && <span className='wa-template-item-reason'>{template.unsupported_reason}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className='wa-template-form'>
            {!selected ? <p className='wa-template-note'>先選一個範本。</p> : (
              <>
                <Preview template={selected} values={values} media={media} />
                {mediaInfo && (
                  <div className='wa-template-field'>
                    <span>{mediaVariable.label}</span>
                    <div className='flex items-center gap-[8px]'>
                      <button type='button' className='messenger-room-send-retry' disabled={sending} onClick={() => fileRef.current?.click()}>{media ? `更換${mediaInfo.label}` : `選擇${mediaInfo.label}`}</button>
                      <span className='wa-template-file'>{media ? media.file.name : '尚未選擇'}{progress !== null && !media?.uploaded ? `・上傳中 ${progress}%` : ''}</span>
                    </div>
                    <input ref={fileRef} type='file' hidden accept={mediaInfo.accept} onChange={(event) => { pickMedia(event.target.files?.[0]); event.target.value = '' }} />
                  </div>
                )}
                {textVariables.map((variable) => (
                  <label key={variable.key} className='wa-template-field'>
                    <span>{variable.label}</span>
                    <input value={values[variable.key] || ''} disabled={sending} placeholder={variable.example ? `例如：${variable.example}` : ''}
                      onChange={(event) => setValues((current) => ({ ...current, [variable.key]: event.target.value }))} />
                  </label>
                ))}
                {!textVariables.length && !mediaInfo && <p className='wa-template-note'>這個範本沒有要填的內容，可以直接發送。</p>}
              </>
            )}
          </div>
        </div>
        {error && <p className='wa-template-error' role='alert'>{error}</p>}
        <div className='wa-template-actions'>
          <Button title='取消' color='grayscale' disabled={sending} onClick={onClose} />
          <Button title={sending ? (progress !== null && !media?.uploaded ? `上傳中 ${progress}%` : '發送中…') : '發送範本'} disabled={!selected || sending} onClick={send} />
        </div>
      </div>
    </Popup>,
    document.body,
  )
}

WhatsappTemplateDialog.propTypes = {
  room: PropTypes.shape({ id: PropTypes.string.isRequired }).isRequired,
  onClose: PropTypes.func.isRequired,
  onSent: PropTypes.func,
}

export default WhatsappTemplateDialog
