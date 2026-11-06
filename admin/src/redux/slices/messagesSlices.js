import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apolloApiHelpers, client, refreshSession, onSocketReconnected } from '../../graphQL';
import { SUBSCRIBE_MESSAGE } from '../../graphQL/subscription'
import {
  GET_USER_SUBSCRIBED_CHANNELS, CHATROOMS, CHAT_ROOM_PAGE, CHAT_ROOM, MARK_CHAT_ROOM_READ, CUSTOMER_TAGS, ADD_CHAT_ROOM_TAG, REMOVE_CHAT_ROOM_TAG,
  ASSIGN_CHAT_ROOM, CHAT_ROOM_ASSIGNEES, SUBSCRIBE_CHAT_ROOM_UPDATES,
} from '../../graphQL/channel'
import { SEND_MESSAGE, MESSAGE_PAGE, WHATSAPP_TEMPLATES, SEND_WHATSAPP_TEMPLATE } from '../../graphQL/messages'
import { QUICK_REPLIES } from '../../graphQL/messageTemplate'

// These lists change on the server, so always read them fresh instead of from Apollo's cache.
const FRESH = { fetchPolicy: 'no-cache' };

const ROOMS_PER_PAGE = 30;
const MESSAGES_PER_PAGE = 30;
// Catching up after a disconnect reads at most this many pages; beyond that the conversation reloads.
const CATCH_UP_PAGES = 10;

// The home page keys chat rooms by `account`; rooms point at their channel by its id.
const toChannel = ({ channel_id, platform, name, enabled }) => ({ channel_id, platform, name, enabled: enabled !== false, account: channel_id });

const toChatRoom = ({ users, ...room }) => ({
  ...room,
  users: (users || []).map(({ name, first_name, ...user }) => ({ ...user, first_name: first_name || name })),
});

const UNSUPPORTED_MESSAGE = '[此訊息類型暫不支援顯示]';

// Stored contents are plain text, a JSON message (`text`), or a Meta payload (`message.text`).
// A customer's message may only have attachments, and some types have nothing to show at all.
const parseContents = (contents) => {
  let parsed = contents && typeof contents === 'object' ? contents : null;
  if (!parsed) {
    try {
      const value = JSON.parse(contents);
      if (value && typeof value === 'object') parsed = value;
    } catch (error) { }
  }
  const text = parsed ? parsed.text ?? parsed.message?.text ?? parsed.message?.body : contents;
  const attachments = parsed?.attachments || parsed?.message?.attachments || [];
  return { ...parsed, text: (text?.body ?? text) || attachments.length ? text : UNSUPPORTED_MESSAGE, attachments };
};

// Conversations tell the two sides apart by comparing the sender with the channel.
const CUSTOMER_SENDER = 'customer';

const toMessage = ({ sentAt, createdAt, contents, sender, ...message }) => ({
  ...message,
  contents: parseContents(contents),
  sender: sender || (message.inbound ? CUSTOMER_SENDER : message.channel_id),
  createdAt: createdAt || sentAt,
});

/** Where a conversation's messages are kept in the store. */
export const messagesKey = ({ platform, channel_id, chat_room_id }) => `${platform}-${channel_id}-${chat_room_id}`;

const byTimeThenId = (a, b) => (new Date(a.createdAt) - new Date(b.createdAt)) || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0);

// Oldest first and each message once; a later copy of a message (a delivery error, say) replaces the earlier one.
const mergeMessages = (existing, incoming) => {
  const byId = new Map((existing || []).map((message) => [message._id, message]));
  incoming.forEach((message) => byId.set(message._id, message));
  return [...byId.values()].sort(byTimeThenId);
};

// Newest activity first, which is the order the server pages in.
const byActivity = (a, b) => (new Date(b.updatedAt) - new Date(a.updatedAt)) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

const sameRoom = (room, { channel_id, to_chat_room_id }) => room.channel_id === channel_id && room.chat_room_id === to_chat_room_id;

// Whether a conversation's agent is the one the list is filtered on: someone in particular, or nobody.
const fitsAssignment = (room, filter = {}) => (!filter.assignee_id || room.assignee?.id === filter.assignee_id)
  && (filter.assignment !== 'unassigned' || !room.assignee);

