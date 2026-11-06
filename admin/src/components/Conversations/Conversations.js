import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
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

// Within this distance of the end still counts as being at the latest message.
const AT_BOTTOM_THRESHOLD_PX = 48;

function ActionIcon({ icon }) {
  return <Icon name={icon} customStyles='messenger-room-send-inputArea-iconArea-icon' />;
}

export default function Conversations({ isCustomerSideInfo, setIsCustomerSideInfo, currentComponent, isMobile, messages, currentChatroom, currentChannel, selectedChannel, channels, chatrooms, handlePushMessage, emptyContent }) {
  const messagesRef = useRef(null);
  const messagesListRef = useRef(null);
  // Whether new content should keep the view at the latest message. Each chat room starts here,
  // because the pages remount this component per room.
  const followLatestRef = useRef(true);
  const messageCountRef = useRef(0);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const hasChatroom = Boolean(currentChatroom);

  const { t } = useTranslation();

  function moreInfoHandler() {
    setIsCustomerSideInfo(!isCustomerSideInfo)
  }

  // Only moves the message area; scrollIntoView would also scroll the containers around it.
  function scrollToLatest() {
    followLatestRef.current = true;
    setHasNewMessages(false);
    const area = messagesRef.current;
    if (area) area.scrollTop = area.scrollHeight;
  }

  function handleMessagesScroll() {
    const area = messagesRef.current;
    const isAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight <= AT_BOTTOM_THRESHOLD_PX;
    followLatestRef.current = isAtBottom;
    if (isAtBottom) setHasNewMessages(false);
  }

  function handleSendMessage(message) {
    return handlePushMessage(currentChatroom.chat_room_id, message, customerInfo?.id).then((result) => {
      scrollToLatest();
      return result;
    });
  }

  useEffect(() => {
    isMobile && setIsCustomerSideInfo(false)
  }, [messages]);

  useLayoutEffect(() => {
    const count = messages?.length || 0;
    const hasMore = count > messageCountRef.current;
    messageCountRef.current = count;
    if (followLatestRef.current) scrollToLatest();
    else if (hasMore) setHasNewMessages(true);
  }, [messages]);

  // Phones hide this view while the chat list shows, and hiding it loses the scroll position.
  useLayoutEffect(() => {
    if (currentComponent === 'conversations') scrollToLatest();
  }, [currentComponent]);

  // Images finishing loading, the keyboard, or an error bar change the size without a new message.
  useEffect(() => {
    const area = messagesRef.current;
    const list = messagesListRef.current;
    if (!area || !list || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (followLatestRef.current) area.scrollTop = area.scrollHeight;
    });
    observer.observe(area);
    observer.observe(list);
    return () => observer.disconnect();
  }, [hasChatroom]);

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
              name={customerInfo?.avatar || (customerName !== 'null' ? customerName : '')}
              customStyles={`messenger-room-client ${isMobile ? 'bg-primary' : ''}`}
              endElement={isMobile ? '' :
                <Icon name='moreinfo'
                  size='medium'
                  onClick={moreInfoHandler}
                  customStyles='cursor-pointer'
                />}
              contentShow={false}
            />}

            <div className='messenger-room-body'>
              <div ref={messagesRef} className='messenger-room-messages' onScroll={handleMessagesScroll}>
                <div ref={messagesListRef} className='messenger-room-messages-list'>
                  {messages?.length > 0 && messages.map(({ channel_id, sender, contents, createdAt, platform, delivery_error }, i) =>
                    <ChatBubble key={contents.mid + i + contents.text} contents={platform === 'whatsapp' ? contents?.text?.body ?? contents?.text : contents?.text} attachments={contents?.attachments} deliveryError={delivery_error} showAvatar={channel_id !== sender.replaceAll('"', '')} name={customerInfo?.avatar} time={createdAt} justifyItem={channel_id === sender.replaceAll('"', '') ? 'end' : 'start'} />
                  )}
                </div>
              </div>
              {hasNewMessages && <button type='button' className='messenger-room-newMessages' onClick={scrollToLatest}>{t('new_messages')}</button>}
            </div>

            <MessageInput handlePushMessage={handleSendMessage} isMobile={isMobile} platform={currentChatroom.platform || currentChannel?.platform} />
          </>
        ) : (
          <div className="messenger-room-messages-null">
            <Icon name='chatBox' customStyles={{ width: '50px', height: '36px' }} />
            {emptyContent ? <div className='mt-[12px]'>{emptyContent}</div> : <ContentText title={t('start_a_conversation')} size='large' color='primary' customStyles='mt-[12px]' />}
          </div>
        )
        }


      </div>
    </>
  );
}
