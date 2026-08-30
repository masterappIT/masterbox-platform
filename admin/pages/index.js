/* eslint-disable no-unused-expressions */
import React, { useState, useEffect, useMemo } from "react";

const DEMO_CHANNELS = [
  { platform: 'facebook', account: 'demo-facebook', name: 'MasterBox 粉絲專頁' },
  { platform: 'instagram', account: 'demo-instagram', name: 'MasterBox Instagram' },
]
const DEMO_CUSTOMER = { id: 'demo-customer-001', first_name: '王', last_name: '小明', avatar: '' }
const DEMO_CHATROOMS = [
  { platform: 'facebook', channel_id: 'demo-facebook', chat_room_id: 'demo-room-001', users: [{ id: 'demo-facebook' }, DEMO_CUSTOMER] },
  { platform: 'instagram', channel_id: 'demo-instagram', chat_room_id: 'demo-room-002', users: [{ id: 'demo-instagram' }, { ...DEMO_CUSTOMER, id: 'demo-customer-002', first_name: '陳', last_name: '小美' }] },
]
const DEMO_MESSAGES = {
  'facebook-demo-facebook-demo-room-001': [
    { channel_id: 'demo-facebook', sender: 'demo-customer-001', contents: { mid: 'demo-1', text: '您好，我想詢問商品的配送時間。' }, createdAt: '2026-08-29T06:30:00.000Z', platform: 'facebook' },
    { channel_id: 'demo-facebook', sender: 'demo-facebook', contents: { mid: 'demo-2', text: '您好！一般會在 2–3 個工作天內送達，請問還有其他需要協助的嗎？' }, createdAt: '2026-08-29T06:31:00.000Z', platform: 'facebook' },
  ],
  'instagram-demo-instagram-demo-room-002': [
    { channel_id: 'demo-instagram', sender: 'demo-customer-002', contents: { mid: 'demo-3', text: '請問現在有活動優惠嗎？' }, createdAt: '2026-08-29T06:35:00.000Z', platform: 'instagram' },
  ],
}

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
import { getUserSubscribedChannels, selectChannels, findChatsRooms, selectChatRooms, getChatRoomsMessages, selectMessages } from '../src/redux/slices/messagesSlices';
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
  const chatrooms = useSelector(selectChatRooms);//這是陣列
  const messages = useSelector(selectMessages, shallowEqual);
  const demoMode = !channels?.length || !chatrooms?.length;
  const displayChannels = demoMode ? DEMO_CHANNELS : channels;
  const displayChatrooms = demoMode ? DEMO_CHATROOMS : chatrooms;
  const [demoMessages, setDemoMessages] = useState(DEMO_MESSAGES);
  const displayMessages = demoMode ? demoMessages : messages;


  const [paginationInput, setPaginationInput] = useState({
    page: 0,
    limit: 10
  }
  )


  // 剛進來找channels
  useEffect(() => {
    dispatch(getUserSubscribedChannels(paginationInput))
  }, []);

  const [selectedChannel, setSelectedChannel] = useState(0);
  const [selectedChatroomID, setSelectedChatroomID] = useState('demo-room-001');

  useEffect(() => {
    if (!demoMode && selectedChatroomID === 'demo-room-001') setSelectedChatroomID(null)
  }, [demoMode, selectedChatroomID])




  // 點擊channels找chatrooms
  useEffect(() => {
    // console.log('index_chatrooms', '點擊channels找chatrooms')

    if (displayChannels.length) {

      dispatch(findChatsRooms({
        findChatsRoomInput: {
          channel_id: displayChannels[selectedChannel]?.account,
          platform: displayChannels[selectedChannel]?.platform,
        },
        paginationInput: paginationInput,
      }))

    }
  }, [selectedChannel])



  // 當下選的channel內容
  const currentChannel = useMemo(() => {
    // console.log('index_chatrooms', '當下選的channel內容')

    return displayChannels[selectedChannel]

  }, [selectedChannel, displayChannels])




  // 當下選的chatroom內容
  const currentChatroom = useMemo(() => {

    if (displayChatrooms) {

      const currentChannelsChatrooms = displayChatrooms.find(chatRoom => chatRoom.chat_room_id === selectedChatroomID)
      return currentChannelsChatrooms
    }
    return null

  }, [selectedChatroomID, displayChatrooms])





  const selectChatroom = (id) => {
    const room = displayChatrooms.find(chatRoom => chatRoom.chat_room_id === id)
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

    if (demoMode) {
      setSelectedChatroomID(id)
      return
    }
    dispatch(getChatRoomsMessages(getChatRoomsMessagesData))

    setSelectedChatroomID(id)

  }



  const currentConversation = useMemo(() => {

    const conversationsInfo = displayMessages[`${currentChannel?.platform}-${currentChannel?.account}-${selectedChatroomID}`]
    return conversationsInfo || []

  }, [selectedChatroomID, displayMessages, currentChannel])




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

    if (demoMode) {
      const key = `${platform}-${account}-${to_chat_room_id}`
      setDemoMessages((current) => ({
        ...current,
        [key]: [...(current[key] || []), { channel_id: account, sender: account, contents: { mid: `demo-${Date.now()}`, text: message.text }, createdAt: new Date().toISOString(), platform }],
      }))
      return
    }

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

    const res = dispatch(handleSendMessage(data))

    // console.log('handleSendMessage_RES', res)

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
          channels={displayChannels}
          chatrooms={displayChatrooms}
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