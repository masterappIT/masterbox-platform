import React from 'react';
import PropTypes from 'prop-types';

/**
 * Primary UI component for user interaction
 * @param { Any } children any
 * @param { Boolean } isHover bool
 * @param { String } rounded bool
 * @param { String } shadow oneOf_primary', 'secondary', 'tertiary','quaternary','none'
 * @param { Element,String } customStyles oneOfType([PropTypes.string, PropTypes.object]),
 * @param { Func } onClick func
 *
 */
function Card({ children,isHover,rounded,shadow, customStyles, onClick }) {
  const isTailwind = typeof customStyles === 'string';

  return (
    <div  className={`card card${isHover?'-isHover':''} card${rounded?'-rounded':''} card-shadow-${shadow}  ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
      {children}
    </div>
  );
};

Card.propTypes = {
  children:PropTypes.any,
  isHover: PropTypes.bool,
  rounded: PropTypes.bool,
  shadow:PropTypes.oneOf(['primary', 'secondary', 'tertiary','quaternary','none']),
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
  onClick: PropTypes.func,
}

Card.defaultProps = {
  children:null,
  isHover: false,
  rounded: false,
  shadow:'none',
  customStyles: null,
  onClick: null,
}

export default Card