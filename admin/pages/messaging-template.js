import React, { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { MESSAGE_TEMPLATES, CREATE_MESSAGE_TEMPLATE, DELETE_MESSAGE_TEMPLATE } from '../src/graphQL/messageTemplate'

function MessagingTemplatePage() {
  const { data, loading, error } = useQuery(MESSAGE_TEMPLATES)
  const [createTemplate] = useMutation(CREATE_MESSAGE_TEMPLATE, { refetchQueries: [{ query: MESSAGE_TEMPLATES }] })
  const [deleteTemplate] = useMutation(DELETE_MESSAGE_TEMPLATE, { refetchQueries: [{ query: MESSAGE_TEMPLATES }] })
  const [name, setName] = useState('')
  const [contents, setContents] = useState('')
  const [platform, setPlatform] = useState('fb')
  const templates = data?.messageTemplates || []
  const addTemplate = async (event) => {
    event.preventDefault()
    if (!name.trim() || !contents.trim()) return
    await createTemplate({ variables: { input: { name: name.trim(), category: 'general', platform, contents: JSON.stringify({ text: contents.trim() }) } } })
    setName(''); setContents('')
  }
  return <main className='p-8'><h1 className='text-2xl font-semibold'>訊息範本</h1><form onSubmit={addTemplate} className='mt-6 max-w-2xl space-y-2 rounded border bg-white p-5'><input value={name} onChange={(event) => setName(event.target.value)} placeholder='範本名稱' className='w-full rounded border p-2' /><textarea value={contents} onChange={(event) => setContents(event.target.value)} placeholder='範本內容' rows='3' className='w-full rounded border p-2' /><div className='flex gap-2'><select value={platform} onChange={(event) => setPlatform(event.target.value)} className='rounded border p-2'><option value='fb'>Facebook</option><option value='ig'>Instagram</option><option value='whatsapp'>WhatsApp</option><option value='line'>LINE</option><option value='wechat'>WeChat</option></select><button type='submit' disabled={!name.trim() || !contents.trim()} className='rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50'>新增範本</button></div></form>{loading && <p className='mt-6 text-gray-500'>載入中…</p>}{error && <p className='mt-6 text-red-600'>無法載入範本：{error.message}</p>}<ul className='mt-6 max-w-2xl divide-y rounded border bg-white'>{!loading && !templates.length && <li className='p-4 text-gray-500'>尚無訊息範本</li>}{templates.map((template) => <li key={template.id} className='flex items-center justify-between p-4'><div><p className='font-medium'>{template.name}</p><p className='text-sm text-gray-500'>{template.platform} · {template.contents}</p></div><button type='button' onClick={() => deleteTemplate({ variables: { id: template.id } })} className='text-red-600'>刪除</button></li>)}</ul></main>
}

export default MessagingTemplatePage
