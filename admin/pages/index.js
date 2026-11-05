/* eslint-disable no-unused-expressions */
import React, { useState, useEffect, useMemo } from "react";

import ChatRoom from "../src/components/Messenger/ChatRoom";
import Conversations from "../src/components/Conversations/Conversations";
import CustomerSideInfo from "../src/components/Messenger/CustomerSideInfo";
import CustomerDetailInfo from "../src/components/Messenger/CustomerDetailInfo";
// import Navigation from "../src/stories/components/navigation";
import MobileNavigation from "../src/components/Messenger/MobileNavigation";
import MobileHeader from "../src/components/Messenger/MobileHeader";
import MobileSetting from "../src/components/Messenger/MobileSetting";
import MobileSettingDetail from "../src/components/Messenger/MobileSettingDetail";
import { useSelector, shallowEqual } from "react-redux";
import StatusMessage from "../src/components/Messenger/StatusMessage";
import { getUserSubscribedChannels, selectChannels, selectChannelsStatus, findChatsRooms, selectChatRooms, selectChatRoomsStatus, getChatRoomsMessages, selectMessages } from '../src/redux/slices/messagesSlices';
import { hashMapDataExtractor } from '../src/utils/utils';
import Button from '../src/stories/components/Button';
import { useMutation } from "@apollo/client";
import { LOGIN } from "../src/graphQL/account";
import { apolloApiHelpers } from "../src/graphQL";
import { handleLogin, selectUserToken, selectUserInfo } from '../src/redux/slices/userSlices';
import { selectCompanyInfo } from '../src/redux/slices/companySlices';
import { useDispatch } from 'react-redux';
import { updateCompanyInfo, fetchCompanyInfo } from '../src/redux/slices/companySlices';
import { MessageFactory } from '../src/utils/MessageFactory';
import { handleSendMessage } from '../src/redux/slices/messagesSlices';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';


const NO_CHATROOMS = [];

