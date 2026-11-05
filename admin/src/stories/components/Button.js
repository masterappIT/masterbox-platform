import React from 'react';
import PropTypes from 'prop-types';

/**
 * Primary UI component for user interaction
 *
 * @param { Element } startElement element
 * @param { Element } endElement element
 * @param { String } title string
 * @param { String } id string
 * @param { String } variant oneOf_'text', 'contained', 'outlined'
 * @param { String } color oneOf_'primary', 'secondary', 'tertiary','quaternary','alert','grayscale','grayLight'
 * @param { String } rounded oneOf_'none','small', 'normal', 'large'
 * @param { String } size 'normal' follows the design; 'large' keeps the sign-in page's original 12px button
 * @param { Bool } disabled the button can't be activated
 * @param { String } hint tooltip, e.g. why the button is disabled
 * @param { Element,String } customStyles oneOfType([PropTypes.string, PropTypes.object]),
 * @param { Func } onClick func
 */
function Button({ startElement, endElement, title, id, variant, color, rounded, size, disabled, hint, customStyles, onClick }) {
  const isTailwind = typeof customStyles === 'string';
  const activate = (event) => {
    if (!disabled && onClick) onClick(event);
  };
  const onKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    activate(event);
  };

  return (
    <div
      id={id}
      role='button'
      aria-label={title}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      title={hint}
      className={`button button-size-${size} button-${variant}-${color} button-rounded-${rounded} ${startElement ? 'button-with-icon' : ''} ${disabled ? 'button-disabled' : ''} ${isTailwind ? customStyles : ''}`}
      style={!isTailwind ? { ...customStyles } : {}}
      onClick={activate}
      onKeyDown={onKeyDown}
    >
      {startElement}
      <div>{title}</div>
      {endElement}
    </div>
  );
}

Button.propTypes = {
  title: PropTypes.string,
  color: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary', 'alert', 'grayscale', 'grayLight']),
  variant: PropTypes.oneOf(['text', 'contained', 'outlined']),
  id: PropTypes.string,
  rounded: PropTypes.oneOf(['none', 'small', 'normal', 'large']),
  size: PropTypes.oneOf(['small', 'normal', 'large']),
  disabled: PropTypes.bool,
  hint: PropTypes.string,
  startElement: PropTypes.element,
  endElement: PropTypes.element,
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onClick: PropTypes.func,
};

Button.defaultProps = {
  title: 'Button',
  color: 'primary',
  variant: 'contained',
  id: null,
  rounded: 'normal',
  size: 'normal',
  disabled: false,
  hint: undefined,
  startElement: null,
  endElement: null,
  customStyles: null,
  onClick: null,
};

export default Button;
