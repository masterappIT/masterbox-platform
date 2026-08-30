import React from 'react';
import PropTypes from 'prop-types';
import Button from './Button';
import Icon from './Icon';

function Taglabel({ title, onClick, customStyles }) {

  const isTailwind = typeof customStyles === 'string';


  return (
    // <Button size='small' title={title} customStyles={{ padding: '4px 6px', height: '20px', width: 'fit-content',cursor: 'default' }} variant='outlined' endElement={<Icon name='closeBtn' size='small' customStyles={{cursor: 'pointer'}} onClick={onClick}/>} />
    // <Button size='small' title={title} customStyles={{ padding: '4px 6px', height: '20px', width: 'fit-content',cursor: 'default' }} variant='outlined' endElement={<Icon name='closeBtn' size='small' customStyles={{cursor: 'pointer'}} onClick={(e)onClick}/>} />
    <div className={`tagLabel  ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}} onClick={onClick}>
      <div className="">{title}</div>
      <Icon name='closeBtnSmall' size='small' customStyles={{ cursor: 'pointer' ,marginLeft: '5px' }} onClick={onClick} />
    </div>
  );
};

Taglabel.propTypes = {
  title: PropTypes.string,
  onClick: PropTypes.func,
}

Taglabel.defaultProps = {
  title: 'Button',
  onClick: null,
}

export default Taglabel