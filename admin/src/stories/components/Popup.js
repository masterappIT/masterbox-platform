import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Primary UI component for user interaction
 */
function Popup({ children, isShow, customStyles, onClick, size, label }) {
  const isTailwind = typeof customStyles === 'string';

  useEffect(() => {
    if (!isShow) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClick(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isShow, onClick]);

  return (
    <div className={`popup ${isShow ? '' : 'popup-hidden'}`} onClick={() => onClick(false)}>
      <div className={`popup-item popup-item-${size}`} role='dialog' aria-modal='true' aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className={`popup-item-child-${size} ${isTailwind ? customStyles : ''}`} style={!isTailwind ? { ...customStyles } : {}}>
          {children}
          <button type='button' className='popup-item-child-icon' aria-label='關閉' onClick={() => onClick(false)}>
            <img src='/svg/closeBtn.svg' alt='' />
          </button>
        </div>
      </div>
    </div>
  );
}

Popup.propTypes = {
  children: PropTypes.node,
  size: PropTypes.oneOf(['small', 'normal', 'large', 'fit']),
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onClick: PropTypes.func,
  isShow: PropTypes.bool,
  label: PropTypes.string,
};

Popup.defaultProps = {
  children: null,
  size: 'normal',
  customStyles: null,
  onClick: null,
  isShow: false,
  label: undefined,
};

export default Popup;