// Whether a conversation the server just sent belongs in the list under its filter.
// A search is only matched on the server, so new conversations wait for the next search.
const fitsFilter = (room, filter = {}) => !filter.search
  && (!filter.channel_id || room.channel_id === filter.channel_id)
  && (!filter.platform || room.platform === filter.platform)
  && (!filter.unread_only || room.unreadCount > 0)
  && fitsAssignment(room, filter);

const isPageVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

export const getUserSubscribedChannels = createAsyncThunk(
  'channel/getUserSubscribedChannels',
  async (_, { dispatch, rejectWithValue }) => {
    const res = await apolloApiHelpers('query', GET_USER_SUBSCRIBED_CHANNELS, undefined, FRESH)
    if (res.error) return rejectWithValue(res.error)
    return dispatch(saveChannels(res.map(toChannel)))
  }
)

// Every conversation of the company, for the pages that count or list them all.
export const findChatsRooms = createAsyncThunk(
  'channel/findChatsRooms',
  async (_, { dispatch, rejectWithValue }) => {
    const res = await apolloApiHelpers('query', CHATROOMS, undefined, FRESH)
    if (res.error) return rejectWithValue(res.error)
    return dispatch(saveChatrooms(res.map(toChatRoom)))
  }
)

/**
 * The first page of the inbox for a filter. A newer request replaces the list; an older one finishing late is ignored.
 * @param filter - { search, platform, channel_id, unread_only }
 */
export const loadInbox = createAsyncThunk(
  'inbox/load',
  async (filter, { rejectWithValue }) => {
    const res = await apolloApiHelpers('query', CHAT_ROOM_PAGE, { first: ROOMS_PER_PAGE, filter }, FRESH)
    if (res.error) return rejectWithValue(res.error)
    return { ...res, rooms: res.rooms.map(toChatRoom) }
  }
)

let loadingMoreRooms = null;

// The next page of the inbox, when the agent scrolls to the end of the list.
export const loadMoreInbox = createAsyncThunk(
  'inbox/loadMore',
  async (_, { getState, rejectWithValue }) => {
    const { nextCursor, filter } = getState().messages.inbox;
    const res = await apolloApiHelpers('query', CHAT_ROOM_PAGE, { first: ROOMS_PER_PAGE, after: nextCursor, filter }, FRESH)
    if (res.error) return rejectWithValue(res.error)
    return { ...res, rooms: res.rooms.map(toChatRoom), filter }
  },
  {
    condition: (_, { getState }) => {
      const { hasMore, nextCursor, status } = getState().messages.inbox || {};
      return Boolean(hasMore && nextCursor && status === 'succeeded' && !loadingMoreRooms);
    },
  }
)

// A conversation the inbox hasn't loaded: one a live message mentions, such as a customer's first message,
// or one a link opens. It joins the list when it fits the filter.
const pendingRooms = new Set();
export const fetchConversation = createAsyncThunk(
  'inbox/fetchRoom',
  async ({ id, chat_room_id, channel_id }, { rejectWithValue }) => {
    const res = await apolloApiHelpers('query', CHAT_ROOM, id ? { id } : { chatRoomId: chat_room_id, channelId: channel_id }, FRESH)
    if (res.error || !res?.id) return rejectWithValue(res.error || 'not found')
    return toChatRoom(res)
  }
)

/** Shows a conversation's newest messages; older ones load as the agent scrolls up. */
export const openConversation = createAsyncThunk(
  'inbox/openConversation',
  async (room, { dispatch, rejectWithValue }) => {
    const res = await apolloApiHelpers('query', MESSAGE_PAGE, { id: room.id, first: MESSAGES_PER_PAGE }, FRESH)
    if (res.error) return rejectWithValue(res.error)
    return { key: messagesKey(room), messages: res.messages.map(toMessage), hasOlder: Boolean(res.hasOlder) }
  }
)

const loadingOlder = new Set();

