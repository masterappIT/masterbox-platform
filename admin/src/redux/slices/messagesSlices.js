import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apolloApiHelpers, client, refreshSession } from '../../graphQL';
import { SUBSCRIBE_MESSAGE } from '../../graphQL/subscription'
import { GET_USER_SUBSCRIBED_CHANNELS, CHATROOMS } from '../../graphQL/channel'
import { SEND_MESSAGE, CHATROOMS_MESSAGES } from '../../graphQL/messages'
import errorHandler from '../../utils/errorHandler';
import { info } from 'autoprefixer';

// import  SEND_MESSAGE  from '../../graphQL/messages';




// These lists change on the server, so always read them fresh instead of from Apollo's cache.
const FRESH = { fetchPolicy: 'no-cache' };

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

export const getUserSubscribedChannels = createAsyncThunk(
  'channel/getUserSubscribedChannels',
  async (_, { dispatch, rejectWithValue }) => {

    const res = await apolloApiHelpers('query', GET_USER_SUBSCRIBED_CHANNELS, undefined, FRESH)

    if (res.error) {
      console.log('error', res.error)
      return rejectWithValue(res.error)
    }

    return dispatch(saveChannels(res.map(toChannel)))

  }
)
export const findChatsRooms = createAsyncThunk(
  'channel/findChatsRooms',
  async (_, { dispatch, rejectWithValue }) => {

    const res = await apolloApiHelpers('query', CHATROOMS, undefined, FRESH)

    if (res.error) {
      console.log('error', res.error)
      return rejectWithValue(res.error)
    }

    return dispatch(saveChatrooms(res.map(toChatRoom)))

  }
)
export const getChatRoomsMessages = createAsyncThunk(
  'messages/getChatRoomsMessages',
  async ({ getChatRoomsMessagesInput: { platform, channel_id, chat_room_id } }, { dispatch, rejectWithValue }) => {

    const res = await apolloApiHelpers('query', CHATROOMS_MESSAGES, { roomId: chat_room_id }, FRESH)

    if (res.error) {
      console.log('error', res.error)
      return rejectWithValue(res.error)
    }

    return dispatch(saveMessages({ key: `${platform}-${channel_id}-${chat_room_id}`, data: res.map(toMessage) }))

  }
)





const RESUBSCRIBE_DELAY_MS = 5000;

let messagesSubscription = null;
let resubscribeTimer = null;

export const stopMessagesSubscription = () => {
  clearTimeout(resubscribeTimer);
  messagesSubscription?.unsubscribe();
  messagesSubscription = null;
}

