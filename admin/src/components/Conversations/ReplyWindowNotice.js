import React from 'react'
import PropTypes from 'prop-types'
import { replyWindowNotice } from '../../utils/replyWindow'

// A line above the message box saying whether Meta still lets the agent reply, and until when.
function ReplyWindowNotice({ window, platform, now, action }) {
  const { tone, text, detail } = replyWindowNotice(window, platform, now)
  return (
    <div className={`reply-window reply-window-${tone}`} role={tone === 'info' ? 'status' : 'alert'}>
      <div className='reply-window-text'>
        <span>{text}</span>
        {detail && <small>{detail}</small>}
      </div>
      {action}
    </div>
  )
}

ReplyWindowNotice.propTypes = {
  window: PropTypes.shape({ state: PropTypes.string.isRequired, closesAt: PropTypes.number, templateRequired: PropTypes.bool, humanAgentAvailable: PropTypes.bool }).isRequired,
  platform: PropTypes.string,
  now: PropTypes.number.isRequired,
  action: PropTypes.node,
}

export default ReplyWindowNotice