/** The page of messages before the oldest one shown. */
export const loadOlderMessages = createAsyncThunk(
  'inbox/loadOlderMessages',
  async (room, { getState, rejectWithValue }) => {
    const key = messagesKey(room);
    const oldest = (getState().messages.messages[key] || [])[0];
    loadingOlder.add(key);
    try {
      const res = await apolloApiHelpers('query', MESSAGE_PAGE, { id: room.id, first: MESSAGES_PER_PAGE, before: oldest?.cursor }, FRESH)
      if (res.error) return rejectWithValue(res.error)
      return { key, messages: res.messages.map(toMessage), hasOlder: Boolean(res.hasOlder) }
    } finally {
      loadingOlder.delete(key);
    }
  },
  {
    condition: (room, { getState }) => {
      const key = messagesKey(room);
      const { messages, messagePaging } = getState().messages;
      return Boolean(room?.id && messagePaging?.[key]?.hasOlder && messages[key]?.[0]?.cursor && !loadingOlder.has(key));
    },
  }
)

/**
 * Marks the conversation read for this agent, up to a message or its newest one.
 * The list shows it read straight away; the server's count replaces that when it answers.
 */
export const markConversationRead = createAsyncThunk(
  'inbox/markRead',
  async ({ id, messageId }, { rejectWithValue }) => {
    const res = await apolloApiHelpers('mutation', MARK_CHAT_ROOM_READ, { id, ...(messageId ? { messageId } : {}) })
    if (res.error) return rejectWithValue(res.error)
    return res
  }
)

export const loadCustomerTags = createAsyncThunk(
  'inbox/customerTags',
  async (_, { rejectWithValue }) => {
    const res = await apolloApiHelpers('query', CUSTOMER_TAGS, undefined, FRESH)
    if (res.error) return rejectWithValue(res.error)
    return res
  }
)

/** Tags the conversation's customer; rejects with the reason when the tag can't be added. */
export const addConversationTag = createAsyncThunk(
  'inbox/addTag',
  async ({ id, name }, { dispatch, rejectWithValue }) => {
    const res = await apolloApiHelpers('mutation', ADD_CHAT_ROOM_TAG, { id, name })
    if (res.error) return rejectWithValue(res.error)
    dispatch(loadCustomerTags())
    return res
  }
)

export const removeConversationTag = createAsyncThunk(
  'inbox/removeTag',
  async ({ id, tagId }, { rejectWithValue }) => {
    const res = await apolloApiHelpers('mutation', REMOVE_CHAT_ROOM_TAG, { id, tagId })
    if (res.error) return rejectWithValue(res.error)
    return res
  }
)

/** The company's agents, for the list's filter by agent. */
export const loadAgents = createAsyncThunk(
  'inbox/agents',
  async (_, { rejectWithValue }) => {
    const res = await apolloApiHelpers('query', CHAT_ROOM_ASSIGNEES, undefined, FRESH)
    if (res.error) return rejectWithValue(res.error)
    return res
  }
)

/** Who this conversation can be assigned to: everyone who works in its channel. Not kept in the store. */
export const loadRoomAssignees = createAsyncThunk(
  'inbox/roomAssignees',
  async ({ id }, { rejectWithValue }) => {
    const res = await apolloApiHelpers('query', CHAT_ROOM_ASSIGNEES, { id }, FRESH)
    if (res.error) return rejectWithValue(res.error)
    return res
  }
)

/**
 * Hands a conversation to an agent, or leaves it unassigned (assigneeId null).
 * Rejects with { message, conflict } — conflict when someone changed it first, after which the conversation is read again.
 */
export const assignConversation = createAsyncThunk(
  'inbox/assign',
  async ({ id, assigneeId }, { dispatch, rejectWithValue }) => {
    const res = await apolloApiHelpers('mutation', ASSIGN_CHAT_ROOM, { id, assigneeId: assigneeId || null })
    if (res.error) {
      const conflict = res.extensions?.code === 'CONFLICT'
      if (conflict) dispatch(fetchConversation({ id })).unwrap().then((room) => dispatch(roomUpdated(room))).catch(() => null)
      return rejectWithValue({ message: res.error, conflict })
    }
    const room = toChatRoom(res)
    dispatch(roomUpdated(room))
    return room
  }
)

