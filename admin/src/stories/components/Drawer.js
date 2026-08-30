import React from 'react';
import PropTypes from 'prop-types';
import Card from './Card';
/**
 * Primary UI component for user interaction
 */
function Drawer({ children,color,rounded,shadow, customStyles, onClick }) {
  const isTailwind = typeof customStyles === 'string';

  return (
    <div className={`drawer  ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
      <div className='drawer-item'>
        {children}
      </div>
    </div>
  );
};

Drawer.propTypes = {
  children:PropTypes.element,
  color: PropTypes.oneOf(['primary', 'secondary']),
  rounded: PropTypes.bool,
  shadow:PropTypes.oneOf(['primary', 'secondary', 'tertiary','quaternary','none']),
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
  onClick: PropTypes.func,
}

Drawer.defaultProps = {
  children:null,
  color: 'primary',
  rounded: false,
  shadow:'primary',
  customStyles: null,
  onClick: null,
}

export default Drawer