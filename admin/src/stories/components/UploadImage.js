import React from 'react';
import PropTypes from 'prop-types';

//components

import Button from './Button';
import ContentText from './ContentText';
import Headline from './Headline';
import Avatar from './Avatar';

/**
 * @param { String } title string
 * @param { String } name string
 * @param { Element } children element
 * @param { Element,String } customStyles oneOfType:string,object
 * @param { String } description string
 * @param { Func } onClick func
 * @param { String } size oneOf_'mini','small','normal', 'medium', 'large'
 * @param { bool } border bool
 * @param { Bool } rounded bool
 */

function UploadImage({title, name, customStyles, isMobile,description,onClick,size,rounded,border,img}) {

    const isTailwind = typeof customStyles === 'string';
  
    return (
      <div>
            {title ? <Headline size='small' title={title} color='black-primary' /> : ''}
            <div className='flex content-center'>
                <div>
                  {/* {img ? <Avatar customStyles='' name={name} size={size} /> : <Avatar customStyles='' name={name} size={size} /> } */}

                  <Avatar customStyles='mr-[24px]' name={name} size={size} img={img} />
                    {/* <div className={`upload upload-${size} overflow-hidden mr-[24px]  ${rounded && 'rounded-[50%]'} ${border && 'upload-border'} ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}}>
                    <img
                      className='upload upload-add'
                      src={`/svg/upload-add.svg`} />
                    </div> */}
                </div>
                <div>
                    <Button  customStyles='mt-[14px]' color='grayscale' title='上傳照片'/>
                </div>
            </div>
            <div>
                {description ? <ContentText title={description} size='small' color='black-tertiary' customStyles='mt-[6px] pl-[2px]' /> : ''}
            </div>
            
      </div>
    );
  };
  
  UploadImage.propTypes = {
    title: PropTypes.string,
    name: PropTypes.string,
    children: PropTypes.any,
    customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
    description: PropTypes.string,

    onClick: PropTypes.func,
    size: PropTypes.oneOf(['mini', 'small', 'normal', 'medium', 'large']),
    border: PropTypes.bool,
    rounded: PropTypes.bool,

  }
  
  UploadImage.defaultProps = {
    title: null,
    name: null,
    children: null,
    customStyles: null,
    description: null,
    onClick: null,
    size: 'medium',
    border: false,
    rounded: true,
  }
  
  export default UploadImage