/**
 * After the live connection comes back: refresh the top of the inbox and fetch the open conversation's
 * messages sent while it was down. Messages already shown aren't added twice.
 */
export const catchUpAfterReconnect = createAsyncThunk(
  'inbox/catchUp',
  async (_, { dispatch, getState }) => {
    const state = getState().messages;
    if (state.inbox?.status === 'succeeded') {
      const res = await apolloApiHelpers('query', CHAT_ROOM_PAGE, { first: ROOMS_PER_PAGE, filter: state.inbox.filter }, FRESH)
      if (!res.error) dispatch(refreshInboxTop({ ...res, rooms: res.rooms.map(toChatRoom), filter: state.inbox.filter }))
    }
    if (state.chatRoomsStatus === 'succeeded') dispatch(findChatsRooms())

    const open = state.openRoom;
    if (!open?.id) return;
    const key = messagesKey(open);
    let newest = (getState().messages.messages[key] || []).slice(-1)[0];
    if (!newest?.cursor) {
      dispatch(openConversation(open));
      return;
    }
    for (let page = 0; page < CATCH_UP_PAGES; page += 1) {
      const res = await apolloApiHelpers('query', MESSAGE_PAGE, { id: open.id, first: 100, after: newest.cursor }, FRESH);
      if (res.error) return;
      const messages = res.messages.map(toMessage);
      if (messages.length) dispatch(addMessages({ key, messages }));
      if (!res.hasNewer) {
        if (getState().messages.openRoom?.id === open.id && isPageVisible()) dispatch(markConversationRead({ id: open.id }));
        return;
      }
      newest = messages[messages.length - 1];
    }
    // Too much happened while away; start the conversation again from its newest messages.
    dispatch(openConversation(open));
  }
)

const RESUBSCRIBE_DELAY_MS = 5000;

let messagesSubscription = null;
let roomsSubscription = null;
let resubscribeTimer = null;
let stopCatchingUp = null;

export const stopMessagesSubscription = () => {
  clearTimeout(resubscribeTimer);
  messagesSubscription?.unsubscribe();
  messagesSubscription = null;
  roomsSubscription?.unsubscribe();
  roomsSubscription = null;
  stopCatchingUp?.();
  stopCatchingUp = null;
}

// Changes to conversations, such as a colleague taking one, as they happen.
const followRoomUpdates = (dispatch, getState, resubscribe) => {
  roomsSubscription = client.subscribe({ query: SUBSCRIBE_CHAT_ROOM_UPDATES }).subscribe({
    next: ({ data }) => {
      const room = data?.chatRoomUpdated;
      if (room?.id) dispatch(roomUpdated(toChatRoom(room)));
    },
    error: () => {
      roomsSubscription = null;
      if (getState().user?.accessToken) resubscribe();
    },
    complete: () => {
      roomsSubscription = null;
      if (getState().user?.accessToken) resubscribe();
    },
  });
}

