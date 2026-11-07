import React from 'react'
import PropTypes from 'prop-types'

// What each state shows (Figma Admin/空白狀態); the page fills in the text where it depends on who is looking.
const KINDS = {
  no_channels: { icon: '/design/chat/empty-link.svg', title: '還沒有連接頻道', description: '連接 Facebook、Instagram 或 WhatsApp 後，客戶的訊息會出現在這裡。' },
  no_chatrooms: { icon: '/design/chat/empty-inbox.svg', title: '還沒有對話', description: '客戶傳訊息進來後會出現在這裡。' },
  no_matches: { icon: '/design/chat/empty-search.svg', title: '沒有符合的對話', description: '換個關鍵字，或清除篩選條件。' },
  failed: { icon: '/design/chat/empty-alert.svg', title: '對話載入失敗', description: '請檢查網路後再試一次；已載入的內容會先保留。', alert: true },
  no_room: { icon: '/design/chat/empty-chatbox.svg', title: '選擇一段對話', description: '從左側列表選擇客戶，就能查看訊息和回覆。' },
}

/** Why there is nothing to show yet, and what to do about it: an icon, a title, a line and maybe a button. */
function ChatEmptyState({ kind, title, description, action }) {
  if (kind === 'loading') {
    return <p className='px-[24px] py-[32px] text-center text-[13px] text-text-tertiary' role='status'>{title || '載入中…'}</p>
  }
  const preset = KINDS[kind]
  return (
    <div className='flex w-[320px] max-w-full flex-col items-center gap-[12px] px-[24px] py-[32px] text-center'>
      <span className={`flex size-[64px] items-center justify-center rounded-full ${preset.alert ? 'bg-feedback-alert-soft' : 'bg-brand-primary-soft'}`}>
        <img src={preset.icon} alt='' width={28} height={28} />
      </span>
      <p className='text-[16px] font-bold leading-[1.4] text-text-primary'>{title || preset.title}</p>
      {(description ?? preset.description) && <p className='text-[13px] leading-[1.5] text-text-secondary'>{description ?? preset.description}</p>}
      {action && (
        <button type='button' className='rounded-[8px] bg-brand-primary px-[16px] py-[8px] text-[13px] font-medium leading-[1.4] text-text-on-primary hover:bg-brand-primary-dark' onClick={action.onClick}>
          {action.title}
        </button>
      )}
    </div>
  )
}

ChatEmptyState.propTypes = {
  kind: PropTypes.oneOf(['loading', 'no_channels', 'no_chatrooms', 'no_matches', 'failed', 'no_room']).isRequired,
  // Replace the preset's text, such as asking an admin when the agent can't connect channels.
  title: PropTypes.string,
  description: PropTypes.string,
  action: PropTypes.shape({ title: PropTypes.string.isRequired, onClick: PropTypes.func.isRequired }),
}

ChatEmptyState.defaultProps = {
  title: null,
  description: undefined,
  action: null,
}

export default ChatEmptyState
