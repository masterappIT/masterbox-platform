import React, { useMemo, useState } from 'react'

const flow = [
  { file: 'firstTime.svg', title: '首次使用', action: '開始設定', description: '先連接社群平台，開始使用即時訊息。' },
  { file: '連接完成.svg', title: '連接平台', action: '選擇平台', description: '選擇要接收訊息的社群平台。' },
  { file: '連接完成-1.svg', title: '確認連接', action: '確認連接', description: '確認平台後完成連接。' },
  { file: '進入聊天室.svg', title: '進入聊天室', action: '進入聊天室', description: '選擇聊天室查看客戶訊息。' },
  { file: '用戶資訊.svg', title: '查看用戶資訊', action: '查看用戶資訊', description: '從聊天室開啟用戶資訊。' },
  { file: '詳細.svg', title: '查看詳細資訊', action: '完成', description: '查看完整的用戶詳細資訊。' },
]

export default function ChatroomFlowPage() {
  const [step, setStep] = useState(0)
  const [completed, setCompleted] = useState([])
  const current = flow[step]
  const progress = useMemo(() => `${step + 1} / ${flow.length}`, [step])

  const next = () => {
    setCompleted((items) => items.includes(step) ? items : [...items, step])
    if (step < flow.length - 1) setStep((value) => value + 1)
  }
  const previous = () => setStep((value) => Math.max(0, value - 1))
  const restart = () => { setStep(0); setCompleted([]) }

  return (
    <main className='chatroom-flow'>
      <header className='chatroom-flow-header'>
        <div><h1>即時訊息</h1><p>依照流程完成平台連接並進入聊天室</p></div>
        <button className='chatroom-flow-restart' onClick={restart}>重新開始</button>
      </header>
      <nav className='chatroom-flow-steps' aria-label='即時訊息流程'>
        {flow.map((item, index) => <button key={item.file} className={`${index === step ? 'active' : ''} ${completed.includes(index) ? 'completed' : ''}`} onClick={() => setStep(index)}><span>{completed.includes(index) ? '✓' : index + 1}</span>{item.title}</button>)}
      </nav>
      <section className='chatroom-flow-content'>
        <div className='chatroom-flow-stage'><img src={`/design/chatroom/${encodeURIComponent(current.file)}`} alt={`${current.title}畫面設計`} /></div>
        <aside className='chatroom-flow-guide'><span className='chatroom-flow-count'>{progress}</span><h2>{current.title}</h2><p>{current.description}</p><div className='chatroom-flow-guide-actions'><button onClick={previous} disabled={step === 0}>上一步</button><button className='primary' onClick={next}>{current.action}{step < flow.length - 1 ? ' →' : ''}</button></div></aside>
      </section>
    </main>
  )
}
