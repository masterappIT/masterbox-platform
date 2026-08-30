import React, { useState } from 'react'

function GroupNotificationsPage() {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  return <main className='p-8'><h1 className='text-2xl font-semibold'>群發工具</h1><section className='mt-6 max-w-2xl rounded border bg-white p-5'><label htmlFor='broadcast-message' className='block text-sm text-gray-600'>訊息內容</label><textarea id='broadcast-message' value={message} onChange={(event) => { setMessage(event.target.value); setSent(false) }} rows='5' className='mt-2 w-full rounded border p-2' placeholder='輸入要發送的訊息' /><button type='button' disabled={!message.trim()} onClick={() => setSent(true)} className='mt-4 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50'>預覽群發</button>{sent && <p className='mt-3 text-green-700'>已建立群發預覽（測試模式）。</p>}</section></main>
}

export default GroupNotificationsPage
