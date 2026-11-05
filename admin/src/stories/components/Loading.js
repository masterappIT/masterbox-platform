import React from 'react'
import PropTypes from 'prop-types'

/**
 * Loading ring. The design's sits in the bottom right corner of the screen (`corner`);
 * inside a card or table it goes under the header instead.
 */
function Loading({ title, corner }) {
  return (
    <div className={`loading ${corner ? 'loading-corner' : ''}`} role='status' aria-live='polite'>
      <span className='loading-ring' aria-hidden='true' />
      <span className='loading-title'>{title}</span>
    </div>
  )
}

Loading.propTypes = {
  title: PropTypes.string,
  corner: PropTypes.bool,
}

Loading.defaultProps = {
  title: '載入中',
  corner: false,
}

export default Loading
