import React from 'react'
import PropTypes from 'prop-types'

/**
 * Shown when a list or page has nothing in it yet.
 */
function EmptyState({ title, description, children }) {
  return (
    <div className='empty-state'>
      <span className='empty-state-icon' aria-hidden='true'>
        <svg width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M3 13.5 5.6 5.9A2 2 0 0 1 7.5 4.5h9a2 2 0 0 1 1.9 1.4L21 13.5' />
          <path d='M3 13.5V18a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 18v-4.5h-5.25a.75.75 0 0 0-.7.48 3.25 3.25 0 0 1-6.1 0 .75.75 0 0 0-.7-.48H3Z' />
        </svg>
      </span>
      <p className='empty-state-title'>{title}</p>
      {description && <p className='empty-state-description'>{description}</p>}
      {children}
    </div>
  )
}

EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  children: PropTypes.node,
}

EmptyState.defaultProps = {
  description: null,
  children: null,
}

export default EmptyState
