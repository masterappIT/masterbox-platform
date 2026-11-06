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
import { dayKey, dayLabel, timeLabel } from '../../utils/messageTime';
import { customerOfRoom } from '../Messenger/ChatroomList';

//RFCP 快速建立component
const imgList = [
  { img: "emoji", action: "" },
  { img: "attach", action: "" },
];

// Within this distance of the end still counts as being at the latest message.
const AT_BOTTOM_THRESHOLD_PX = 48;
// Within this distance of the top, earlier messages start loading.
const LOAD_OLDER_THRESHOLD_PX = 120;

function ActionIcon({ icon }) {
  return <Icon name={icon} customStyles='messenger-room-send-inputArea-iconArea-icon' />;
}

// onLoadOlder, hasOlder and loadingOlder page back through the conversation; without them every message is already here.
export default function Conversations({ isCustomerSideInfo, setIsCustomerSideInfo, currentComponent, isMobile, messages, currentChatroom, currentChannel, selectedChannel, channels, chatrooms, handlePushMessage, emptyContent, onLoadOlder, hasOlder, loadingOlder }) {
  const messagesRef = useRef(null);
  const messagesListRef = useRef(null);
  // Whether new content should keep the view at the latest message. Each chat room starts here,
  // because the pages remount this component per room.
  const followLatestRef = useRef(true);
  const lastMessageIdRef = useRef(null);
  // The message at the top of the view and how far it is from the top, so content added above it
  // (earlier messages, an image finishing loading) leaves it where the agent was reading.
  const anchorRef = useRef(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const hasChatroom = Boolean(currentChatroom);

  const { t, i18n } = useTranslation();

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

  function rememberAnchor() {
    const area = messagesRef.current;
    const list = messagesListRef.current;
    if (!area || !list) return;
    const top = area.getBoundingClientRect().top;
    const element = [...list.querySelectorAll('[data-anchor]')].find((candidate) => candidate.getBoundingClientRect().bottom > top);
    anchorRef.current = element ? { element, offset: element.getBoundingClientRect().top - top } : null;
  }

  function restoreAnchor() {
    const area = messagesRef.current;
    const anchor = anchorRef.current;
    if (!area || !anchor?.element?.isConnected) return;
    const moved = anchor.element.getBoundingClientRect().top - area.getBoundingClientRect().top - anchor.offset;
    if (moved) area.scrollTop += moved;
  }

  function loadOlderIfNearTop() {
    const area = messagesRef.current;
    if (!area || !onLoadOlder || !hasOlder || loadingOlder) return;
    if (area.scrollTop <= LOAD_OLDER_THRESHOLD_PX) onLoadOlder();
  }

  function handleMessagesScroll() {
    const area = messagesRef.current;
    const isAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight <= AT_BOTTOM_THRESHOLD_PX;
    followLatestRef.current = isAtBottom;
    if (isAtBottom) setHasNewMessages(false);
    else rememberAnchor();
    loadOlderIfNearTop();
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
    const lastId = messages?.length ? messages[messages.length - 1]._id : null;
    // Earlier messages go above; only a different last message is news.
    const hasNewer = Boolean(lastMessageIdRef.current && lastId !== lastMessageIdRef.current);
    lastMessageIdRef.current = lastId;
    if (followLatestRef.current) scrollToLatest();
    else {
      restoreAnchor();
      if (hasNewer) setHasNewMessages(true);
    }
  }, [messages]);

  // A short page doesn't fill the area and can't be scrolled up, so load more until it does.
  useEffect(() => {
    const area = messagesRef.current;
    if (area && area.scrollHeight <= area.clientHeight) loadOlderIfNearTop();
  }, [messages, hasOlder, loadingOlder]);

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
      else restoreAnchor();
    });
    observer.observe(area);
    observer.observe(list);
    return () => observer.disconnect();
  }, [hasChatroom]);

  const customerInfo = currentChatroom ? customerOfRoom(currentChatroom) : null
  const customerName = customerInfo?.name || ''
  const language = i18n.language

  // console.log('currentChatroom', currentChatroom)



  return (
    <>
      <div className={`messenger-room ${isMobile && currentComponent !== 'conversations' ? 'hidden' : ''}`}>
        {currentChatroom ? (
          <>
            {!isMobile && <ChatroomItem
              title={customerName && customerName !== 'null' ? customerName : t('no_name')}
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
                  {onLoadOlder && messages?.length > 0 && (loadingOlder || !hasOlder) && (
                    <div className='messenger-room-older'>{loadingOlder ? t('loading_older_messages') : t('no_older_messages')}</div>
                  )}
                  {messages?.length > 0 && messages.map(({ _id, channel_id, sender, contents, createdAt, platform, delivery_error }, i) => {
                    const day = dayKey(createdAt)
                    const startsDay = i === 0 || dayKey(messages[i - 1].createdAt) !== day
                    const isCompany = channel_id === sender.replaceAll('"', '')
                    return (
                      <React.Fragment key={_id || i}>
                        {startsDay && <div className='messenger-room-day' data-anchor='' role='separator'><span>{dayLabel(createdAt, { t, language })}</span></div>}
                        <div data-anchor=''>
                          <ChatBubble contents={platform === 'whatsapp' ? contents?.text?.body ?? contents?.text : contents?.text} attachments={contents?.attachments} deliveryError={delivery_error} showAvatar={!isCompany} name={customerInfo?.avatar || customerName} time={timeLabel(createdAt, { language })} justifyItem={isCompany ? 'end' : 'start'} />
                        </div>
                      </React.Fragment>
                    )
                  })}
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
