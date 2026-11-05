import React from 'react'
import Card from '../src/stories/components/Card'
import Button from '../src/stories/components/Button'
import Toggle from '../src/stories/components/Toggle'
import PendingNote from '../src/components/PendingNote'

const UNAVAILABLE = '設定功能尚未開放，目前無法儲存'

function SettingPage() {
  return (
    <div className='flex justify-center'>
      <Card rounded customStyles='user-form'>
        <div className='user-form-head'>
          <h2 className='user-form-title'>通知設定</h2>
          <Button title='儲存' disabled hint={UNAVAILABLE} />
        </div>
        <PendingNote>{`${UNAVAILABLE}，以下欄位僅供預覽。`}</PendingNote>
        <label className='user-form-select mt-[16px]'>
          <span>通知 Email</span>
          <input className='pending-input' type='email' placeholder='admin@example.com' disabled />
        </label>
        <div className='flex items-center justify-between gap-[16px] mt-[24px]'>
          <span className='text-[14px] leading-[20px] font-medium text-black_primary'>啟用系統通知</span>
          <Toggle status={0} label='啟用系統通知' disabled />
        </div>
      </Card>
    </div>
  )
}

export default SettingPage
