import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import List from '../../stories/components/List';
import ChatroomItem from '../../stories/components/ChatroomItem';
import ContentText from '../../stories/components/ContentText';
import ListItem from '../../stories/components/ListItem';
import Icon from '../../stories/components/Icon';
import Headline from '../../stories/components/Headline';
import Checkbox from '../../stories/components/Checkbox';
import { useTranslation } from "react-i18next";


function ChatroomList({ isMobile, chatRoomsList, componentHandler, setCurrentComponent, selectChatroom, setSelectedConversations, unClick }) {
  const currentComponent = componentHandler.current;

  const { t } = useTranslation();

  const handleOnClick = (id) => {
    // if (!unClick) {
    setCurrentComponent('conversations')
    selectChatroom(id)
    // }

  }


  return (
    <>
      <label className={`${isMobile && currentComponent === 'messenger' ? 'mt-[45px]' : ''} container  flex py-[14px] px-[24px] space-x-[8px] bg-bg_secondary`}>
        <Checkbox content={t('show_unread_only')} labelColor='black-primary' />
      </label>
      {/* <ListItem endElement={<Icon
        customStyles={`${arrowRotate ? 'rotate-180 transition-all duration-250' : 'rotate-0 transition-all duration-250'}`}
        title='uparrow'
        size='small'
        onClick={chatRoomsList.andler}
      />}
        customStyles='h-[55px] '
      >
        <Headline title='用戶' customStyles='flex-1' />
      </ListItem> */}





      <List customStyles={`messenger-list-chatroom ${(isMobile && currentComponent === 'client') ? 'messenger-list-chatroom-clientItem' : 'messenger-list-chatroom-otherItem'}`}>
        {(chatRoomsList && chatRoomsList.length) ? chatRoomsList.map(({ channel_id, chat_room_id, platform, users }, i) => {

          let customer = users.find(user => user.id !== channel_id)
          let userName = `${(customer.first_name && customer.first_name) + (customer.last_name && customer.last_name)}`

          return (
            <div
              key={i}
              onClick={() => handleOnClick(chat_room_id)}
            >
              <ChatroomItem key={i} isMobile={isMobile} title={userName !== 'null' ? userName : '沒有名字'} name={customer.avatar} contentIcon={null} content={`ID : ${customer.id}`} notice={null} customStyles={{ padding: '10px 16px', cursor: 'pointer' }} />
            </div>
          )
        }) :
          <div className='w-full flex items-center justify-center mt-[70px]'>
            <ContentText size='large' title={t('no_user_found')} />
          </div>
        }


      </List>




    </>
  );

}

ChatroomList.propTypes = {
  // title: PropTypes.string,
  // variant: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary']),
  // customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  // onClick: PropTypes.func,
}

ChatroomList.defaultProps = {
  // title: 'Input',
  // color: 'primary',
  // customStyles: null,
  // onClick: null,
}

export default ChatroomList
