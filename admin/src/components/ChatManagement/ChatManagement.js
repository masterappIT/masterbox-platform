import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { useRouter } from 'next/router';
import Conversations from '../Conversations/Conversations';
import CustomerPanel from '../Messenger/CustomerPanel';
import StatusMessage from '../Messenger/StatusMessage';
import { customerOfRoom } from '../Messenger/ChatroomList';
import AssignmentFilter, { assignmentFilter } from '../Messenger/AssignmentFilter';
import useRoomAssignment from '../../utils/useRoomAssignment';
import { selectUserInfo } from '../../redux/slices/userSlices';
import {
  getUserSubscribedChannels, selectChannels, selectChannelsStatus, loadInbox, loadMoreInbox, selectInbox,
  openConversation, loadOlderMessages, selectMessages, selectMessagePaging, messagesKey, setOpenRoom,
  markConversationRead, loadCustomerTags, selectCustomerTags, addConversationTag, removeConversationTag,
  handleSendMessage, catchUpAfterReconnect, loadAgents, selectAgents, selectRoomDetails,
} from '../../redux/slices/messagesSlices';
import { MessageFactory } from '../../utils/MessageFactory';
import useSocketStatus from '../../utils/useSocketStatus';

const PLATFORM_NAMES = { fb: 'Facebook', ig: 'Instagram', whatsapp: 'WhatsApp', line: 'LINE', wechat: 'WeChat' };
const NO_MESSAGES = [];
const CONNECTION = {
  connected: { label: '即時連線中', className: 'is-connected', hint: '新訊息會立即出現' },
  connecting: { label: '連線中…', className: 'is-connecting', hint: '正在建立即時連線' },
  disconnected: { label: '連線中斷，重新連線中…', className: 'is-disconnected', hint: '恢復連線後會自動補上這段期間的訊息' },
};

