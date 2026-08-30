import React from 'react';
import PropTypes from 'prop-types';
import List from './List';
import Timestamp from '../../components/Timestamp';
import Bubble from './Bubble';

/**
 * Primary UI component for user interaction
 */
function ChatList({ children, customStyles, onClick }) {

  const isTailwind = typeof customStyles === 'string';

  return (
    <div className={`chatList  ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
      <List >
        <div className="w-full flex justify-end items-end">
          <Timestamp title='123' />
          <Bubble title='123' />
        </div>
        {children}
      </List>
    </div>

  );
};

ChatList.propTypes = {
  children: PropTypes.element,
  side: PropTypes.oneOf(['custom', 'user']),
  customStyles: PropTypes.string,
  onClick: PropTypes.func,
}

ChatList.defaultProps = {
  children: null,
  side: 'custom',
  customStyles: null,
  onClick: null,
}

export default ChatList