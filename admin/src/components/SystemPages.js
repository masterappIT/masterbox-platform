import React from 'react'
import { useRouter } from 'next/router'
import Button from '../stories/components/Button'

export function NotFoundView() {
  const router = useRouter()
  const goBack = () => {
    if (window.history.length > 1) router.back()
    else router.replace('/')
  }

  return (
    <main className='system-404'>
      <img className='system-404-circle system-404-circle-large' src='/design/system/circle-large.svg' alt='' />
      <img className='system-404-circle system-404-circle-medium' src='/design/system/circle-medium.svg' alt='' />
      <img className='system-404-circle system-404-circle-small' src='/design/system/circle-small.svg' alt='' />
      <img className='system-404-robot' src='/design/system/robot-404.png' alt='' />
      <div className='system-404-content'>
        <img className='system-404-code' src='/design/system/404.svg' alt='404' />
        <h1>PAGE NOT FOUND</h1>
        <p>Sorry, this page isn&apos;t available. The link you followed may be broken, or the page may have been removed.</p>
        <Button title='返回上一頁' startElement={<img src='/design/ui/arrow-go-back.svg' alt='' width={20} height={20} />} onClick={goBack} />
      </div>
    </main>
  )
}

export function ServerErrorView() {
  return (
    <main className='system-500'>
      <img className='system-500-code' src='/design/system/500-text.svg' alt='500 Error' width={168} height={27} />
      <img className='system-500-robot' src='/design/system/robot-500.svg' alt='' />
      <h1>很抱歉！伺服器碰上意外情況</h1>
      <p>您可以嘗試清除瀏覽器的緩存及Cookie後，再重新讀取一次</p>
      <Button title='重新讀取' color='grayscale' startElement={<img src='/design/ui/reload.svg' alt='' width={20} height={20} />} onClick={() => window.location.reload()} />
    </main>
  )
}

// For features that aren't available yet.
export function ComingSoonView() {
  return (
    <main className='system-coming-soon'>
      <img src='/design/system/coming-soon.png' alt='Coming soon' width={290} height={290} />
      <p className='empty-state-description'>這項功能正在準備中，開放後會顯示在這裡。</p>
    </main>
  )
}
