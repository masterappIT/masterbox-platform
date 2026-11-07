import React from 'react'
import PropTypes from 'prop-types'

// The three kinds of limits, each always shown the same way (Figma Admin/限制提示).
const KINDS = {
  // The platform doesn't allow it right now, such as WhatsApp after 24 hours: why, and what to use instead.
  platform: { box: 'bg-brand-primary-soft', icon: '/design/chat/alert-warning.svg', role: 'alert' },
  // The agent isn't allowed: who can do it.
  permission: { box: 'bg-surface-page', icon: '/design/chat/lock.svg', role: 'status' },
  // The live connection dropped and is coming back.
  connection: { box: 'bg-feedback-info-soft', icon: '/design/chat/alert-info.svg', role: 'status' },
}

/** A limit on replying, just above the message box. */
function ChatNotice({ kind, title, detail, action }) {
  const { box, icon, role } = KINDS[kind]
  return (
    <div className={`flex items-center gap-[12px] rounded-[12px] px-[16px] py-[12px] ${box}`} role={role}>
      <img src={icon} alt='' width={20} height={20} className='shrink-0' />
      <div className='flex min-w-0 flex-1 flex-col gap-[2px]'>
        <p className='text-[14px] font-medium leading-[1.4] text-text-primary'>{title}</p>
        {detail && <p className='text-[13px] leading-[1.5] text-text-secondary'>{detail}</p>}
      </div>
      {action && (
        <button type='button' className='shrink-0 whitespace-nowrap rounded-[8px] bg-brand-primary px-[14px] py-[6px] text-[13px] font-medium leading-[1.4] text-text-on-primary hover:bg-brand-primary-dark disabled:opacity-60' onClick={action.onClick} disabled={action.disabled}>
          {action.title}
        </button>
      )}
    </div>
  )
}

ChatNotice.propTypes = {
  kind: PropTypes.oneOf(['platform', 'permission', 'connection']).isRequired,
  title: PropTypes.string.isRequired,
  detail: PropTypes.string,
  action: PropTypes.shape({ title: PropTypes.string.isRequired, onClick: PropTypes.func.isRequired, disabled: PropTypes.bool }),
}

ChatNotice.defaultProps = {
  detail: null,
  action: null,
}

export default ChatNotice
