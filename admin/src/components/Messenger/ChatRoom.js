import React, { useEffect, useState, useMemo } from "react";
import PropTypes from 'prop-types'

import ChatroomItem from "../../stories/components/ChatroomItem";
import Icon from "../../stories/components/Icon";
import ChatroomList from "./ChatroomList";
import ChannelsList from "./ChannelsList";
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
  channels: PropTypes.array,
  chatrooms: PropTypes.array,
}

ChatRoom.defaultProps = {
  allChannels: false,
  listProps: {},
  channels: [],
  chatrooms: [],
}

export default ChatRoom
