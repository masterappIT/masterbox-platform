import { gql, } from '@apollo/client';



//  find channel_id


export const GET_USER_SUBSCRIBED_CHANNELS = gql`

query GetUserSubscribedChannels {
  getUserSubscribedChannels {
    platform
    name
    channel_id
    enabled
  }
}
 `;

// Switches a channel on or off for the whole company.
export const SET_CHANNEL_ENABLED = gql`

mutation SetChannelEnabled($channelId: ID!, $enabled: Boolean!) {
  setChannelEnabled(channel_id: $channelId, enabled: $enabled) {
    channel_id
    enabled
  }
}
 `;


// Where to send the browser to connect Meta channels to the signed-in account's company.
export const CREATE_META_CONNECT_URL = gql`

mutation CreateMetaConnectUrl($returnUrl: String!) {
  createMetaConnectUrl(return_url: $returnUrl)
}
 `;

const ROOM_FIELDS = `
    id
    platform
    channel_id
    channel_name
    chat_room_id
    users {
      id
      name
      last_name
      first_name
      avatar
    }
    customer {
      id
      name
      avatar
      username
      phone
    }
    tags {
      id
      name
    }
    lastMessage
    lastMessageAt
    lastMessageInbound
    unreadCount
    lastCustomerMessageAt
    replyWindow {
      state
      closesAt
      templateRequired
      humanAgentAvailable
    }
    createdAt
    updatedAt
`;

//  find chatroom: every conversation of the company, for pages that don't page through them.
export const CHATROOMS = gql`
query ChatRooms {
  chatRooms {
    ${ROOM_FIELDS}
  }
}
`;

// A page of the signed-in account's conversations, newest message first.
export const CHAT_ROOM_PAGE = gql`
query ChatRoomPage($first: Int, $after: String, $filter: ChatRoomFilter) {
  chatRoomPage(first: $first, after: $after, filter: $filter) {
    rooms {
      ${ROOM_FIELDS}
    }
    nextCursor
    hasMore
  }
}
`;

// One conversation, by its id or by the ids a message carries.
export const CHAT_ROOM = gql`
query ChatRoom($id: ID, $chatRoomId: String, $channelId: ID) {
  chatRoom(id: $id, chat_room_id: $chatRoomId, channel_id: $channelId) {
    ${ROOM_FIELDS}
  }
}
`;

export const MARK_CHAT_ROOM_READ = gql`
mutation MarkChatRoomRead($id: ID!, $messageId: ID) {
  markChatRoomRead(id: $id, messageId: $messageId) {
    id
    unreadCount
  }
}
`;

export const CUSTOMER_TAGS = gql`
query CustomerTags {
  customerTags {
    id
    name
  }
}
`;

export const ADD_CHAT_ROOM_TAG = gql`
mutation AddChatRoomTag($id: ID!, $name: String!) {
  addChatRoomTag(id: $id, name: $name) {
    id
    tags {
      id
      name
    }
  }
}
`;

export const REMOVE_CHAT_ROOM_TAG = gql`
mutation RemoveChatRoomTag($id: ID!, $tagId: ID!) {
  removeChatRoomTag(id: $id, tagId: $tagId) {
    id
    tags {
      id
      name
    }
  }
}
`;