export const handleMessagesSubscription = createAsyncThunk(
  'messages/subscribe',
  async ({ resubscribed } = {}, { dispatch, getState }) => {
    if (!getState().user?.accessToken) return;

    // The socket reconnecting by itself keeps the subscription, but anything sent meanwhile was missed.
    stopCatchingUp ||= onSocketReconnected(() => dispatch(catchUpAfterReconnect()));

    const resubscribe = () => {
      clearTimeout(resubscribeTimer);
      resubscribeTimer = setTimeout(() => dispatch(handleMessagesSubscription({ resubscribed: true })), RESUBSCRIBE_DELAY_MS);
    };

    if (!roomsSubscription) followRoomUpdates(dispatch, getState, resubscribe);
    if (messagesSubscription) return;

    messagesSubscription = client.subscribe({ query: SUBSCRIBE_MESSAGE }).subscribe({
      next: ({ data }) => {
        const message = data?.sendMessage;
        if (!message) return;
        const { openRoom, inbox, chatRooms } = getState().messages;
        const isOpen = Boolean(openRoom && openRoom.channel_id === message.channel_id && openRoom.chat_room_id === message.to_chat_room_id);
        const seen = isOpen && isPageVisible();
        dispatch(receiveMessage({ message, seen }));
        if (seen && message.inbound) dispatch(markConversationRead({ id: openRoom.id, messageId: message._id }));

        // A customer's first message creates a chat room this page hasn't loaded yet.
        const pendingKey = `${message.channel_id}-${message.to_chat_room_id}`;
        if (inbox?.status === 'succeeded' && !inbox.rooms.some((room) => sameRoom(room, message)) && !pendingRooms.has(pendingKey)) {
          pendingRooms.add(pendingKey);
          dispatch(fetchConversation({ chat_room_id: message.to_chat_room_id, channel_id: message.channel_id })).finally(() => pendingRooms.delete(pendingKey));
        }
        if (getState().messages.chatRoomsStatus !== 'idle' && Array.isArray(chatRooms) && !chatRooms.some((room) => sameRoom(room, message))) dispatch(findChatsRooms());
      },
      error: async (error) => {
        messagesSubscription = null;
        const isExpired = error.graphQLErrors?.some(({ extensions }) => extensions?.code === 'UNAUTHENTICATED');
        if (isExpired) await refreshSession().catch(() => null);
        if (getState().user?.accessToken) resubscribe();
      },
      // The socket closed cleanly, which also ends the subscription.
      complete: () => {
        messagesSubscription = null;
        if (getState().user?.accessToken) resubscribe();
      },
    });

    // Subscribing again means messages could have been missed in between.
    if (resubscribed) dispatch(catchUpAfterReconnect());
  }
)


export const handleSendMessage = createAsyncThunk(
  'user/sendMessage',
  async (data, { dispatch, rejectWithValue }) => {
    const res = await apolloApiHelpers('mutation', SEND_MESSAGE, { messageInput: data })

    // The caller keeps the agent's text and file and shows why they weren't sent.
    // sentAttachment: the file went out as its own message but the text after it didn't.
    // templateRequired: WhatsApp's 24 hours ran out, so only a template can go now.
    if (res.error) {
      return rejectWithValue({ message: res.error, sentAttachment: Boolean(res.extensions?.sentAttachment), templateRequired: Boolean(res.extensions?.templateRequired) })
    }

    dispatch(receiveMessage({ message: res, seen: true }))
    return res
  }
)

/** The approved templates of a WhatsApp conversation's number; rejects with the reason they can't be read. */
export const loadWhatsappTemplates = createAsyncThunk(
  'inbox/whatsappTemplates',
  async ({ id }, { rejectWithValue }) => {
    const res = await apolloApiHelpers('query', WHATSAPP_TEMPLATES, { id }, FRESH)
    if (res.error) return rejectWithValue(res.error)
    return res
  }
)

/**
 * Sends an approved WhatsApp template in the conversation.
 * @param {{ id: string, templateId: string, values: { key, value }[], headerMediaUrl?: string }} input - id is the conversation's
 */
export const sendWhatsappTemplate = createAsyncThunk(
  'inbox/sendWhatsappTemplate',
  async ({ id, templateId, values, headerMediaUrl }, { dispatch, rejectWithValue }) => {
    const res = await apolloApiHelpers('mutation', SEND_WHATSAPP_TEMPLATE, { id, templateId, values, ...(headerMediaUrl ? { headerMediaUrl } : {}) })
    if (res.error) return rejectWithValue(res.error)
    dispatch(receiveMessage({ message: res, seen: true }))
    return res
  }
)

// The company's templates, inserted into replies as quick replies. Read again each time the picker opens.
export const loadQuickReplies = createAsyncThunk(
  'inbox/quickReplies',
  async (_, { rejectWithValue }) => {
    const res = await apolloApiHelpers('query', QUICK_REPLIES, undefined, FRESH)
    if (res.error) return rejectWithValue(res.error)
    return res
  }
)

const initialInbox = { rooms: [], filter: {}, nextCursor: null, hasMore: false, status: 'idle', loadingMore: false, loadMoreFailed: false };

