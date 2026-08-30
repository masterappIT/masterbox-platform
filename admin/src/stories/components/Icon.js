import React from 'react';
import PropTypes from 'prop-types';

/**
 * Primary UI component for user interaction
 */
// function Icon({ name, size , customStyles, onClick}) {
//   const iconsrc=`/svg/${name}.svg`;
//   const icon = require(iconsrc);

//   const isTailwind = typeof customStyles === 'string';

//   return (
//     <div  className={`icon icon-${size} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
//       <img 
//       className='iconImg'
//       src={`/svg/${name}.svg`}/>
//       {icon}
//     </div>
//   );
// };
function Icon({ name, size ,color, customStyles, onClick}) {
  const isTailwind = typeof customStyles === 'string';

  return (
    <div  className={`icon icon-${size} icon-color-${color} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
      <img 
      className='iconImg'
      src={`/svg/${name}.svg`}/>
    </div>
  );
};

Icon.propTypes = {
  name: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['mini','small', 'medium', 'large','login']),
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
  onClick: PropTypes.func,
  color:PropTypes.oneOf(['primary', 'secondary']),

}

Icon.defaultProps = {
  name: 'send',
  size: 'medium',
  customStyles: null,
  onClick: null,
  color:null,

}

export default Icon