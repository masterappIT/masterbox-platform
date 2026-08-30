import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Card from './Card';
import Icon from './Icon';
/**
 * Primary UI component for user interaction
 */
function Popup({ children, isShow, customStyles, onClick, size }) {

  const isTailwind = typeof customStyles === 'string';

  return (
    <div className={`popup  ${isShow ? '' : 'popup-hidden'} `} onClick={() => onClick(false)}>
      <div className={`popup-item popup-item-${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`popup-item-child-${size} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}}>

          {children}
          <Icon name='closeBtn'
            onClick={() => onClick(false)}
            customStyles='popup-item-child-icon '
          />
        </div>
      </div>
    </div>
  );
};

Popup.propTypes = {
  children: PropTypes.node,
  size: PropTypes.oneOf(['small', 'normal', 'large', 'fit']),
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onClick: PropTypes.func,
  isShow: PropTypes.bool,
}

Popup.defaultProps = {
  children: null,
  size: 'normal',
  customStyles: null,
  onClick: null,
  isShow: false
}

export default Popup