import React from 'react'
import PropTypes from 'prop-types'

// Says plainly that a feature can't save or send yet, next to the control it disables.
function PendingNote({ children }) {
  return <p className='pending-note' role='note'>{children}</p>
}

PendingNote.propTypes = { children: PropTypes.node.isRequired }

export default PendingNote
