import React from 'react';
import PropTypes from 'prop-types';
import Headline from '../../stories/components/Headline';
import ImageBox from '../../stories/components/ImageBox';
import ContentText from '../../stories/components/ContentText';
import Popup from '../../stories/components/Popup';
import Card from '../../stories/components/Card';

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


function PopupChannel({ platforms, isShow, onClick }) {

  return (
    <Popup isShow={isShow ? true : false} onClick={onClick} size='normal'>
      <div className='w-full h-full flex flex-col items-center justify-center '>
        <Headline title='選擇一個社群平台' size='large' />
        <ContentText title='選擇一個的社群平台，開使您的品牌社群經營' size='large' color='black-tertiary' customStyles='mt-[15px] mb-[24px]' />
        <div className='flex space-x-[48px]'>
          {platforms.map(({ name }, i) => {
            return (
              <Card  key={name + i} isHover={true} rounded={true} shadow='primary'>
                <div key={name + i} className='w-[152px] h-[142px] flex flex-col justify-center items-center space-y-[12px] cursor-pointer'>
                  <ImageBox src={`/svg/${name}.svg`} />

                  <Headline title={name} />
                </div>
              </Card>

            )


          })}

        </div>

      </div>
    </Popup>
  );
};

PopupChannel.propTypes = {
  onClick: PropTypes.func,
  isShow: PropTypes.bool,
  platforms: PropTypes.array,
}

PopupChannel.defaultProps = {
  isPopup: false,
  onClick: null,
  platforms: [
    {
      name: "Meta",
      icon: "Meta",
    },
    {
      name: "Wechat",
      icon: "Wechat",
      value: "Wechat"
    },
    {
      name: "Line",
      icon: "line",
      value: "line"
    },
  ],

}

export default PopupChannel