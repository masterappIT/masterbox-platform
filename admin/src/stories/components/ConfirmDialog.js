import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import Popup from './Popup'
import Button from './Button'

// Asks before something that can't be undone. Focus starts on cancel, the safe choice.
function ConfirmDialog({ isShow, title, description, confirmTitle, confirmColor, busy, onConfirm, onCancel }) {
  const actions = useRef(null)

  useEffect(() => {
    if (isShow) actions.current?.querySelector('[role="button"]')?.focus()
  }, [isShow])

  if (!isShow) return null

  return (
    <Popup isShow onClick={() => { if (!busy) onCancel() }} size='fit' label={title}>
      <div className='confirm-dialog'>
        <h2 className='confirm-dialog-title'>{title}</h2>
        {description ? <p className='confirm-dialog-description'>{description}</p> : null}
        <div className='confirm-dialog-actions' ref={actions}>
          <Button title='取消' color='grayscale' disabled={busy} onClick={onCancel} />
          <Button title={busy ? '處理中…' : confirmTitle} color={confirmColor} disabled={busy} onClick={onConfirm} />
        </div>
      </div>
    </Popup>
  )
}

ConfirmDialog.propTypes = {
  isShow: PropTypes.bool,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  confirmTitle: PropTypes.string,
  confirmColor: PropTypes.string,
  busy: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

ConfirmDialog.defaultProps = {
  isShow: false,
  description: '',
  confirmTitle: '刪除',
  confirmColor: 'alert',
  busy: false,
}

export default ConfirmDialog
