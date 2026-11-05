import React from 'react'
import PropTypes from 'prop-types'
import ContentText from '../../stories/components/ContentText';
import Button from '../../stories/components/Button';

// The chat room list clamps text to two lines; status text must show in full.
const unclamped = { WebkitLineClamp: 'unset', textAlign: 'center' };

// Explains why the home page has nothing to show yet, and what to do next.
function StatusMessage({ title, description, action, compact }) {
  return (
    <div className='flex flex-col items-center px-[24px]'>
      <ContentText title={title} size='large' color='primary' customStyles={unclamped} />
      {!compact && description ? <ContentText title={description} color='black-tertiary' customStyles={{ ...unclamped, marginTop: '8px' }} /> : ''}
      {!compact && action ? <Button title={action.title} onClick={action.onClick} customStyles={{ marginTop: '16px' }} /> : ''}
    </div>
  );
}

StatusMessage.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  action: PropTypes.shape({ title: PropTypes.string, onClick: PropTypes.func }),
  compact: PropTypes.bool,
}

StatusMessage.defaultProps = {
  title: '',
  description: '',
  action: null,
  compact: false,
}

export default StatusMessage
