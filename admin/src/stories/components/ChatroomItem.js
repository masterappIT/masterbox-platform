import React from 'react';
import PropTypes from 'prop-types';
import Avatar from './Avatar';
import ContentText from './ContentText';
import Notice from './Badge';
import ListItem from './ListItem';
import Badge from './Badge';
import List from './List';

/**
 * Primary UI component for user interaction
 */
function ChatroomItem({ contentIcon, content, contentShow, endElement, title, name,color, customStyles, notice, isMobile }) {
  let setColor
  color==='primary' 
  let endIcon = <div className='ChatroomItem-endElement'>{notice ? <Notice title={notice} /> : endElement}</div>
  return (
    <ListItem
      customStyles={customStyles}
      startElement={<Avatar customStyles='ChatroomItem-avatar' name={name} size={isMobile ? 'normal' : 'normal'} />} endElement={endIcon} >
      <div className='flex-1'>
        {/* <List customStyles={{ flexDirection: 'column', justifyContent: 'start', alignItems: 'start' }}> */}
        <ContentText title={title} size='large' color={`${color==='primary'?'black-primary':'white'}`}/>
        {/* 這裡原本是用ListItem因為報錯li不能在li裏面所以暫時改List */}
        <List customStyles={{ padding: 0, textOverflow: 'ellipsis' }}>
          <List customStyles={{ flexDirection: 'row', justifyContent: 'start', alignItems: 'start' }}>
            {contentIcon}
            {contentShow && <ContentText color={`${color==='primary'?'black-secondary':'white'}`} title={content} size='small' customStyles={{ padding: 0 }} />}
          </List>
        </List>
      </div>
      {/* </List> */}
    </ListItem>

  );
};

ChatroomItem.propTypes = {
  title: PropTypes.string,
  contentShow: PropTypes.bool,
  content: PropTypes.string,
  contentIcon: PropTypes.element,
  endElement: PropTypes.element,
  avatarSize: PropTypes.oneOf(['small', 'medium', 'large']),
  color:PropTypes.oneOf(['primary', 'secondary']),
}

ChatroomItem.defaultProps = {
  title: 'ChatroomItem',
  contentShow: true,
  content: 'AccountID',
  contentIcon: null,
  endElement: null,
  avatarSize: null,
  color:'primary'
}

export default ChatroomItem;


{/* <div className={`ChatroomItem ${customStyles} `}>
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
      <div className='ChatroomItem-endElement'>{notice?<Notice title={notice} />:endElement}</div>
    </div> */}
