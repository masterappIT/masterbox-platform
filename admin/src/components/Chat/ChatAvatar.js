import React, { useState } from 'react'
import PropTypes from 'prop-types'

const SIZES = {
  32: 'size-[32px] text-[13px]',
  40: 'size-[40px] text-[16px]',
  64: 'size-[64px] text-[25.6px]',
}

/** The customer's photo, or the first character of their name on the brand's soft colour (Figma Admin/頭像). */
function ChatAvatar({ photo, name, size }) {
  const [isBroken, setIsBroken] = useState(false)
  const initial = String(name || '').trim().charAt(0).toUpperCase() || '?'
  const showPhoto = /^https?:\/\//.test(photo || '') && !isBroken
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-primary-soft font-bold leading-none text-brand-primary-dark ${SIZES[size]}`} aria-hidden='true'>
      {showPhoto ? <img src={photo} alt='' className='size-full object-cover' onError={() => setIsBroken(true)} /> : initial}
    </span>
  )
}

ChatAvatar.propTypes = {
  photo: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.oneOf([32, 40, 64]),
}

ChatAvatar.defaultProps = {
  photo: null,
  name: '',
  size: 40,
}

export default ChatAvatar
