import React from 'react';
import PropTypes from 'prop-types';

/**
 * Primary UI component for user interaction
 */
function Badge({ title, size, customStyles, onClick  }) {
  const isTailwind = typeof customStyles === 'string';

  return (
    <div  className={`badge badge-${size} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
      <span >{title}</span>
    </div>
  );
};

Badge.propTypes = {
  title: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['small', 'normal', 'large']),
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
  onClick: PropTypes.func,
}

Badge.defaultProps = {
  title: '10',
  size: 'normal',
  customStyles: null,
  onClick: null,
}

export default Badge