export default function Messenger() {
  const [isCustomerSideInfo, setIsCustomerSideInfo] = useState(false);
  const [isCustomerDetailInfo, setIsCustomerDetailInfo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileHeader, setIsMobileHeader] = useState(true);
  const [componentHandler, setComponentHandler] = useState({
    history: 'setting',//client,messenger
    current: 'client',
  });
  const dispatch = useDispatch();
  const router = useRouter();
  const { t } = useTranslation();


  function setCurrentComponent(current) {
    const newComponentHandler = { ...componentHandler }
    newComponentHandler.current = current
    newComponentHandler.history = componentHandler.current
    setComponentHandler(
      newComponentHandler
    )

  }

  const unShow = ['client']
  const handleCheckDevice = () => {
    if (window.innerWidth >= 640) {
      setIsMobile(false)
      setIsCustomerSideInfo(false)
      setIsCustomerDetailInfo(false)
    }
    else
      setIsMobile(true)
  }


  const channels = useSelector(selectChannels);//這是陣列
  const storedChatrooms = useSelector(selectChatRooms);//這是陣列
  const chatrooms = Array.isArray(storedChatrooms) ? storedChatrooms : NO_CHATROOMS;
  const messages = useSelector(selectMessages, shallowEqual);
  const channelsStatus = useSelector(selectChannelsStatus);
  const chatRoomsStatus = useSelector(selectChatRoomsStatus);
  const userInfo = useSelector(selectUserInfo);
  const isAdmin = String(userInfo?.role || '').toLowerCase() === 'admin';
  const hasChannels = channels.length > 0;

  // Persisted statuses describe an earlier visit, so only trust them once this visit has asked.
  const [channelsRequested, setChannelsRequested] = useState(false);
  const [chatRoomsRequested, setChatRoomsRequested] = useState(false);


  const [paginationInput, setPaginationInput] = useState({
    page: 0,
    limit: 10
  }
  )


  // 剛進來找channels
  const fetchChannels = () => {
    setChannelsRequested(true)
    dispatch(getUserSubscribedChannels(paginationInput))
  }

  useEffect(() => {
    fetchChannels()
  }, []);

  const [selectedChannel, setSelectedChannel] = useState(0);
  const [selectedChatroomID, setSelectedChatroomID] = useState(null);

  // A refreshed channel list may be shorter than the one the selection came from.
  useEffect(() => {
    if (selectedChannel >= channels.length && selectedChannel !== 0) setSelectedChannel(0)
  }, [channels.length, selectedChannel])




  // 點擊channels找chatrooms
  const fetchChatrooms = () => {
    setChatRoomsRequested(true)
    dispatch(findChatsRooms({
      findChatsRoomInput: {
        channel_id: channels[selectedChannel]?.account,
        platform: channels[selectedChannel]?.platform,
      },
      paginationInput: paginationInput,
    }))
  }

  useEffect(() => {
    // console.log('index_chatrooms', '點擊channels找chatrooms')

    if (hasChannels) fetchChatrooms()
  }, [hasChannels, selectedChannel])



  // 當下選的channel內容
  const currentChannel = useMemo(() => {
    // console.log('index_chatrooms', '當下選的channel內容')

    return channels[selectedChannel]

  }, [selectedChannel, channels])




  // 當下選的chatroom內容
  const currentChatroom = useMemo(() => {

    return chatrooms.find(chatRoom => chatRoom.chat_room_id === selectedChatroomID) || null

  }, [selectedChatroomID, chatrooms])



  // Cached data is shown while refreshing or after a failed refresh; without it, say what is going on.
  const homeStatus = useMemo(() => {
    if (!hasChannels) {
      if (!channelsRequested || channelsStatus === 'loading' || channelsStatus === 'idle') return 'loading'
      return channelsStatus === 'failed' ? 'failed' : 'no_channels'
    }
    if (chatrooms.some(chatRoom => chatRoom.channel_id === currentChannel?.account)) return 'ready'
    if (!chatRoomsRequested || chatRoomsStatus === 'loading' || chatRoomsStatus === 'idle') return 'loading'
    return chatRoomsStatus === 'failed' ? 'failed' : 'no_chatrooms'
  }, [hasChannels, channelsRequested, channelsStatus, chatrooms, currentChannel, chatRoomsRequested, chatRoomsStatus])

  const homeStatusMessage = {
    loading: { title: t('home_loading') },
    failed: { title: t('home_load_failed'), description: t('home_load_failed_hint'), action: { title: t('retry'), onClick: hasChannels ? fetchChatrooms : fetchChannels } },
    no_channels: isAdmin
      ? { title: t('no_channel_connected'), description: t('connect_channel_hint'), action: { title: t('go_to_channels_management'), onClick: () => router.push('/channels-management') } }
      : { title: t('no_channel_connected'), description: t('connect_channel_ask_admin') },
    no_chatrooms: { title: t('no_conversations_yet'), description: t('no_conversations_hint') },
  }[homeStatus]





  const selectChatroom = (id) => {
    const room = chatrooms.find(chatRoom => chatRoom.chat_room_id === id)
    if (!room) return
    const { platform, channel_id, chat_room_id } = room

    let getChatRoomsMessagesData =
    {
      getChatRoomsMessagesInput: {
        platform: platform,
        channel_id: channel_id,
        chat_room_id: chat_room_id
      },
      paginationInput: paginationInput,
    }
    // console.log('index_getChatRoomsMessagesData', getChatRoomsMessagesData)

    dispatch(getChatRoomsMessages(getChatRoomsMessagesData))

    setSelectedChatroomID(id)

  }



  const currentConversation = useMemo(() => {

    const conversationsInfo = messages[`${currentChannel?.platform}-${currentChannel?.account}-${selectedChatroomID}`]
    return conversationsInfo || []

  }, [selectedChatroomID, messages, currentChannel])




  useEffect(() => {
    window.addEventListener('resize', handleCheckDevice);
    window.onload = handleCheckDevice();
    return () => { window.removeEventListener('resize', handleCheckDevice) }
  }, []);



  useEffect(() => {
    const showHeader = unShow.filter(e => e.includes(componentHandler.current));

    if (showHeader.length > 0) {
      setIsMobileHeader(false)
    } else {
      setIsMobileHeader(true)
    }
  }, [componentHandler, isMobileHeader, unShow]);






  // const conversationsInfo = messages[`${currentChannel?.platform}-${currentChannel?.account}-${selectedConversations?.chat_room_id}`]




  const [chatPeopleInfo, setChatPeopleInfo] = useState({});
  const [chatPeopleTags, setChatPeopleTags] = useState({});

  useEffect(() => {
    let chatPeople = {
      用戶名稱: "用戶名稱",
      綁定帳號: "usermail@gmail.com",
      訂閱狀態: true,
      手機號碼: "0912345678",
    };
    const peopleTags = ["首購", "六十天", "親子"];
    setChatPeopleInfo(chatPeople);
    setChatPeopleTags(peopleTags);
  }, []);

  function pressHandler(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.target.value != "") {
        let tagValue = e.target.value;
        setChatPeopleTags([...chatPeopleTags, tagValue]);
        e.target.value = "";
      }
    }
  }
  function subscriptionHandler() {
    setChatPeopleInfo({ ...chatPeopleInfo, 訂閱狀態: !chatPeopleInfo.訂閱狀態 });
  }
  function sideInfoHandler() {
    setIsCustomerDetailInfo(true);
  }
  function deleteTag(e) {
    let filterItem = e.target.parentElement.parentElement.firstChild.innerHTML
    let newTags = []
    newTags = chatPeopleTags.filter(function (tag) {
      return tag !== filterItem
    });
    setChatPeopleTags(newTags)
    // console.log('tagtag', newTags)
  }

  function handlePushMessage(to_chat_room_id, message, recipient) {

    const { account, platform } = currentChannel

    console.log('push message', message, recipient)
    // let sendMessages;
    // if (platform === 'whatsapp') {
    //    sendMessages = {
    //     "preview_url": false | true,
    //     "recipient_type": "individual",
    //     "to": recipient,
    //     "type": "text",
    //     "text": {
    //       "body": message.text
    //     }
    //   }
    // }else{
    //   sendMessages={ message: message, recipient: recipient }
    // }

    const data = new MessageFactory(to_chat_room_id, platform, account).createContents({ message: message, recipient: recipient });

    // Rejects when the message wasn't sent, so the input can keep it and show why.
    return dispatch(handleSendMessage(data)).unwrap()

    // dispatch(pushMessage({ channelId: currentChannel.id, chatRoomId: messages.id, message: contents }))


  }







  return (
    <>
      <div className="messenger">
        {(isMobile && isMobileHeader !== false) ? <MobileHeader variant='secondary' componentHandler={componentHandler} setCurrentComponent={setCurrentComponent} currentChatroom={currentChatroom} /> : ''}
        {chatrooms ? <ChatRoom
          // key={selectedChannel}
          currentComponent={componentHandler.current}
          selectedChannel={selectedChannel}
          setSelectedChannel={setSelectedChannel}
          selectedChatroomID={selectedChatroomID}
          selectChatroom={selectChatroom}
          setSelectedChatroomID={setSelectedChatroomID}
          componentHandler={componentHandler}
          setCurrentComponent={setCurrentComponent}
          isMobile={isMobile}
          channels={channels}
          chatrooms={chatrooms}
          channelPlaceholder={homeStatus === 'loading' || homeStatus === 'failed' ? homeStatusMessage.title : null}
          emptyContent={homeStatusMessage ? <StatusMessage {...homeStatusMessage} compact={!isMobile} /> : null}
        /> : ''}
        <Conversations
          key={selectedChatroomID}
          isCustomerSideInfo={isCustomerSideInfo}
          setIsCustomerSideInfo={setIsCustomerSideInfo}
          componentHandler={componentHandler}
          currentComponent={componentHandler.current}
          isMobile={isMobile}
          messages={currentConversation}
          selectedChatroomID={selectedChatroomID}
          currentChannel={currentChannel}
          selectedChannel={selectedChannel}
          currentChatroom={currentChatroom}
          channels={channels}
          handlePushMessage={handlePushMessage}
          emptyContent={homeStatusMessage ? <StatusMessage {...homeStatusMessage} /> : null}
        />
        <CustomerSideInfo
          isCustomerSideInfo={isCustomerSideInfo}
          isCustomerDetailInfo={isCustomerDetailInfo}
          setIsCustomerSideInfo={setIsCustomerSideInfo}
          setIsCustomerDetailInfo={setIsCustomerDetailInfo}
          chatPeopleInfo={chatPeopleInfo}
          chatPeopleTags={chatPeopleTags}
          setChatPeopleInfo={setChatPeopleInfo}
          setChatPeopleTags={setChatPeopleTags}
          subscriptionHandler={subscriptionHandler}
          pressHandler={pressHandler}
          deleteTag={deleteTag}
        />
        <CustomerDetailInfo
          isCustomerDetailInfo={isCustomerDetailInfo}
          setIsCustomerDetailInfo={setIsCustomerDetailInfo}
          chatPeopleInfo={chatPeopleInfo}
          chatPeopleTags={chatPeopleTags}
          setChatPeopleInfo={setChatPeopleInfo}
          setChatPeopleTags={setChatPeopleTags}
          subscriptionHandler={subscriptionHandler}
          pressHandler={pressHandler}
          deleteTag={deleteTag}
        ></CustomerDetailInfo>
        {isMobile === true && componentHandler.current === 'setting' ? <MobileSetting /> : ''}
        {isMobile === true && componentHandler.current === 'settingDetail' ? <MobileSettingDetail /> : ''}
        {isMobile === true && componentHandler.current !== 'conversations' ? <MobileNavigation componentHandler={componentHandler} setCurrentComponent={setCurrentComponent} /> : ''}
      </div>
    </>
  );
}


  // const currentChatroomInfo = useMemo(() => {
  //   if (currentChatroom) {

  //     console.log('index_currentChatroomInfo123', currentChatroom)

  //     const customerInfo = currentChatroom.users.find(user => user.id !== currentChatroom.channel_id)

  //     const customerName = `${(customerInfo.first_name && customerInfo.first_name) + (customerInfo.last_name && customerInfo.last_name)}`

  //     return { 'customer': customerInfo, 'name': customerName }
  //   }

  // }, [currentChatroom])


  // console.log('index_currentChatroomInfo', currentChatroomInfo)