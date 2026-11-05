import React from 'react'
import PropTypes from 'prop-types'

// Notices in the top right corner, under the header bar.
function AlertStack({ alerts, onDismiss }) {
  if (!alerts.length) return null
  return (
    <div className='alert-stack' aria-live='polite'>
      {alerts.map(({ id, type, message }) => (
        <div key={id} className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
          <img className='alert-icon' src={`/design/ui/alert-${type}.svg`} alt='' width={24} height={24} />
          <p className='alert-message'>{message}</p>
          <button type='button' className='alert-close' aria-label='關閉提示' onClick={() => onDismiss(id)}>
            <img src='/design/ui/alert-close.svg' alt='' width={12} height={12} />
          </button>
        </div>
      ))}
    </div>
  )
}

AlertStack.propTypes = {
  alerts: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.number, type: PropTypes.oneOf(['success', 'error']), message: PropTypes.string })).isRequired,
  onDismiss: PropTypes.func.isRequired,
}

export default AlertStack