const initialState = {
  messages: {},
  // The server's latest copy of conversations that changed while open, by id, for when the list doesn't show them.
  roomDetails: {},
  // The company's agents, for filtering the list by agent.
  agents: [],
  // Whether older messages are left to load, by messagesKey.
  messagePaging: {},
  channels: [],
  // Every conversation of the company, for the pages that count or list them all.
  chatRooms: [],
  // The conversation list on `/`, a page at a time.
  inbox: initialInbox,
  // The conversation the agent has open, whose new messages count as read: { id, platform, channel_id, chat_room_id }.
  openRoom: null,
  customerTags: [],
  quickReplies: [],
  quickRepliesStatus: 'idle',

  // 'idle' | 'loading' | 'succeeded' | 'failed' — lets the home page tell loading apart from a failed read.
  channelsStatus: 'idle',
  chatRoomsStatus: 'idle',
}

// Moves the conversation a new message belongs to to the top, with the message as its last one.
const bumpRoom = (rooms, message, { countUnread }) => {
  if (!Array.isArray(rooms)) return rooms;
  const room = rooms.find((candidate) => sameRoom(candidate, message));
  if (!room) return rooms;
  const updated = {
    ...room,
    lastMessage: message.preview ?? room.lastMessage,
    lastMessageAt: message.createdAt,
    lastMessageInbound: Boolean(message.inbound),
    // A customer's message restarts Meta's reply window.
    ...(message.inbound ? { lastCustomerMessageAt: message.createdAt } : {}),
    updatedAt: message.createdAt,
    unreadCount: (room.unreadCount || 0) + (countUnread ? 1 : 0),
  };
  return [updated, ...rooms.filter((other) => other !== room)];
};

// Puts a conversation where it belongs by its latest activity, replacing an older copy of it.
const placeRoom = (rooms, room) => [...rooms.filter(({ id }) => id !== room.id), room].sort(byActivity);

const updateRoom = (state, id, changes) => {
  const apply = (room) => (room.id === id ? { ...room, ...changes } : room);
  state.inbox.rooms = state.inbox.rooms.map(apply);
  if (Array.isArray(state.chatRooms)) state.chatRooms = state.chatRooms.map(apply);
};

