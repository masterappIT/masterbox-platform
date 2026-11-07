import React, { useState, useEffect, useMemo, useRef } from "react";

import ChatRoom from "../src/components/Messenger/ChatRoom";
import ChatRoomView from "../src/components/Chat/ChatRoomView";
import { capabilitiesOf, sourceLabel, sourcesOfChannels } from "../src/components/Chat/capabilities";
import CustomerPanel from "../src/components/Messenger/CustomerPanel";
import MobileNavigation from "../src/components/Messenger/MobileNavigation";
import MobileHeader from "../src/components/Messenger/MobileHeader";
import MobileSetting from "../src/components/Messenger/MobileSetting";
import MobileSettingDetail from "../src/components/Messenger/MobileSettingDetail";
import ChatEmptyState from "../src/components/Chat/ChatEmptyState";
import AssignmentFilter, { assignmentFilter } from "../src/components/Messenger/AssignmentFilter";
import useRoomAssignment from "../src/utils/useRoomAssignment";
import Checkbox from "../src/stories/components/Checkbox";
import { useSelector, useDispatch, shallowEqual } from "react-redux";
import {
  getUserSubscribedChannels, selectChannels, selectChannelsStatus, selectMessages, selectChatRooms,
  loadInbox, loadMoreInbox, selectInbox, openConversation, loadOlderMessages, selectMessagePaging, messagesKey,
  setOpenRoom, markConversationRead, fetchConversation, loadCustomerTags, selectCustomerTags,
  addConversationTag, removeConversationTag, handleSendMessage, loadAgents, selectAgents, selectRoomDetails,
} from '../src/redux/slices/messagesSlices';
import { selectUserInfo } from '../src/redux/slices/userSlices';
import { replyInput } from '../src/utils/chatReply';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

// Typing pauses this long before the search goes to the server.
const SEARCH_DELAY_MS = 300;
const ALL_CHANNELS = -1;
const NO_MESSAGES = [];

