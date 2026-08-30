import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apolloApiHelpers } from '../../graphQL';
import { SUBSCRIBE_MESSAGE } from '../../graphQL/subscription'
import { GET_USER_SUBSCRIBED_CHANNELS, CHATROOMS, CHATROOM_USERS } from '../../graphQL/channel'
import { SEND_MESSAGE, CHATROOM_MESSAGES } from '../../graphQL/messages'
import store from '../store'
import errorHandler from '../../utils/errorHandler';
import { info } from 'autoprefixer';
import { current } from '@reduxjs/toolkit';
// import  SEND_MESSAGE  from '../../graphQL/messages';




export const getUserSubscribedChannels = createAsyncThunk(
  'channel/getUserSubscribedChannels',
  async (paginationInput, { dispatch }) => {

    try {
      const res = await apolloApiHelpers('query', GET_USER_SUBSCRIBED_CHANNELS, paginationInput)

      const error = res.error
      if (error) {
        console.log('error', error)
      }

      return dispatch(saveChannels(res))

    } catch (error) {
      console.log('error', error)
    }

  }
)
export const findChatsRooms = createAsyncThunk(
  'channel/findChatsRooms',
  async ({ paginationInput, findChatsRoomInput }, { dispatch }) => {


    try {

      const res = await apolloApiHelpers('query', CHATROOMS,

        {
          "paginationInput": {
            page: paginationInput.page,
            limit: paginationInput.limit,
          },
          "findChatsRoomInput": {
            channel_id: findChatsRoomInput.channel_id,
            platform: findChatsRoomInput.platform
          }
        }
      )

      const error = res.error
      if (error) {
        console.log('error', error)
      }

      return dispatch(saveChatrooms(res))

    } catch (error) {
      console.log('error', error)
    }

  }
)
export const findChatsRoomUsers = createAsyncThunk(
  'channel/findChatsRoomUsers',
  async (findChatsRoomInput, { dispatch }) => {


    try {

      const res = await apolloApiHelpers('query', CHATROOM_USERS, findChatsRoomInput)

      const error = res.error
      if (error) {
        console.log('error', error)
      }
      const { channel_id, chatRoomId, platform } = findChatsRoomInput;
      const saveChatroomDta = {
        channel_id: channel_id,
        chat_room_id: chatRoomId,
        platform: platform,
        users: res.chatRooms[0].users
      }

      return dispatch(saveChatrooms(saveChatroomDta))

    } catch (error) {
      console.log('error', error)
    }

  }
)
export const getChatRoomsMessages = createAsyncThunk(
  'messages/getChatRoomsMessages',
  async ({ paginationInput, getChatRoomsMessagesInput }, { dispatch }) => {

    try {

      const res = await apolloApiHelpers('query', CHATROOM_MESSAGES,
        {
          "paginationInput": paginationInput,
          "getChatRoomsMessagesInput": getChatRoomsMessagesInput
        }
      )

      const error = res.error
      if (error) {
        console.log('error', error)
      }

      return dispatch(saveMessages(res))

    } catch (error) {
      console.log('error', error)
    }

  }
)





export const handleMessagesSubscription = createAsyncThunk(
  'messages/subscribe',
  async (_, { dispatch }) => {

    const userId = store.getState().user.info?._id

    const res = await apolloApiHelpers('mutation', SUBSCRIBE_MESSAGE, { accountId: userId });

    dispatch(pushMessage(res))

    return dispatch(handleMessagesSubscription())

  }


)


export const handleSendMessage = createAsyncThunk(
  'user/sendMessage',
  async (data, { dispatch }) => {

    try {

      const res = await apolloApiHelpers('mutation', SEND_MESSAGE,
        {
          messageInput: data

        }
      )

      if (res.status === "success") {

        dispatch(pushMessage(res.message))
      }
      if (res.status === "error") {
        const error = JSON.parse(res.message)

        alert(error?.error?.message)

      }


      return res
      // return dispatch(handleMessagesSubscription())

    } catch (error) {
      alert('error', error)
    }

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

      let newMessages = payload;


      if (typeof (newMessages) === 'string') {
        newMessages = JSON.parse(newMessages)

      } else {
        newMessages.contents = JSON.parse(newMessages.contents)
      }


      const { platform, channel_id, to_chat_room_id, contents, _id } = newMessages;

      // console.log("newMessages___",_id)

      const key = `${platform}-${channel_id}-${to_chat_room_id}`;

      const existingRoomData = state.messages[key] || []

      if (existingRoomData.findIndex(message => message._id === _id) === -1) {

        const newData = [...existingRoomData, newMessages]

        newData.sort((a, b) => { return b.createdAt, a.createdAt }).reverse()

        const allNewData = Object.assign({}, state.messages)

        allNewData[key] = newData

        allNewData[key].sort((a, b) => { return a.createdAt, b.createdAt }).reverse()

        state.messages = allNewData

        // const existingChatRoom = current(state.chatRooms)
        // const existingChatRoom = state.chatRooms

        // console.log('existingChannel', existingChatRoom)
        // console.log('existingChannel', existingChatRoom.findIndex(chatRoom => chatRoom.chat_room_id === to_chat_room_id))


        // if (existingChatRoom.findIndex(chatRoom => chatRoom.chat_room_id === to_chat_room_id) === -1) {
        //   findChatsRoomUsers({
        //     "findChatsRoomInput": {
        //       channel_id: channel_id,
        //       platform: platform,
        //       chatRoomId: to_chat_room_id,
        //     }
        //   })
        // }

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

      let newRooms = []
      if (payload.length) {
        payload.forEach((room) => {
          const existingRoomData = state.chatRooms;
          const isNewRoom = existingRoomData.findIndex(
            ({ platform, channel_id, chat_room_id }) => (platform === room.platform && channel_id === room.channel_id && chat_room_id === room.chat_room_id))
          if (isNewRoom === -1) newRooms.push(room)

        })

        state.chatRooms = [...state.chatRooms, ...newRooms]
      }

    },
    saveMessages: (state, { payload }) => {

      // state.messages = payload;


      state.messages.meta = payload.meta;
console.log('saveMessages',payload);
      // if (payload?.data) {
        const platform = payload.data[0].platform
        const channel_id = payload.data[0].channel_id
        const to_chat_room_id = payload.data[0].to_chat_room_id

        const key = `${platform}-${channel_id}-${to_chat_room_id}`

        const newData = payload.data.map(message => { return { ...message, contents: JSON.parse(message.contents) } })

        newData.sort((a, b) => { return b.createdAt, a.createdAt }).reverse()

        state.messages[key] = newData

        const newMessages = Object.assign({}, state.messages)

        state.messages = newMessages
      // }

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

export const selectChannels = (state) => state.messages?.channels;

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