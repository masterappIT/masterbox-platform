import React from 'react';
import PropTypes from 'prop-types';

/**
 * Primary UI component for user interaction
 * 
 */
/**
 * 
 * @param { String } img String
 * @param { Bool } name Bool
 * @param { String } size oneOf_'mini','small','normal', 'medium', 'large'
 * @param { String } rounded Bool
 * @param { String } border Bool
 * @param { String } customStyles 
 * @param { Function } onClick Func
 */

function Avatar({ img, name, size, rounded, border, customStyles, onClick }) {
  const isTailwind = typeof customStyles === 'string';

  const photo = name?.includes('https');

  return (
    <div className={`avatar avatar-${size} overflow-hidden  ${rounded && 'rounded-[50%]'} ${border && 'avatar-border'} ${img ? '' : 'bg-gray-300'}  ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
      <img
        className='avatar-img'
        src={photo ? name: img || `https://ui-avatars.com/api/?name=${name}&background=random`} />
    </div>
  );
};

Avatar.propTypes = {
  title: PropTypes.string,
  size: PropTypes.oneOf(['mini', 'small', 'normal', 'medium', 'large']),
  rounded: PropTypes.bool,
  border: PropTypes.bool,
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onClick: PropTypes.func,
}

Avatar.defaultProps = {
  title: null,
  size: 'medium',
  rounded: true,
  border: false,
  customStyles: null,
  onClick: null,
}

export default Avatar