export default function Messenger() {
  const [isCustomerSideInfo, setIsCustomerSideInfo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [componentHandler, setComponentHandler] = useState({
    history: 'setting',//client,messenger
    current: 'client',
  });
  const dispatch = useDispatch();
  const router = useRouter();
  const { t } = useTranslation();

  function setCurrentComponent(current) {
    setComponentHandler({ current, history: componentHandler.current })
  }

  const handleCheckDevice = () => {
    if (window.innerWidth >= 640) setIsMobile(false)
    else setIsMobile(true)
  }

  const channels = useSelector(selectChannels);
  const inbox = useSelector(selectInbox);
  const messages = useSelector(selectMessages, shallowEqual);
  const messagePaging = useSelector(selectMessagePaging);
  const customerTags = useSelector(selectCustomerTags);
  const agents = useSelector(selectAgents);
  const roomDetails = useSelector(selectRoomDetails);
  const allRooms = useSelector(selectChatRooms);
  const channelsStatus = useSelector(selectChannelsStatus);
  const userInfo = useSelector(selectUserInfo);
  const isAdmin = String(userInfo?.role || '').toLowerCase() === 'admin';
  const hasChannels = channels.length > 0;

  // Persisted statuses describe an earlier visit, so only trust them once this visit has asked.
  const [channelsRequested, setChannelsRequested] = useState(false);
  const [inboxRequested, setInboxRequested] = useState(false);

  const fetchChannels = () => {
    setChannelsRequested(true)
    dispatch(getUserSubscribedChannels())
  }

  useEffect(() => {
    fetchChannels()
    dispatch(loadCustomerTags())
    dispatch(loadAgents())
    return () => { dispatch(setOpenRoom(null)) }
  }, []);

  const [selectedChannel, setSelectedChannel] = useState(ALL_CHANNELS);
  // The open conversation. The list may stop showing it when the filter changes; it stays open.
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [search, setSearch] = useState('');
  const [searchWords, setSearchWords] = useState('');
  // A source such as whatsapp_cloud, or '' for all of them.
  const [source, setSource] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  // '' for every conversation, 'mine', 'unassigned', or 'agent:<id>'.
  const [assignment, setAssignment] = useState('');

  // A colleague who left the company can't be filtered on any more.
  useEffect(() => {
    if (assignment.startsWith('agent:') && agents.length && !agents.some(({ id }) => `agent:${id}` === assignment)) setAssignment('')
  }, [agents, assignment])

  // A refreshed channel list may be shorter than the one the selection came from.
  useEffect(() => {
    if (selectedChannel >= channels.length && selectedChannel !== ALL_CHANNELS) setSelectedChannel(ALL_CHANNELS)
  }, [channels.length, selectedChannel])

  useEffect(() => {
    const timer = setTimeout(() => setSearchWords(search.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search])

  const sources = useMemo(() => sourcesOfChannels(channels), [channels])

  // A source no channel has any more can't be filtered on.
  useEffect(() => {
    if (source && channels.length && !sources.includes(source)) setSource('')
  }, [source, sources, channels.length])
  const channelFilter = selectedChannel === ALL_CHANNELS ? null : channels[selectedChannel]?.account
  const filter = useMemo(() => ({
    ...(searchWords ? { search: searchWords } : {}),
    ...(channelFilter ? { channel_id: channelFilter } : source ? { source } : {}),
    ...(unreadOnly ? { unread_only: true } : {}),
    ...assignmentFilter(assignment, userInfo?._id),
  }), [searchWords, channelFilter, source, unreadOnly, assignment, userInfo?._id])
  const filterKey = JSON.stringify(filter)

  const fetchInbox = () => {
    setInboxRequested(true)
    dispatch(loadInbox(filter))
  }

  useEffect(() => {
    if (hasChannels) fetchInbox()
  }, [hasChannels, filterKey])

  const chatrooms = inbox.rooms
  const isFiltered = Boolean(searchWords || (source && !channelFilter) || unreadOnly || assignment)

  // The list's copy is the freshest; when the filter hides it, the one kept on selecting with any change since.
  const currentChatroom = useMemo(() => {
    if (!selectedRoom) return null
    return chatrooms.find(({ id }) => id === selectedRoom.id) || { ...selectedRoom, ...roomDetails[selectedRoom.id] }
  }, [selectedRoom, chatrooms, roomDetails])
  const roomAssignment = useRoomAssignment(currentChatroom)

  const currentChannel = useMemo(() => {
    if (currentChatroom) return channels.find(({ account }) => account === currentChatroom.channel_id) || null
    return selectedChannel === ALL_CHANNELS ? null : channels[selectedChannel]
  }, [currentChatroom, channels, selectedChannel])
  const currentCapabilities = useMemo(() => capabilitiesOf(currentChatroom, currentChannel), [currentChatroom, currentChannel])

  // Cached data is shown while refreshing or after a failed refresh; without it, say what is going on.
  const homeStatus = useMemo(() => {
    if (!hasChannels) {
      if (!channelsRequested || channelsStatus === 'loading' || channelsStatus === 'idle') return 'loading'
      return channelsStatus === 'failed' ? 'failed' : 'no_channels'
    }
    if (chatrooms.length && inbox.status !== 'loading') return 'ready'
    if (!inboxRequested || inbox.status === 'loading' || inbox.status === 'idle') return chatrooms.length ? 'ready' : 'loading'
    if (inbox.status === 'failed') return 'failed'
    return isFiltered ? 'no_matches' : 'no_chatrooms'
  }, [hasChannels, channelsRequested, channelsStatus, chatrooms, inboxRequested, inbox.status, isFiltered])

  const clearFilters = () => {
    setSearch('')
    setSearchWords('')
    setSource('')
    setUnreadOnly(false)
    setAssignment('')
  }

  // What the list and the chat room show instead (Figma Admin/空白狀態); ChatEmptyState has the text of each kind.
  const homeEmptyState = {
    loading: { kind: 'loading', title: t('home_loading') },
    failed: { kind: 'failed', action: { title: t('retry'), onClick: hasChannels ? fetchInbox : fetchChannels } },
    no_channels: isAdmin
      ? { kind: 'no_channels', action: { title: t('go_to_channels_management'), onClick: () => router.push('/channels-management') } }
      : { kind: 'no_channels', description: t('connect_channel_ask_admin') },
    no_chatrooms: { kind: 'no_chatrooms' },
    no_matches: { kind: 'no_matches', ...(unreadOnly && !searchWords && !assignment ? { title: t('no_unread_conversations') } : {}), action: { title: '清除篩選', onClick: clearFilters } },
  }[homeStatus]

  const selectChatroom = (_, room) => {
    if (!room?.id) return
    setSelectedRoom(room)
    dispatch(openConversation(room))
  }

  // A link from the home or customers page opens that conversation by its platform id.
  const linkedRoom = typeof router.query.room === 'string' ? router.query.room : null
  useEffect(() => {
    if (!linkedRoom || !hasChannels) return
    const known = [...chatrooms, ...(Array.isArray(allRooms) ? allRooms : [])].find((room) => room.chat_room_id === linkedRoom && room.id)
    router.replace('/', undefined, { shallow: true })
    if (!known) return
    dispatch(fetchConversation({ id: known.id })).unwrap().then((room) => {
      selectChatroom(room.chat_room_id, room)
      setCurrentComponent('conversations')
    }).catch(() => null)
  }, [linkedRoom, hasChannels])

  // New messages in the open conversation count as read only while the agent can see it.
  const visibleRoom = currentChatroom && (!isMobile || componentHandler.current === 'conversations') ? currentChatroom : null
  const visibleRoomId = visibleRoom?.id || null
  useEffect(() => {
    dispatch(setOpenRoom(visibleRoom))
    if (visibleRoomId) dispatch(markConversationRead({ id: visibleRoomId }))
  }, [visibleRoomId])

  // Coming back to the tab is when the agent sees what arrived meanwhile.
  const visibleRoomRef = useRef(null)
  visibleRoomRef.current = visibleRoomId
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && visibleRoomRef.current) dispatch(markConversationRead({ id: visibleRoomRef.current }))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const conversationKey = currentChatroom ? messagesKey(currentChatroom) : null
  const currentConversation = (conversationKey && messages[conversationKey]) || NO_MESSAGES
  const paging = (conversationKey && messagePaging[conversationKey]) || {}

  useEffect(() => {
    window.addEventListener('resize', handleCheckDevice);
    handleCheckDevice();
    return () => { window.removeEventListener('resize', handleCheckDevice) }
  }, []);

  const isMobileHeader = componentHandler.current !== 'client'

  // Rejects when the message wasn't sent, so the message box can keep it and show why.
  function sendReply(reply) {
    return dispatch(handleSendMessage(replyInput(currentChatroom, reply))).unwrap()
  }

  // The panel shows the list's copy of the conversation, so a tag change shows there too.
  const changeTags = (action) => dispatch(action).unwrap().then((room) => {
    setSelectedRoom((selected) => (selected?.id === room.id ? { ...selected, tags: room.tags } : selected))
  })

  const filterBar = (
    <div className='messenger-list-filters'>
      <label className='messenger-list-filters-search'>
        <img src='/design/ui/search.svg' alt='' width={16} height={16} />
        <input type='search' value={search} placeholder={t('search_conversations')} aria-label={t('search_conversations')} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <div className='messenger-list-filters-row'>
        {selectedChannel === ALL_CHANNELS && sources.length > 1 && (
          <select className='messenger-list-filters-platform' value={source} aria-label={t('all_sources')} onChange={(event) => setSource(event.target.value)}>
            <option value=''>{t('all_sources')}</option>
            {sources.map((value) => <option key={value} value={value}>{sourceLabel(value)}</option>)}
          </select>
        )}
        <AssignmentFilter value={assignment} onChange={setAssignment} agents={agents} myId={userInfo?._id} />
        <Checkbox content={t('show_unread_only')} labelColor='black-primary' checked={unreadOnly} onClick={(event) => setUnreadOnly(event.target.checked)} />
      </div>
    </div>
  )

  return (
    <>
      <div className="messenger">
        {(isMobile && isMobileHeader) ? <MobileHeader variant='secondary' componentHandler={componentHandler} setCurrentComponent={setCurrentComponent} currentChatroom={currentChatroom} onShowInfo={() => setIsCustomerSideInfo(true)} /> : ''}
        <ChatRoom
          currentComponent={componentHandler.current}
          selectedChannel={selectedChannel}
          setSelectedChannel={setSelectedChannel}
          selectedChatroomID={currentChatroom?.id || null}
          selectChatroom={selectChatroom}
          setSelectedChatroomID={() => setSelectedRoom(null)}
          componentHandler={componentHandler}
          setCurrentComponent={setCurrentComponent}
          isMobile={isMobile}
          channels={channels}
          chatrooms={chatrooms}
          allChannels
          channelPlaceholder={homeStatus === 'loading' ? t('home_loading') : homeStatus === 'failed' && !hasChannels ? t('home_load_failed') : null}
          emptyContent={homeEmptyState ? <ChatEmptyState {...homeEmptyState} /> : null}
          listProps={{
            filterBar: hasChannels ? filterBar : null,
            onLoadMore: () => dispatch(loadMoreInbox()),
            hasMore: inbox.hasMore,
            loadingMore: inbox.loadingMore,
            loadMoreFailed: inbox.loadMoreFailed,
            showUnread: true,
            selectedId: currentChatroom?.id || null,
          }}
        />
        <ChatRoomView
          key={currentChatroom?.id || 'none'}
          room={currentChatroom}
          channel={currentChannel}
          messages={currentConversation}
          capabilities={currentCapabilities}
          onSend={sendReply}
          onLoadOlder={() => currentChatroom && dispatch(loadOlderMessages(currentChatroom))}
          hasOlder={Boolean(paging.hasOlder)}
          loadingOlder={Boolean(paging.loadingOlder)}
          isMobile={isMobile}
          hidden={isMobile && componentHandler.current !== 'conversations'}
          onTogglePanel={() => setIsCustomerSideInfo((shown) => !shown)}
          isPanelOpen={isCustomerSideInfo}
          emptyState={['no_channels', 'failed'].includes(homeStatus) ? homeEmptyState : null}
        />
        <CustomerPanel
          room={currentChatroom}
          isShown={Boolean(isCustomerSideInfo && currentChatroom)}
          onClose={() => setIsCustomerSideInfo(false)}
          tagSuggestions={customerTags}
          onAddTag={(name) => changeTags(addConversationTag({ id: currentChatroom.id, name }))}
          onRemoveTag={(tagId) => changeTags(removeConversationTag({ id: currentChatroom.id, tagId }))}
          assignment={roomAssignment}
        />
        {isMobile === true && componentHandler.current === 'setting' ? <MobileSetting /> : ''}
        {isMobile === true && componentHandler.current === 'settingDetail' ? <MobileSettingDetail /> : ''}
        {isMobile === true && componentHandler.current !== 'conversations' ? <MobileNavigation componentHandler={componentHandler} setCurrentComponent={setCurrentComponent} /> : ''}
      </div>
    </>
  );
}
