import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apolloApiHelpers } from '../../graphQL';
import { SUBSCRIBE_MESSAGE } from '../../graphQL/subscription'
import { GET_USER_SUBSCRIBED_CHANNELS, CHATROOMS } from '../../graphQL/channel'
import { SEND_MESSAGE, CHATROOMS_MESSAGES } from '../../graphQL/messages'
import errorHandler from '../../utils/errorHandler';
import { info } from 'autoprefixer';

// import  SEND_MESSAGE  from '../../graphQL/messages';




// These lists change on the server, so always read them fresh instead of from Apollo's cache.
const FRESH = { fetchPolicy: 'no-cache' };

// The home page keys chat rooms by `account`; rooms point at their channel by its id.
const toChannel = ({ channel_id, platform, name }) => ({ channel_id, platform, name, account: channel_id });

const toChatRoom = ({ users, ...room }) => ({
  ...room,
  users: (users || []).map(({ name, first_name, ...user }) => ({ ...user, first_name: first_name || name })),
});

// Stored contents are plain text, a JSON message (`text`), or a Meta payload (`message.text`).
const parseContents = (contents) => {
  if (contents && typeof contents === 'object') return contents;
  try {
    const parsed = JSON.parse(contents);
    if (parsed && typeof parsed === 'object') return { ...parsed, text: parsed.text ?? parsed.message?.text };
  } catch (error) { }
  return { text: contents };
};

// Every stored message comes from a company account, so the channel is always the sender.
const toMessage = ({ sentAt, createdAt, contents, sender, ...message }) => ({
  ...message,
  contents: parseContents(contents),
  sender: sender || message.channel_id,
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





export const handleMessagesSubscription = createAsyncThunk(
  'messages/subscribe',
  async (_, { dispatch, getState }) => {
    const userId = getState().user?.info?._id;
    if (!userId) return null;

    try {
      const res = await apolloApiHelpers('mutation', SUBSCRIBE_MESSAGE, { accountId: userId });
      if (res?.error) return null;
      dispatch(pushMessage(res));
      return res;
    } catch (error) {
      return null;
    }
  }
)


export const handleSendMessage = createAsyncThunk(
  'user/sendMessage',
  async (data, { dispatch }) => {

    const res = await apolloApiHelpers('mutation', SEND_MESSAGE,
      {
        messageInput: data

      }
    )

    if (res.error) {
      alert(res.error)
      return res
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

      if (existingRoomData.findIndex(message => message._id === _id) === -1) {

        const newData = [...existingRoomData, newMessages]

        newData.sort((a, b) => { return b.createdAt, a.createdAt }).reverse()

        const allNewData = Object.assign({}, state.messages)

        allNewData[key] = newData

        allNewData[key].sort((a, b) => { return a.createdAt, b.createdAt }).reverse()

        state.messages = allNewData

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

  // extraReducers: {
  //   'messages/subscribe/fulfilled': (state, { payload }) => {

  //     const { dispatch } = payload;

  //     return dispatch(handleMessagesSubscription())

  //   }
  // }

})

export const { pushMessage, addChannels, saveChannels, saveChatrooms, saveMessages } = messagesSlice.actions;

export const selectMessages = (state) => state.messages?.messages;

const NO_CHANNELS = [];

// Sessions from before the query fix may have persisted an error object here.
export const selectChannels = (state) => Array.isArray(state.messages?.channels) ? state.messages.channels : NO_CHANNELS;

export const selectChatRooms = (state) => state.messages?.chatRooms;

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