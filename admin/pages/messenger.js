/* eslint-disable no-unused-expressions */
import React, { useState, useEffect, useMemo } from "react";

//components
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
  const [selectedChatroomID, setSelectedChatroomID] = useState(0);




  // 點擊channels找chatrooms
  useEffect(() => {
    // console.log('index_chatrooms', '點擊channels找chatrooms')

    if (channels.length) {

      dispatch(findChatsRooms({
        findChatsRoomInput: {
          channel_id: channels[selectedChannel]?.account,
          platform: channels[selectedChannel]?.platform,
        },
        paginationInput: paginationInput,
      }))

    }
  }, [selectedChannel])



  // 當下選的channel內容
  const currentChannel = useMemo(() => {
    // console.log('index_chatrooms', '當下選的channel內容')

    return channels[selectedChannel]

  }, [selectedChannel])




  // 當下選的chatroom內容
  const currentChatroom = useMemo(() => {

    if (chatrooms) {

      const currentChannelsChatrooms = chatrooms.find(chatRoom => chatRoom.chat_room_id === selectedChatroomID)
      return currentChannelsChatrooms
    }
    return []

  }, [selectedChatroomID])





  const selectChatroom = (id) => {
    const { platform, channel_id, chat_room_id } = chatrooms.find(chatRoom => chatRoom.chat_room_id === id)

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
    return conversationsInfo

  }, [selectedChatroomID, messages])




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
          channels={channels}
          chatrooms={chatrooms}
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