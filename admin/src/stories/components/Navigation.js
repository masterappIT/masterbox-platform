import React from 'react';
import PropTypes from 'prop-types';
import Avatar from './Avatar';
import ContentText from './ContentText';
import Notice from './Badge';
import ListItem from './ListItem';
import Badge from './Badge';
import List from './List';
import Icon from './Icon';

/**
 * Primary UI component for user interaction
 */
function Navigation({ items, componentHandler, setCurrentComponent }) {
  const currentComponent = componentHandler.current

  // console.log('componentHandler', componentHandler)
  
  return (
    <div className='navigation' key={componentHandler.current}>
      <div className='navigation-bar'>
        {items.map(({ icon, title }, index) => {
          return (
            <div key={index} className={`navigation-bar-item`} onClick={() => setCurrentComponent(icon)}>

              <Icon name={icon} size='large' customStyles={componentHandler.current === icon ?{filter: 'invert(85%) sepia(39%) saturate(3654%) hue-rotate(331deg) brightness(103%) contrast(101%)'}:{}} />

              <ContentText title={title} color={`${componentHandler.current === icon ? 'primary' : 'black-tertiary'}`} />
            </div>
          )
        })}
      </div>
    </div>
  );
};

Navigation.propTypes = {
  items: PropTypes.array,

  // title: PropTypes.string,
  // contentShow: PropTypes.bool,
  // content: PropTypes.string,
  // contentIcon: PropTypes.element,
  // endElement: PropTypes.element,
}

Navigation.defaultProps = {

  items: [
    {
      icon: "client",
      title: "聯絡人",
    },
    {
      icon: "messenger",
      title: "聊天",
    },

    {
      icon: "setting",
      title: "設定",
    },
    // {
    //   icon: "language",
    //   title: "繁體中文",
    // },
    // {
    //   icon: "signout",
    //   title: "登出",
    // },
  ],
  // title: 'navigation',
  // contentShow: true,
  // content: 'AccountID',
  // contentIcon: null,
  // endElement: null,
}

export default Navigation;


{/* <div className={`navigation ${customStyles} `}>
      <Avatar />
      <div className='account-info-box'>
        <ContentText title={title} size='large' />
        {contentShow &&
          <div className='account-state'>
            {contentIcon}
            <ContentText color='black-secondary' title={content} size='small'/>
          </div>
        }
      </div>
      <div className='navigation-endElement'>{notice?<Notice title={notice} />:endElement}</div>
    </div> */}