export const handleMessagesSubscription = createAsyncThunk(
  'messages/subscribe',
  async (_, { dispatch, getState }) => {
    if (messagesSubscription || !getState().user?.accessToken) return;

    const resubscribe = () => {
      clearTimeout(resubscribeTimer);
      resubscribeTimer = setTimeout(() => dispatch(handleMessagesSubscription()), RESUBSCRIBE_DELAY_MS);
    };

    messagesSubscription = client.subscribe({ query: SUBSCRIBE_MESSAGE }).subscribe({
      next: ({ data }) => {
        const message = data?.sendMessage;
        if (!message) return;
        dispatch(pushMessage(message));
        // A customer's first message creates a chat room this page hasn't loaded yet.
        const rooms = getState().messages.chatRooms;
        if (!Array.isArray(rooms) || !rooms.some(({ chat_room_id }) => chat_room_id === message.to_chat_room_id)) dispatch(findChatsRooms());
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
  }
)


export const handleSendMessage = createAsyncThunk(
  'user/sendMessage',
  async (data, { dispatch, rejectWithValue }) => {

    const res = await apolloApiHelpers('mutation', SEND_MESSAGE,
      {
        messageInput: data

      }
    )

    // The caller keeps the agent's text and shows why it wasn't sent.
    if (res.error) {
      return rejectWithValue(res.error)
    }

    dispatch(pushMessage(res))

    return res

  }
)

{

}



const initialState = {
  messages: {
    // "meta": {},


  },
  channels: [

  ],

  chatRooms: [

  ],

  // 'idle' | 'loading' | 'succeeded' | 'failed' — lets the home page tell loading apart from a failed read.
  channelsStatus: 'idle',
  chatRoomsStatus: 'idle',

}


export const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {

    /**發送訊息時
     * @param {*} state 
     * @param String - channelId - current channel id
     * @param String - chatRoomId - current chat room id 
     * @param Array - message
     */
    pushMessage: (state, { payload }) => {

      const newMessages = toMessage(typeof (payload) === 'string' ? JSON.parse(payload) : payload);


      const { platform, channel_id, to_chat_room_id, contents, _id } = newMessages;

      // console.log("newMessages___",_id)

      const key = `${platform}-${channel_id}-${to_chat_room_id}`;

      const existingRoomData = state.messages[key] || []
      console.log('existingRoomData', state)
      const newData = [...existingRoomData, newMessages]
      const existingIndex = existingRoomData.findIndex(message => message._id === _id)

      // Already in the conversation, so this is news about it, such as a failed delivery.
      if (existingIndex !== -1) {
        state.messages[key][existingIndex] = newMessages
      } else {

        const newData = [...existingRoomData, newMessages]

        newData.sort((a, b) => { return b.createdAt, a.createdAt }).reverse()

        const allNewData = Object.assign({}, state.messages)

        allNewData[key] = newData

        allNewData[key].sort((a, b) => { return a.createdAt, b.createdAt }).reverse()

        state.messages = allNewData

        // Keep the conversation with the newest message at the top.
        const rooms = Array.isArray(state.chatRooms) ? state.chatRooms : []
        const room = rooms.find(({ chat_room_id }) => chat_room_id === to_chat_room_id)
        if (room) state.chatRooms = [{ ...room, updatedAt: newMessages.createdAt }, ...rooms.filter((other) => other !== room)]

      }
      return



      // 該平台存在時
      // if (newMessages[channelId]) {
      //   //該房間不存在
      //   newMessages[channelId] = { ...newMessages[channelId], [chatRoomId]: { ...chatRoomInfo, messages: [message] } }

      //   //該房間已經存在
      //   if (newMessages[chatRoomId]) {
      //     newMessages[channelId][chatRoomId] = { ...chatRoomInfo, messages: [...newMessages[channelId][chatRoomId].messages, message] }
      //   }
      // }
      // //該平台不存在時
      // else {
      //   newMessages = { ...newMessages, [channelId]: { [chatRoomId]: { ...chatRoomInfo, messages: [message] } } }
      // }

      // newMessages[channelId][chatRoomId] = { ...newMessages[channelId][chatRoomId], messages: [...newMessages[channelId][chatRoomId].messages, message] }

      //call api



    },

    addChannels: (state, { payload }) => {

      state.channels = [...state.channels, ...payload]

    },

    saveChannels: (state, { payload }) => {

      state.channels = payload

    },

    saveChatrooms: (state, { payload }) => {

      state.chatRooms = payload

    },
    saveMessages: (state, { payload: { key, data } }) => {

      state.messages = { ...state.messages, [key]: data }

    }


    /**
     * TODO-fetch channelId's chatRooms api
     * TODO-fetch chatRoom's messages api
     * TODO-saveMessages reducer
     */
  },

  extraReducers: (builder) => {
    builder
      .addCase(getUserSubscribedChannels.pending, (state) => { state.channelsStatus = 'loading' })
      .addCase(getUserSubscribedChannels.fulfilled, (state) => { state.channelsStatus = 'succeeded' })
      .addCase(getUserSubscribedChannels.rejected, (state) => { state.channelsStatus = 'failed' })
      .addCase(findChatsRooms.pending, (state) => { state.chatRoomsStatus = 'loading' })
      .addCase(findChatsRooms.fulfilled, (state) => { state.chatRoomsStatus = 'succeeded' })
      .addCase(findChatsRooms.rejected, (state) => { state.chatRoomsStatus = 'failed' })
  }

})

export const { pushMessage, addChannels, saveChannels, saveChatrooms, saveMessages } = messagesSlice.actions;

export const selectMessages = (state) => state.messages?.messages;

const NO_CHANNELS = [];

// Sessions from before the query fix may have persisted an error object here.
export const selectChannels = (state) => Array.isArray(state.messages?.channels) ? state.messages.channels : NO_CHANNELS;

export const selectChatRooms = (state) => state.messages?.chatRooms;

export const selectChannelsStatus = (state) => state.messages?.channelsStatus || 'idle';

export const selectChatRoomsStatus = (state) => state.messages?.chatRoomsStatus || 'idle';

export const selectPlatformsChatRooms = (platform) => store => {

  const messagesState = store.messages

  const platformMessages = messagesState[platform] || {}

  /**
   * TODO-insert the conversations's last message 
   */

  return platformMessages;

}

export const selectChatRoomMessages = (chatRoomId, platform) => store => {

  const messagesState = store.messages

  const platformMessages = messagesState[platform] || {}

  const chatRoomMessages = platformMessages[chatRoomId];

  return chatRoomMessages;

}


export default messagesSlice.reducer