// The same inbox as the home page, in the compact Chat Box layout: one live list of every channel's conversations.
export default function ChatManagement() {
  const dispatch = useDispatch();
  const router = useRouter();
  const channels = useSelector(selectChannels);
  const channelsStatus = useSelector(selectChannelsStatus);
  const inbox = useSelector(selectInbox);
  const messages = useSelector(selectMessages, shallowEqual);
  const messagePaging = useSelector(selectMessagePaging);
  const customerTags = useSelector(selectCustomerTags);
  const agents = useSelector(selectAgents);
  const roomDetails = useSelector(selectRoomDetails);
  const userInfo = useSelector(selectUserInfo);
  // '' for every conversation, 'mine', 'unassigned', or 'agent:<id>'.
  const [assignment, setAssignment] = useState('');
  const filter = useMemo(() => assignmentFilter(assignment, userInfo?._id), [assignment, userInfo?._id]);
  const filterKey = JSON.stringify(filter);
  const connection = useSocketStatus();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isPanelShown, setIsPanelShown] = useState(false);
  // Persisted statuses describe an earlier visit, so only trust them once this visit has asked.
  const [requested, setRequested] = useState({ channels: false, inbox: false });
  const hasChannels = channels.length > 0;

  const fetchChannels = () => {
    setRequested((value) => ({ ...value, channels: true }));
    dispatch(getUserSubscribedChannels());
  };
  const fetchInbox = () => {
    setRequested((value) => ({ ...value, inbox: true }));
    dispatch(loadInbox(filter));
  };

  useEffect(() => {
    fetchChannels();
    dispatch(loadCustomerTags());
    dispatch(loadAgents());
    return () => { dispatch(setOpenRoom(null)); };
  }, []);

  useEffect(() => { if (hasChannels) fetchInbox(); }, [hasChannels, filterKey]);

  // A colleague who left the company can't be filtered on any more.
  useEffect(() => {
    if (assignment.startsWith('agent:') && agents.length && !agents.some(({ id }) => `agent:${id}` === assignment)) setAssignment('');
  }, [agents, assignment]);

  // The home page shares this list and may have left its own filter on it.
  const rooms = JSON.stringify(inbox.filter || {}) === filterKey ? inbox.rooms : [];
  const currentRoom = useMemo(() => (selectedRoom && (rooms.find(({ id }) => id === selectedRoom.id) || { ...selectedRoom, ...roomDetails[selectedRoom.id] })) || null, [selectedRoom, rooms, roomDetails]);
  const roomAssignment = useRoomAssignment(currentRoom);
  const currentChannel = currentRoom ? (channels.find(({ account }) => account === currentRoom.channel_id) || { account: currentRoom.channel_id, platform: currentRoom.platform }) : null;

  const selectRoom = (room) => {
    if (!room?.id) return;
    setSelectedRoom(room);
    dispatch(openConversation(room));
  };

  // New messages in the open conversation count as read while it is on screen, as on the home page.
  const openId = currentRoom?.id || null;
  useEffect(() => {
    dispatch(setOpenRoom(currentRoom));
    if (openId) dispatch(markConversationRead({ id: openId }));
  }, [openId]);
  const openIdRef = useRef(null);
  openIdRef.current = openId;
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && openIdRef.current) dispatch(markConversationRead({ id: openIdRef.current })); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const key = currentRoom ? messagesKey(currentRoom) : null;
  const conversation = (key && messages[key]) || NO_MESSAGES;
  const paging = (key && messagePaging[key]) || {};

  function handlePushMessage(toChatRoomId, message, recipient) {
    const data = new MessageFactory(toChatRoomId, currentRoom.platform, currentRoom.channel_id).createContents({ message, recipient });
    return dispatch(handleSendMessage(data)).unwrap();
  }

  const changeTags = (action) => dispatch(action).unwrap().then((room) => {
    setSelectedRoom((selected) => (selected?.id === room.id ? { ...selected, tags: room.tags } : selected));
  });

  const status = (() => {
    if (!hasChannels) {
      if (!requested.channels || ['idle', 'loading'].includes(channelsStatus)) return 'loading';
      return channelsStatus === 'failed' ? 'failed' : 'no_channels';
    }
    if (rooms.length) return 'ready';
    if (!requested.inbox || ['idle', 'loading'].includes(inbox.status)) return 'loading';
    return inbox.status === 'failed' ? 'failed' : 'no_rooms';
  })();
  const statusMessage = {
    loading: { title: '正在讀取對話…' },
    failed: { title: '無法載入對話', description: '請檢查網路連線後重試。', action: { title: '重試', onClick: hasChannels ? fetchInbox : fetchChannels } },
    no_channels: { title: '還沒有串接任何頻道', description: '串接 Facebook、Instagram 或 WhatsApp 後，客戶的訊息會出現在這裡。', action: { title: '前往社群平台管理', onClick: () => router.push('/channels-management') } },
    no_rooms: assignment
      ? { title: '沒有符合篩選的對話', description: '換個負責人篩選，或選「全部對話」。' }
      : { title: '目前沒有對話', description: '客戶傳訊息給你的頻道後，對話會立即出現在這裡。' },
  }[status];

  const live = CONNECTION[connection] || CONNECTION.connecting;
  const refresh = () => {
    if (hasChannels) dispatch(catchUpAfterReconnect());
    else fetchChannels();
  };

  return (
    <main className="chat-management">
      <header className="chat-management-header">
        <div><p className="chat-management-eyebrow">MASTERBOX</p><h1>Chat Box</h1><span>集中管理各社群頻道的客戶訊息</span></div>
        <div className="chat-management-header-side">
          <span className={`chat-management-status ${live.className}`} title={live.hint} role="status">● {live.label}</span>
          <button type="button" className="chat-management-refresh" onClick={refresh} disabled={inbox.status === 'loading'}>重新整理</button>
          <span className="chat-management-count">{inbox.hasMore ? `${rooms.length}+` : rooms.length} 個對話</span>
        </div>
      </header>
      <div className="chat-management-grid">
        <aside className="chat-management-sidebar">
          <div className="chat-management-sidebar-head">
            <label>對話</label>
            <AssignmentFilter value={assignment} onChange={setAssignment} agents={agents} myId={userInfo?._id} className="chat-management-filter" />
          </div>
          <div className="chat-management-list" onScroll={(event) => {
            const list = event.currentTarget;
            if (inbox.hasMore && !inbox.loadingMore && list.scrollHeight - list.scrollTop - list.clientHeight < 120) dispatch(loadMoreInbox());
          }}>
            {status !== 'ready' ? <StatusMessage {...statusMessage} compact /> : rooms.map((room) => {
              const customer = customerOfRoom(room);
              const name = customer.name || '未命名客戶';
              return (
                <button type="button" className={`chat-management-room ${currentRoom?.id === room.id ? 'is-selected' : ''}`} key={room.id} onClick={() => selectRoom(room)}>
                  <span className="chat-management-avatar">{customer.avatar ? <img src={customer.avatar} alt="" /> : name.slice(0, 1)}</span>
                  <span className="chat-management-room-text">
                    <strong>{name}</strong>
                    <small>{PLATFORM_NAMES[room.platform] || room.platform}{room.channel_name ? ` · ${room.channel_name}` : ''}</small>
                    {room.lastMessage && <small className="chat-management-room-last">{room.lastMessageInbound === false ? '回覆：' : ''}{room.lastMessage}</small>}
                    <small className="chat-management-room-assignee">{room.assignee ? `負責人：${room.assignee.name}` : '未指派'}</small>
                  </span>
                  {room.unreadCount > 0 && <span className="chat-management-unread" aria-label={`${room.unreadCount} 則未讀`}>{room.unreadCount > 99 ? '99+' : room.unreadCount}</span>}
                </button>
              );
            })}
            {inbox.loadingMore && <p className="chat-management-muted">載入更多對話…</p>}
            {inbox.loadMoreFailed && <button type="button" className="chat-management-more" onClick={() => dispatch(loadMoreInbox())}>載入失敗，重試</button>}
          </div>
        </aside>
        <section className="chat-management-conversation">
          {currentRoom ? (
            <div className="messenger chat-management-room-view">
              <Conversations
                key={currentRoom.id}
                isCustomerSideInfo={isPanelShown}
                setIsCustomerSideInfo={setIsPanelShown}
                componentHandler={{ current: 'conversations' }}
                currentComponent="conversations"
                isMobile={false}
                messages={conversation}
                selectedChatroomID={currentRoom.chat_room_id}
                currentChannel={currentChannel}
                currentChatroom={currentRoom}
                channels={channels}
                handlePushMessage={handlePushMessage}
                onLoadOlder={() => dispatch(loadOlderMessages(currentRoom))}
                hasOlder={Boolean(paging.hasOlder)}
                loadingOlder={Boolean(paging.loadingOlder)}
              />
              <CustomerPanel
                room={currentRoom}
                isShown={isPanelShown}
                onClose={() => setIsPanelShown(false)}
                tagSuggestions={customerTags}
                onAddTag={(name) => changeTags(addConversationTag({ id: currentRoom.id, name }))}
                onRemoveTag={(tagId) => changeTags(removeConversationTag({ id: currentRoom.id, tagId }))}
                assignment={roomAssignment}
              />
            </div>
          ) : <div className="chat-management-empty"><h2>選擇一個對話</h2><p>從左側選擇客戶，即可查看訊息並回覆。</p></div>}
        </section>
      </div>
    </main>
  );
}
