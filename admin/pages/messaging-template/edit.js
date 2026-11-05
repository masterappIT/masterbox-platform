import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useMutation, useQuery } from '@apollo/client'
import Button from '../../src/stories/components/Button'
import Loading from '../../src/stories/components/Loading'
import AlertStack from '../../src/stories/components/AlertStack'
import useAlerts from '../../src/utils/useAlerts'
import { MESSAGE_TEMPLATES, CREATE_MESSAGE_TEMPLATE, UPDATE_MESSAGE_TEMPLATE } from '../../src/graphQL/messageTemplate'
import { TEMPLATE_PLATFORMS, TEMPLATE_TEXT_LIMIT, parseTemplateMessages, serializeTemplateMessages } from '../../src/utils/messageTemplate'

// Only text messages can be sent from a template today; the other actions in the design need sending support first.
const UNSUPPORTED_ACTIONS = [
  { icon: 'image', title: '圖片訊息' },
  { icon: 'carousel', title: '輪播訊息' },
  { icon: 'input', title: '用戶輸入' },
  { icon: 'bell', title: '訂閱通知' },
]
const UNSUPPORTED_HINT = '目前範本只支援文字訊息'

function MessagingTemplateEditPage() {
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : null
  const { data, loading } = useQuery(MESSAGE_TEMPLATES, { skip: !id })
  const [createTemplate] = useMutation(CREATE_MESSAGE_TEMPLATE)
  const [updateTemplate] = useMutation(UPDATE_MESSAGE_TEMPLATE)
  const { alerts, pushAlert, dismissAlert } = useAlerts()

  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('')
  const [messages, setMessages] = useState([''])
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)
  const existing = id ? data?.messageTemplates?.find((template) => template.id === id) : null

  const [loadedId, setLoadedId] = useState(null)

  // Fill the form once per template, so a background refetch can't overwrite what is being typed.
  useEffect(() => {
    if (!existing || loadedId === existing.id) return
    setLoadedId(existing.id)
    setName(existing.name)
    setPlatform(existing.platform)
    const texts = parseTemplateMessages(existing.contents)
    setMessages(texts.length ? texts : [''])
  }, [existing, loadedId])

  if (!router.isReady || (id && loading && !data)) return <div className='flex justify-center pt-[96px]'><Loading /></div>
  if (id && !existing) {
    return (
      <div className='flex flex-col items-center gap-[16px] pt-[96px] text-grayscale'>
        <p className='m-0'>找不到這個範本，可能已被刪除。</p>
        <Button title='返回列表' color='grayscale' onClick={() => router.push('/messaging-template')} />
      </div>
    )
  }

  const nameError = touched && !name.trim() ? '請輸入範本名稱' : ''
  const platformError = touched && !platform ? '請選擇平台' : ''
  const tooLong = messages.some((text) => text.length > TEMPLATE_TEXT_LIMIT)
  const emptyMessage = touched && messages.some((text) => !text.trim())

  const updateMessage = (index, text) => setMessages((current) => current.map((value, i) => (i === index ? text : value)))
  const removeMessage = (index) => setMessages((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current))

  const save = async () => {
    setTouched(true)
    if (!name.trim() || !platform || tooLong || messages.some((text) => !text.trim())) return
    setSaving(true)
    const input = { name: name.trim(), category: existing?.category || 'general', platform, contents: serializeTemplateMessages(messages) }
    try {
      if (existing) await updateTemplate({ variables: { id: existing.id, input }, refetchQueries: [{ query: MESSAGE_TEMPLATES }], awaitRefetchQueries: true })
      else await createTemplate({ variables: { input }, refetchQueries: [{ query: MESSAGE_TEMPLATES }], awaitRefetchQueries: true })
      router.push('/messaging-template')
    } catch (err) {
      setSaving(false)
      pushAlert('error', `無法儲存範本：${err.message}`)
    }
  }

  return (
    <div className='template-editor'>
      <aside className='template-editor-side'>
        <div className='template-editor-side-name'>
          <input aria-label='範本名稱' placeholder='未命名範本' value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </div>
        {nameError && <p className='template-editor-error px-[12px]'>{nameError}</p>}
        <label className='template-editor-platform'>
          <span>選擇平台</span>
          <select value={platform} onChange={(event) => setPlatform(event.target.value)} aria-invalid={Boolean(platformError)}>
            <option value='' disabled>請選擇一個平台</option>
            {TEMPLATE_PLATFORMS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {platformError && <p className='template-editor-error px-[12px]'>{platformError}</p>}
        <div className='template-editor-side-actions'>
          <Button title='返回' color='grayscale' disabled={saving} onClick={() => router.push('/messaging-template')} />
          <Button title={saving ? '儲存中…' : '儲存'} disabled={saving} onClick={save} />
        </div>
      </aside>

      <section className='template-editor-canvas' aria-label='訊息內容'>
        <h2 className='template-editor-title'><img src='/design/ui/edit-title.svg' alt='' width={24} height={24} /><span className='truncate'>{name.trim() || '未命名範本'}</span></h2>

        <ol className='template-editor-messages'>
          {messages.map((text, index) => (
            <li key={index} className='template-editor-message'>
              <div className='template-editor-message-tools'>
                <button type='button' aria-label='刪除這則訊息' title={messages.length === 1 ? '至少要有一則訊息' : '刪除這則訊息'} disabled={messages.length === 1} onClick={() => removeMessage(index)}>
                  <img src='/design/ui/delete-gray.svg' alt='' width={24} height={24} />
                </button>
              </div>
              <div className={`template-editor-bubble ${text.length > TEMPLATE_TEXT_LIMIT || (emptyMessage && !text.trim()) ? 'template-editor-bubble-invalid' : ''}`}>
                <textarea aria-label={`第 ${index + 1} 則文字訊息`} placeholder='輸入訊息內容' rows={3} value={text} onChange={(event) => updateMessage(index, event.target.value)} />
                <span className={`template-editor-count ${text.length > TEMPLATE_TEXT_LIMIT ? 'template-editor-count-over' : ''}`}>{text.length}/{TEMPLATE_TEXT_LIMIT}</span>
              </div>
            </li>
          ))}
        </ol>
        {emptyMessage && <p className='template-editor-error'>訊息內容不能空白</p>}
        {tooLong && <p className='template-editor-error'>{`每則訊息最多 ${TEMPLATE_TEXT_LIMIT} 字`}</p>}

        <h3 className='template-editor-subtitle'>新增動作</h3>
        <div className='template-editor-actions' role='group' aria-label='新增動作'>
          <button type='button' onClick={() => setMessages((current) => [...current, ''])}>
            <img src='/design/ui/action-text.svg' alt='' width={24} height={24} />文字訊息
          </button>
          {UNSUPPORTED_ACTIONS.map(({ icon, title }) => (
            <button key={icon} type='button' disabled aria-label={title} title={UNSUPPORTED_HINT}>
              <img src={`/design/ui/action-${icon}.svg`} alt='' width={24} height={24} />{title}
            </button>
          ))}
        </div>
        <p className='template-editor-note'>{UNSUPPORTED_HINT}，其他動作尚未開放。</p>
      </section>
      <AlertStack alerts={alerts} onDismiss={dismissAlert} />
    </div>
  )
}

export default MessagingTemplateEditPage
