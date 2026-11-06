import React, { useEffect, useState, useMemo } from "react";
import PropTypes from 'prop-types'

import ChatroomItem from "../../stories/components/ChatroomItem";
import Icon from "../../stories/components/Icon";
import ListItem from "../../stories/components/ListItem";
import Headline from "../../stories/components/Headline";
import List from "../../stories/components/List";
import ContentText from "../../stories/components/ContentText";
import ChatroomList from "./ChatroomList";
import ChannelsList from "./ChannelsList";
import HeaderBar from "../../stories/components/HeaderBar";
import MobileHeader from "./MobileHeader";
import MobileSetting from "./MobileSetting";

// import SingleMessage from "./SingleMessage";
import { hashMapDataExtractor } from '../../utils/utils';

import { useTranslation } from 'react-i18next';




// listProps go to the conversation list as they are: filterBar, onLoadMore, hasMore, loadingMore, loadMoreFailed, showUnread, selectedId.
// allChannels lets the agent see every channel at once, as selectedChannel -1, with the list already filtered by the server.
function ChatRoom({ currentChannel, channels, chatrooms, clientList, componentHandler, setCurrentComponent, isMobile, selectedChannel, setSelectedChannel, selectChatroom,setSelectedChatroomID,setSelectedConversations, channelPlaceholder, emptyContent, allChannels, listProps }) {
  const [channelListVisitable, setChannelListVisitable] = useState(false);
  const currentComponent = componentHandler.current;
  const {t}=useTranslation()
  const isAllChannels = allChannels && selectedChannel === -1
  const shownChannel = isAllChannels ? { name: t('all_channels'), account: '' } : channels[selectedChannel]
  const chatRoomsList = useMemo(() => {

    if (allChannels) return chatrooms

    if (chatrooms.length) {

      const chatRoomsData = chatrooms.filter(chatRoom => chatRoom.channel_id === channels[selectedChannel]?.account)

      return chatRoomsData
    }
    return []

  }, [chatrooms, channels, selectedChannel, allChannels])

  return (
    <>
      {(isMobile !== true || (currentComponent === 'client' || currentComponent === 'messenger')) ?
        (<div className={`messenger-list ${isMobile && (currentComponent === 'client' || currentComponent === 'messenger') && 'messenger-list-mobile'}`}
        >
          {isMobile !== true || (isMobile && currentComponent === 'client') ? (
            <div className='messenger-list-channel'>
              <div
                onClick={() => setChannelListVisitable(!channelListVisitable)}
              >
                <ChatroomItem
                  isMobile={isMobile}
                  color={isMobile ? 'secondary' : 'primary'}
                  name={shownChannel && channels.length ? shownChannel.name : ''}
                  title={shownChannel && channels.length ? shownChannel.name : (channelPlaceholder || t('no_channel'))}
                  content={shownChannel && channels.length ? (shownChannel.account) : (channelPlaceholder ? '' : t('un_connected'))}
                  contentShow={!isAllChannels}
                  contentIcon={shownChannel?.platform ? <Icon name={shownChannel.platform} size='small' customStyles='mr-[6px] mt-[1px]' /> : null}
                  endElement={<Icon name='switch' size='large' color={isMobile ? 'secondary' : 'primary'} />}
                  customStyles={`messenger-list-channel-item ${isMobile && 'messenger-list-channel-item-mobile'}`}
                />
              </div>
              <ChannelsList setChannelListVisitable={setChannelListVisitable} setChannelData={(i) => setSelectedChannel(i)} channelList={channels} channelListVisitable={channelListVisitable} isMobile={isMobile} setSelectedChatroomID={setSelectedChatroomID} setSelectedConversations={setSelectedConversations} allChannels={allChannels}/>
            </div>)
            : ''}

          {/* mobile only 點擊會到個人簡介 */}
          {(isMobile && currentComponent === 'client') ?
            <ChatroomList isMobile={isMobile} componentHandler={componentHandler} setCurrentComponent={setCurrentComponent} chatRoomsList={chatRoomsList} selectChatroom={selectChatroom} setSelectedConversations={setSelectedConversations} unClick={true} emptyContent={emptyContent} {...listProps} /> : ''}

          {/* chat rooms list  */}
          {isMobile !== true || (isMobile && currentComponent === 'messenger') ?
            <ChatroomList isMobile={isMobile} componentHandler={componentHandler} setCurrentComponent={setCurrentComponent} chatRoomsList={chatRoomsList} selectChatroom={selectChatroom} setSelectedConversations={setSelectedConversations} emptyContent={emptyContent} {...listProps} /> : ''}

        </div>) : ''}
    </>
  );
}

ChatRoom.propTypes = {
  messageList: PropTypes.array,
  channels: PropTypes.array,
  clientList: PropTypes.array,
}

ChatRoom.defaultProps = {
  allChannels: false,
  listProps: {},
  channels: [
    {
      from: "Facebook",
      name: "帳號自訂義名稱",
      icon: "fb",
      id: "ID",
    },
    {
      from: "Line",
      name: "帳號自訂義名稱",
      icon: "line",
      id: "ID",
    },
    {
      from: "Instagram",
      name: "帳號自訂義名稱",
      icon: "ig",
      id: "ID",
    },
    {
      from: "Whatsapp",
      name: "帳號自訂義名稱",
      icon: "whatsapp",
      id: "ID",
    },
    {
      from: "Wechat",
      name: "帳號自訂義名稱",
      icon: "wechat",
      id: "ID",
    },
  ],
  messageList: [
    {
      headshot: "頭像",
      name: "Jack",
      content:
        "這是一段訊息，測試是否超過兩行，如果超過果超過兩行就...顯示",
      // unread: 1,
    },
    {
      headshot: "頭像",
      name: "Roy",
      content:
        "",
      unread: 2,
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "這是一段訊息，測試過兩行就...顯示這是一段訊息，測試是否超過兩",
      unread: 3,
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "這是一段訊息，測試是否超過兩行，如果超過兩行就...顯示這是一段訊息，行就",
      unread: 3,
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "這是一段訊息",
      unread: 3,
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "這是一段訊息，測試是否超，如果超過兩",
      unread: 3,
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "這是一段訊息，測試是否超過兩行，如果超過兩行就...顯示這是一段訊息，測試是否超過兩行，",
      unread: 3,
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "這是一段訊息，測試是否超過兩行，如果超過一段訊息，測果超過兩行",
      unread: 3,
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "這是一段訊息，測試是否超過兩行，如果超過兩行就...顯示這是一段訊息",
      unread: 3,
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "這是一段訊息，測試是否超過兩行，如果超過兩行段訊息，測試是否超過兩行，如果超過",
      unread: 3,
    },
  ],
  clientList: [
    {
      headshot: "頭像",
      name: "Jack",
      content:
        "這是一示",
    },
    {
      headshot: "頭像",
      name: "Roy",
      content:
        "",
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "這是一過兩",
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "這是一段行就",
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "這是一段訊息",
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "如果超過兩",
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "這是一段訊",
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "這是一段訊息",
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "345345345345",
    },
    {
      headshot: "頭像",
      name: "Olive",
      content:
        "12332123123123",
    },
  ]
}

export default ChatRoom
