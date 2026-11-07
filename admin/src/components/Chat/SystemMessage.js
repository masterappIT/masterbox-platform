import React from 'react'
import PropTypes from 'prop-types'

/** A centred line among the messages (Figma Admin/系統訊息): a day's date, or an event such as the reply window closing. */
function SystemMessage({ kind, children }) {
  const isDate = kind === 'date'
  return (
    <div className='flex w-full justify-center' role={isDate ? 'separator' : 'note'}>
      <span className={`rounded-full px-[12px] py-[4px] text-center text-[12px] leading-[1.4] text-text-secondary ${isDate ? 'bg-surface-card font-medium' : 'bg-border-default'}`}>
        {children}
      </span>
    </div>
  )
}

SystemMessage.propTypes = {
  kind: PropTypes.oneOf(['date', 'event']),
  children: PropTypes.node.isRequired,
}

SystemMessage.defaultProps = {
  kind: 'date',
}

export default SystemMessage
