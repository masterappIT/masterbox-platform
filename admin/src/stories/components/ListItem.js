import React from 'react';
import PropTypes from 'prop-types';

/**
 * Primary UI component for user interaction
 */
function ListItem({ children, startElement, endElement, customStyles, onClick }) {

  const isTailwind = typeof customStyles === 'string';

  return (
    <li className={`list-item ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
        {startElement}
        {children}
        {endElement}
    </li>
  );
};

ListItem.propTypes = {
  startElement: PropTypes.element,
  endElement: PropTypes.element,
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
  onClick: PropTypes.func,
}


ListItem.defaultProps = {
  startElement: null,
  endElement: null,
  customStyles: null,
  onClick: null,
}

export default ListItem