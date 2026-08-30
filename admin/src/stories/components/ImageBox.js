import React from 'react';
import PropTypes from 'prop-types';

/**
 * Primary UI component for user interaction
 */
function ImageBox({ src , customStyles, onClick }) {
  const isTailwind = typeof customStyles === 'string';

  return (
    <div  className={`imageBox  ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
      <img 
      className='imageImg'
      src={`${src}`}
      // src={`/svg/${name}.svg`}/>

      />
    </div>
  );
};

ImageBox.propTypes = {
  src: PropTypes.string.isRequired,
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
  onClick: PropTypes.func,
}

ImageBox.defaultProps = {
  src: '/img/messenger/logo.svg',
  customStyles: null,
  onClick: null,
}

export default ImageBox