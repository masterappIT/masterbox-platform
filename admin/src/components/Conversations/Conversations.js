import React, { useState, useEffect, useRef } from "react";
import ChatroomItem from "../../stories/components/ChatroomItem";
import Bubble from "../../stories/components/Bubble";
import Button from "../../stories/components/Button";
import Icon from "../../stories/components/Icon";
// import ChatList from "../../stories/components/ChatList";
import Avatar from "../../stories/components/Avatar";
import MobileHeader from "../Messenger/MobileHeader";
import ContentText from "../../stories/components/ContentText";
import ChatBubble from "./ChatBubble";
import MessageInput from "./MessageInput ";
import { useDispatch } from "react-redux";
import { handleSendMessage, pushMessage } from "../../redux/slices/messagesSlices";
import { MessageFactory } from '../../utils/MessageFactory';

import { useTranslation } from "react-i18next";

//RFCP 快速建立component
const imgList = [
  { img: "emoji", action: "" },
  { img: "attach", action: "" },
];

function ActionIcon({ icon }) {
  return <Icon name={icon} customStyles='messenger-room-send-inputArea-iconArea-icon' />;
}

export default function Conversations({ isCustomerSideInfo, setIsCustomerSideInfo, currentComponent, isMobile, messages, currentChatroom, currentChannel, selectedChannel, channels, chatrooms, handlePushMessage }) {
  const bottomRef = useRef(null);

  const { t } = useTranslation();

  function moreInfoHandler() {
    setIsCustomerSideInfo(!isCustomerSideInfo)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
    isMobile && setIsCustomerSideInfo(false)
  }, [messages]);





  const customerInfo = currentChatroom?.users?.find(user => user.id !== currentChatroom.channel_id)
  const customerName = customerInfo ? `${customerInfo.first_name || ''}${customerInfo.last_name || ''}`.trim() : ''

  // console.log('currentChatroom', currentChatroom)



  return (
    <>
      <div className={`messenger-room ${isMobile && currentComponent !== 'conversations' ? 'hidden' : ''}`}>
        {currentChatroom ? (
          <>
            {!isMobile && <ChatroomItem
              title={customerName && customerName !== 'null' ? customerName : '沒有名字'}
              name={customerInfo?.avatar}
              customStyles={`messenger-room-client ${isMobile ? 'bg-primary' : ''}`}
              endElement={isMobile ? '' :
                <Icon name='moreinfo'
                  size='medium'
                  onClick={moreInfoHandler}
                  customStyles='cursor-pointer'
                />}
              contentShow={false}
            />}

            <div className={`messenger-room-messages `}>


              {messages && messages.length && messages.map(({ channel_id, sender, contents, createdAt, platform }, i) =>
                <>
                  <ChatBubble key={contents.mid + i + contents.text} contents={platform === 'whatsapp' ? contents?.text?.body : contents?.text} showAvatar={channel_id !== sender.replaceAll('"', '')} name={customerInfo.avatar} time={createdAt} justifyItem={channel_id === sender.replaceAll('"', '') ? 'end' : 'start'} />
                </>
              )}


              <div ref={bottomRef} />
            </div>

            <MessageInput handlePushMessage={(message) => handlePushMessage(currentChatroom.chat_room_id, message, customerInfo.id)} isMobile={isMobile} />
          </>
        ) : (
          <div className="messenger-room-messages-null">
            <Icon name='chatBox' customStyles={{ width: '50px', height: '36px' }} />
            <ContentText title={t('start_a_conversation')} size='large' color='primary' customStyles='mt-[12px]' />
          </div>
        )
        }


      </div>
    </>
  );
}
