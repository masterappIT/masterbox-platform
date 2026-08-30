import React from 'react';
import PropTypes from 'prop-types';

/**
 * Primary UI component for user interaction
 * 
 * @param { String } startElement element
 * @param { Element } endElement element
 * @param { String } title string
 * @param { String } id string
 * @param { Bool } variant oneOf_'text', 'contained', 'outlined'
 * @param { String } color oneOf_'primary', 'secondary', 'tertiary','quaternary','alert','grayscale','grayLight']),
 * @param { String } rounded oneOf_'none','small', 'normal', 'large'
 * @param { Element,String } customStyles oneOfType([PropTypes.string, PropTypes.object]),
 * @param { Func } onClick func
 *
 */


function Button({ startElement, endElement, title,id,variant, color, rounded, customStyles, onClick }) {
  const isTailwind = typeof customStyles === 'string';
//   const colorVariants = {
//     'text': '_light',
//     'contained':'_light',
//     'outlined': '_light',
// };
//   const actionVariants = {
//     'text': '_dark',
//     'contained':'_dark',
//     'outlined': '_dark',
// };
// const hoverColor=`hover:bg-${color+colorVariants[variant]}`
// const actionColor=`active:bg-${color+actionVariants[variant]}`
  return (
    <div key={color} id={id} className={`button button-${variant}-${color}  button-rounded-${rounded} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
    {/* <div key={color} id={id} className={`button button-${variant}-${color} ${hoverColor}  ${actionColor} button-rounded-${rounded} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}> */}
    {/* <div className={`button button-${variant}-${color} hover:bg-primary_dark button-rounded-${rounded} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}> */}
    {/* <div className={`button button-${variant}-${color} ${hoverColor} button-rounded-${rounded} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}> */}
    {/* <div className={`button button-${variant}-${color} hover:button-hover-${variant}-${color} button-rounded-${rounded} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}> */}
      {startElement}
      <div className="">{title}</div>
      {endElement}
    </div>
  );
};

Button.propTypes = {
  title: PropTypes.string,
  color: PropTypes.oneOf(['primary', 'secondary', 'tertiary','quaternary','alert','grayscale','grayLight']),
  // border: PropTypes.oneOf(['light', 'normal', 'bold']),
  variant: PropTypes.oneOf(['text', 'contained', 'outlined']),
  id: PropTypes.string,
  rounded: PropTypes.oneOf(['none','small', 'normal', 'large']),
  startElement: PropTypes.element,
  endElement: PropTypes.element,
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
  onClick: PropTypes.func,
}

Button.defaultProps = {
  title: 'Button',
  color: 'primary',
  // border:'light',
  variant:'contained',
  id:null,
  rounded: 'normal',
  startElement: null,
  endElement: null,
  customStyles: null,
  onClick: null,
}

export default Button