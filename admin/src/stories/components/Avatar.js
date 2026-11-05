import React from 'react';
import PropTypes from 'prop-types';

/**
 * @param { String } img photo URL
 * @param { String } name a photo URL or the person's name
 * @param { String } size oneOf_'mini','small','normal', 'medium', 'large'
 * @param { Bool } rounded Bool
 * @param { Bool } border Bool
 * @param { String } customStyles
 * @param { Function } onClick Func
 */
function Avatar({ img, name, size, rounded, border, customStyles, onClick }) {
  const isTailwind = typeof customStyles === 'string';
  const photo = img || (/^https?:\/\//.test(name || '') ? name : null);
  // Without a photo, show the first letter here rather than sending the name to an avatar service.
  const initial = String(name || '').trim().charAt(0).toUpperCase();

  return (
    <div className={`avatar avatar-${size} overflow-hidden ${rounded ? 'rounded-[50%]' : ''} ${border ? 'avatar-border' : ''} ${isTailwind ? customStyles : ''}`} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
      {photo
        ? <img className='avatar-img' src={photo} alt='' />
        : <span className='avatar-initial' aria-hidden='true'>{initial}</span>}
    </div>
  );
}

Avatar.propTypes = {
  img: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.oneOf(['mini', 'small', 'normal', 'medium', 'large']),
  rounded: PropTypes.bool,
  border: PropTypes.bool,
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onClick: PropTypes.func,
};

Avatar.defaultProps = {
  img: null,
  name: '',
  size: 'medium',
  rounded: true,
  border: false,
  customStyles: null,
  onClick: null,
};

export default Avatar;
