import React from 'react';
import PropTypes from 'prop-types';

/**
 * Primary UI component for user interaction
 */
function Linebar({   color,border}) {
  return (
    <div className={`linebar linebar-${border} linebar-${color}`} ></div>
  );
};

Linebar.propTypes = {
  border: PropTypes.oneOf(['light', 'normal', 'bold']),
  color:PropTypes.oneOf(['normal']),
}

Linebar.defaultProps = {
  border: 'normal',
  color: 'normal',
}

export default Linebar