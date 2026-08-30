import React, { useState } from 'react'

function SettingPage() {
  const [saved, setSaved] = useState(false)
  return <main className='p-8'><h1 className='text-2xl font-semibold'>設定</h1><section className='mt-6 max-w-xl rounded border bg-white p-5'><label className='block text-sm text-gray-600' htmlFor='notification-email'>通知 Email</label><input id='notification-email' type='email' placeholder='admin@example.com' className='mt-2 w-full rounded border p-2' /><label className='mt-4 flex items-center gap-2'><input type='checkbox' defaultChecked /> 啟用系統通知</label><button type='button' className='mt-5 rounded bg-blue-600 px-4 py-2 text-white' onClick={() => setSaved(true)}>保存設定</button>{saved && <p className='mt-3 text-green-700'>設定已保存（測試模式）。</p>}</section></main>
}

export default SettingPage