export const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    /**
     * A message from the live connection or one this agent just sent.
     * @param message - as the API sends it
     * @param seen - the agent has its conversation open and in view, so it isn't unread
     */
    receiveMessage: (state, { payload: { message: raw, seen } }) => {
      const message = toMessage(typeof raw === 'string' ? JSON.parse(raw) : raw);
      const key = messagesKey({ platform: message.platform, channel_id: message.channel_id, chat_room_id: message.to_chat_room_id });
      const existing = state.messages[key] || [];
      const isNew = !existing.some(({ _id }) => _id === message._id);
      state.messages[key] = mergeMessages(existing, [message]);
      // A known message coming back is news about it, such as a failed delivery, not new activity.
      if (!isNew) return;
      const countUnread = Boolean(message.inbound && !seen);
      if (!state.inbox) state.inbox = initialInbox;
      state.inbox.rooms = bumpRoom(state.inbox.rooms, message, { countUnread });
      state.chatRooms = bumpRoom(state.chatRooms, message, { countUnread: false });
    },

    /**
     * A conversation as the server has it now, after an assignment or a tag change, here or by a colleague.
     * It leaves the list when it no longer fits the agent filter, and joins it when it now does.
     */
    roomUpdated: (state, { payload: room }) => {
      if (!state.roomDetails) state.roomDetails = {};
      state.roomDetails[room.id] = room;
      if (Array.isArray(state.chatRooms)) state.chatRooms = state.chatRooms.map((known) => (known.id === room.id ? { ...known, ...room } : known));
      if (!state.inbox || state.inbox.status !== 'succeeded') return;
      const { rooms, filter, hasMore } = state.inbox;
      if (rooms.some(({ id }) => id === room.id)) {
        state.inbox.rooms = fitsAssignment(room, filter)
          ? rooms.map((known) => (known.id === room.id ? { ...known, ...room } : known))
          : rooms.filter(({ id }) => id !== room.id);
        return;
      }
      // Beyond the pages loaded so far it shows up when the agent scrolls there.
      const last = rooms[rooms.length - 1];
      if (fitsFilter(room, filter) && !(hasMore && last && byActivity(room, last) > 0)) state.inbox.rooms = placeRoom(rooms, room);
    },

    addMessages: (state, { payload: { key, messages } }) => {
      state.messages[key] = mergeMessages(state.messages[key], messages);
    },

    setOpenRoom: (state, { payload }) => {
      state.openRoom = payload ? { id: payload.id, platform: payload.platform, channel_id: payload.channel_id, chat_room_id: payload.chat_room_id } : null;
    },

    // The top of the inbox after a reconnect. Conversations further down had no news, or they would be up here.
    refreshInboxTop: (state, { payload: { rooms, nextCursor, hasMore, filter } }) => {
      if (JSON.stringify(filter) !== JSON.stringify(state.inbox.filter)) return;
      const fresh = new Set(rooms.map(({ id }) => id));
      const last = rooms[rooms.length - 1];
      const older = last ? state.inbox.rooms.filter((room) => !fresh.has(room.id) && byActivity(room, last) > 0) : [];
      state.inbox.rooms = [...rooms, ...older];
      if (!older.length) {
        state.inbox.nextCursor = nextCursor;
        state.inbox.hasMore = hasMore;
      }
    },

    saveChannels: (state, { payload }) => {
      state.channels = payload
    },

    saveChatrooms: (state, { payload }) => {
      state.chatRooms = payload
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(getUserSubscribedChannels.pending, (state) => { state.channelsStatus = 'loading' })
      .addCase(getUserSubscribedChannels.fulfilled, (state) => { state.channelsStatus = 'succeeded' })
      .addCase(getUserSubscribedChannels.rejected, (state) => { state.channelsStatus = 'failed' })
      .addCase(findChatsRooms.pending, (state) => { state.chatRoomsStatus = 'loading' })
      .addCase(findChatsRooms.fulfilled, (state) => { state.chatRoomsStatus = 'succeeded' })
      .addCase(findChatsRooms.rejected, (state) => { state.chatRoomsStatus = 'failed' })

      .addCase(loadInbox.pending, (state, { meta }) => {
        // Sessions from before paging have no inbox stored.
        state.inbox = { ...initialInbox, ...state.inbox, filter: meta.arg || {}, status: 'loading', requestId: meta.requestId, loadingMore: false, loadMoreFailed: false };
        loadingMoreRooms = null;
      })
      .addCase(loadInbox.fulfilled, (state, { payload, meta }) => {
        if (state.inbox.requestId !== meta.requestId) return;
        state.inbox = { ...state.inbox, rooms: payload.rooms, nextCursor: payload.nextCursor, hasMore: payload.hasMore, status: 'succeeded', loadingMore: false };
      })
      .addCase(loadInbox.rejected, (state, { meta }) => {
        if (state.inbox.requestId !== meta.requestId) return;
        state.inbox.status = 'failed';
      })
      .addCase(loadMoreInbox.pending, (state, { meta }) => {
        loadingMoreRooms = meta.requestId;
        state.inbox.loadingMore = true;
        state.inbox.loadMoreFailed = false;
      })
      .addCase(loadMoreInbox.fulfilled, (state, { payload, meta }) => {
        if (loadingMoreRooms !== meta.requestId) return;
        loadingMoreRooms = null;
        state.inbox.loadingMore = false;
        if (JSON.stringify(payload.filter) !== JSON.stringify(state.inbox.filter)) return;
        // A conversation that moved up while paging may already be in the list.
        const known = new Set(state.inbox.rooms.map(({ id }) => id));
        state.inbox.rooms = [...state.inbox.rooms, ...payload.rooms.filter(({ id }) => !known.has(id))];
        state.inbox.nextCursor = payload.nextCursor;
        state.inbox.hasMore = payload.hasMore;
      })
      .addCase(loadMoreInbox.rejected, (state, { meta }) => {
        if (loadingMoreRooms !== meta.requestId) return;
        loadingMoreRooms = null;
        state.inbox.loadingMore = false;
        state.inbox.loadMoreFailed = true;
      })
      .addCase(fetchConversation.fulfilled, (state, { payload }) => {
        if (state.inbox.status !== 'succeeded') return;
        if (!fitsFilter(payload, state.inbox.filter) && !state.inbox.rooms.some(({ id }) => id === payload.id)) return;
        state.inbox.rooms = placeRoom(state.inbox.rooms, payload);
      })

      .addCase(openConversation.fulfilled, (state, { payload: { key, messages, hasOlder } }) => {
        // Live messages that came in while this page loaded are kept.
        const newest = messages[messages.length - 1];
        const live = newest ? (state.messages[key] || []).filter((message) => byTimeThenId(message, newest) > 0) : [];
        state.messages[key] = mergeMessages(messages, live);
        state.messagePaging[key] = { hasOlder };
      })
      .addCase(loadOlderMessages.pending, (state, { meta }) => {
        const key = messagesKey(meta.arg);
        state.messagePaging[key] = { ...state.messagePaging[key], loadingOlder: true };
      })
      .addCase(loadOlderMessages.fulfilled, (state, { payload: { key, messages, hasOlder } }) => {
        state.messages[key] = mergeMessages(state.messages[key], messages);
        state.messagePaging[key] = { hasOlder, loadingOlder: false };
      })
      .addCase(loadOlderMessages.rejected, (state, { meta }) => {
        const key = messagesKey(meta.arg);
        state.messagePaging[key] = { ...state.messagePaging[key], loadingOlder: false };
      })

      .addCase(markConversationRead.pending, (state, { meta }) => {
        // Reading up to one message leaves anything newer, which the server's answer accounts for.
        if (!meta.arg.messageId) updateRoom(state, meta.arg.id, { unreadCount: 0 });
      })
      .addCase(markConversationRead.fulfilled, (state, { payload }) => {
        updateRoom(state, payload.id, { unreadCount: payload.unreadCount });
      })
      .addCase(loadCustomerTags.fulfilled, (state, { payload }) => { state.customerTags = payload })
      .addCase(loadAgents.fulfilled, (state, { payload }) => { state.agents = payload })
      .addCase(loadQuickReplies.pending, (state) => { state.quickRepliesStatus = 'loading' })
      .addCase(loadQuickReplies.fulfilled, (state, { payload }) => { state.quickReplies = payload; state.quickRepliesStatus = 'succeeded' })
      .addCase(loadQuickReplies.rejected, (state) => { state.quickRepliesStatus = 'failed' })
      .addCase(addConversationTag.fulfilled, (state, { payload }) => { updateRoom(state, payload.id, { tags: payload.tags }) })
      .addCase(removeConversationTag.fulfilled, (state, { payload }) => { updateRoom(state, payload.id, { tags: payload.tags }) })
  }
})

