import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import ChatroomItem from '../../stories/components/ChatroomItem';
import ContentText from '../../stories/components/ContentText';
import Icon from '../../stories/components/Icon';
import Checkbox from '../../stories/components/Checkbox';
import { useTranslation } from "react-i18next";
import { listTimeLabel } from '../../utils/messageTime';

// Within this distance of the end of the list, the next page starts loading.
const LOAD_MORE_THRESHOLD_PX = 200;

export const customerOfRoom = ({ customer, users, channel_id }) => {
  const user = (users || []).find(({ id }) => id !== channel_id)
  const name = customer?.name || `${user?.first_name || ''}${user?.last_name || ''}`.trim()
  return { id: customer?.id || user?.id, name, avatar: customer?.avatar || user?.avatar }
}

function ChatroomList({ isMobile, chatRoomsList, componentHandler, setCurrentComponent, selectChatroom, emptyContent, filterBar, onLoadMore, hasMore, loadingMore, loadMoreFailed, showUnread, selectedId }) {
  const currentComponent = componentHandler.current;
  const listRef = useRef(null);
  const { t, i18n } = useTranslation();

  const handleOnClick = (room) => {
    setCurrentComponent('conversations')
    selectChatroom(room.chat_room_id, room)
  }

  const loadMoreIfNearEnd = () => {
    const list = listRef.current;
    if (!list || !onLoadMore || !hasMore || loadingMore || loadMoreFailed) return;
    if (list.scrollHeight - list.scrollTop - list.clientHeight <= LOAD_MORE_THRESHOLD_PX) onLoadMore();
  }

  // A first page shorter than the list area can't be scrolled, so keep loading until it fills.
  useEffect(() => { loadMoreIfNearEnd() }, [chatRoomsList, hasMore, loadingMore]);

  return (
    <>
      <div className={`${isMobile && currentComponent === 'messenger' ? 'mt-[45px]' : ''}`}>
        {filterBar || (
          <label className='container flex py-[14px] px-[24px] space-x-[8px] bg-bg_secondary'>
            <Checkbox content={t('show_unread_only')} labelColor='black-primary' />
          </label>
        )}
      </div>

      <div ref={listRef} className='list messenger-list-chatroom' role='list' onScroll={loadMoreIfNearEnd}>
        {(chatRoomsList && chatRoomsList.length) ? chatRoomsList.map((room) => {
          const { id, channel_id, chat_room_id, platform, lastMessage, lastMessageAt, updatedAt, unreadCount, assignee } = room
          const customer = customerOfRoom(room)
          const unread = showUnread ? unreadCount || 0 : 0
          const isSelected = selectedId && (selectedId === id || selectedId === chat_room_id)
          const time = listTimeLabel(lastMessageAt || updatedAt, { t, language: i18n.language })

          return (
            <div
              key={id || `${channel_id}-${chat_room_id}`}
              role='listitem'
              className={`messenger-list-room ${isSelected ? 'messenger-list-room-selected' : ''} ${unread ? 'messenger-list-room-unread' : ''}`}
              onClick={() => handleOnClick(room)}
            >
              <ChatroomItem
                isMobile={isMobile}
                title={customer.name || t('no_name')}
                name={customer.avatar || customer.name}
                contentIcon={platform ? <Icon name={platform} size='small' customStyles='mr-[6px] mt-[1px] shrink-0' /> : null}
                content={lastMessage || `ID : ${customer.id || chat_room_id}`}
                endElement={
                  <div className='messenger-list-room-meta'>
                    <span className='messenger-list-room-time'>{time}</span>
                    {assignee && <span className='messenger-list-room-assignee' title={t('assignee_label', { name: assignee.name })}>{assignee.name}</span>}
                    {unread > 0 && <span className='messenger-unread' aria-label={t('unread_count', { count: unread })}>{unread > 99 ? '99+' : unread}</span>}
                  </div>
                }
                customStyles={{ padding: '10px 16px', cursor: 'pointer' }}
              />
            </div>
          )
        }) :
          <div className='w-full flex items-center justify-center mt-[70px] px-[16px] text-center'>
            {emptyContent || <ContentText size='large' title={t('no_user_found')} />}
          </div>
        }
        {chatRoomsList?.length > 0 && (loadingMore || loadMoreFailed) && (
          <button type='button' className='messenger-list-more' disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore ? t('loading_more') : t('load_more_failed')}
          </button>
        )}
      </div>
    </>
  );
}

ChatroomList.propTypes = {
  chatRoomsList: PropTypes.array,
  selectChatroom: PropTypes.func,
  emptyContent: PropTypes.node,
  // Search and filters above the list; without it the list shows the old unread checkbox.
  filterBar: PropTypes.node,
  onLoadMore: PropTypes.func,
  hasMore: PropTypes.bool,
  loadingMore: PropTypes.bool,
  loadMoreFailed: PropTypes.bool,
  showUnread: PropTypes.bool,
  selectedId: PropTypes.string,
}

ChatroomList.defaultProps = {
  filterBar: null,
  onLoadMore: null,
  hasMore: false,
  loadingMore: false,
  loadMoreFailed: false,
  showUnread: false,
  selectedId: null,
}

export default ChatroomList
