import React from 'react';
import PropTypes from 'prop-types';

/**
 * Primary UI component for user interaction
 */
function List({ children, customStyles, onClick }) {

  const isTailwind = typeof customStyles === 'string';

  return (
    <ul className={`list ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>

      {children}


    </ul>
  );
};

List.propTypes = {
  children: PropTypes.any,
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
  onClick: PropTypes.func,
}

List.defaultProps = {
  children: null,
  customStyles: null,
  onClick: null,
}

export default List