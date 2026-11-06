import { gql, } from '@apollo/client';



//  find channel_id


// A WhatsApp number connected by scanning a QR code, as whatsapp-gateway reports it.
const WHATSAPP_WEB_FIELDS = `channel_id state qr phone name error updated_at progress { chats_total chats_done messages }`;

export const GET_USER_SUBSCRIBED_CHANNELS = gql`

query GetUserSubscribedChannels {
  getUserSubscribedChannels {
    platform
    name
    channel_id
    enabled
    whatsapp_web {
      ${WHATSAPP_WEB_FIELDS}
    }
  }
}
 `;

// The channel list of 社群平台管理, with how each channel's connection is doing. Reading it may ask Meta again,
// so the other pages use GET_USER_SUBSCRIBED_CHANNELS.
const CONNECTION_FIELDS = `state message checked_at`;

export const GET_CHANNELS_WITH_CONNECTION = gql`

query GetChannelsWithConnection {
  getUserSubscribedChannels {
    platform
    name
    channel_id
    enabled
    phone
    connection {
      ${CONNECTION_FIELDS}
    }
    whatsapp_web {
      ${WHATSAPP_WEB_FIELDS}
    }
  }
}
 `;

// Removes a channel: it stops taking in and sending messages; connecting the same account again brings it back.
export const DELETE_CHANNEL = gql`

mutation DeleteChannel($channelId: ID!) {
  deleteChannel(channel_id: $channelId)
}
 `;

// Asks the platform now, skipping the 10-minute wait between checks.
export const CHECK_CHANNEL_CONNECTION = gql`

mutation CheckChannelConnection($channelId: ID!) {
  checkChannelConnection(channel_id: $channelId) {
    channel_id
    phone
    connection {
      ${CONNECTION_FIELDS}
    }
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

const AGENT_FIELDS = `id name email role`;

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
    assignee {
      ${AGENT_FIELDS}
    }
    assignedAt
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

// Hands the conversation to an agent, or leaves it unassigned with a null assigneeId.
export const ASSIGN_CHAT_ROOM = gql`
mutation AssignChatRoom($id: ID!, $assigneeId: ID) {
  assignChatRoom(id: $id, assigneeId: $assigneeId) {
    ${ROOM_FIELDS}
  }
}
`;

// Who a conversation can go to; without an id, every agent of the company.
export const CHAT_ROOM_ASSIGNEES = gql`
query ChatRoomAssignees($id: ID) {
  chatRoomAssignees(id: $id) {
    ${AGENT_FIELDS}
  }
}
`;

// A conversation in the account's channels changed, such as its agent or its tags.
export const SUBSCRIBE_CHAT_ROOM_UPDATES = gql`
subscription ChatRoomUpdates {
  chatRoomUpdated {
    ${ROOM_FIELDS}
  }
}
`;

// Starts connecting a WhatsApp number by QR code: a new channel, or scanning again for channelId.
export const CONNECT_WHATSAPP_WEB = gql`
mutation ConnectWhatsappWeb($channelId: ID) {
  connectWhatsappWeb(channel_id: $channelId) {
    ${WHATSAPP_WEB_FIELDS}
  }
}
`;

// The connection right now, with the newest QR code; polled while the scan dialog is open.
export const WHATSAPP_WEB_CONNECTION = gql`
query WhatsappWebConnection($channelId: ID!) {
  whatsappWebConnection(channel_id: $channelId) {
    ${WHATSAPP_WEB_FIELDS}
  }
}
`;

export const REQUEST_WHATSAPP_WEB_PAIRING_CODE = gql`
mutation RequestWhatsappWebPairingCode($channelId: ID!, $phone: String!) {
  requestWhatsappWebPairingCode(channel_id: $channelId, phone: $phone)
}
`;

export const CANCEL_WHATSAPP_WEB = gql`
mutation CancelWhatsappWeb($channelId: ID!) {
  cancelWhatsappWeb(channel_id: $channelId)
}
`;

export const UPDATE_WHATSAPP_WEB_CHANNEL = gql`
mutation UpdateWhatsappWebChannel($channelId: ID!, $name: String!, $agentIds: [ID!]) {
  updateWhatsappWebChannel(channel_id: $channelId, name: $name, agent_ids: $agentIds) {
    channel_id
    name
  }
}
`;