export const { receiveMessage, roomUpdated, addMessages, setOpenRoom, refreshInboxTop, saveChannels, saveChatrooms } = messagesSlice.actions;

export const selectMessages = (state) => state.messages?.messages;

const NO_CHANNELS = [];

// Sessions from before the query fix may have persisted an error object here.
export const selectChannels = (state) => Array.isArray(state.messages?.channels) ? state.messages.channels : NO_CHANNELS;

export const selectChatRooms = (state) => state.messages?.chatRooms;

export const selectChannelsStatus = (state) => state.messages?.channelsStatus || 'idle';

export const selectChatRoomsStatus = (state) => state.messages?.chatRoomsStatus || 'idle';

export const selectInbox = (state) => state.messages?.inbox || initialInbox;

const NO_PAGING = {};
export const selectMessagePaging = (state) => state.messages?.messagePaging || NO_PAGING;

const NO_REPLIES = [];
export const selectQuickReplies = (state) => state.messages?.quickReplies || NO_REPLIES;
export const selectQuickRepliesStatus = (state) => state.messages?.quickRepliesStatus || 'idle';

const NO_AGENTS = [];
export const selectAgents = (state) => state.messages?.agents || NO_AGENTS;

const NO_DETAILS = {};
export const selectRoomDetails = (state) => state.messages?.roomDetails || NO_DETAILS;

const NO_TAGS = [];
export const selectCustomerTags = (state) => state.messages?.customerTags || NO_TAGS;

export default messagesSlice.reducer
