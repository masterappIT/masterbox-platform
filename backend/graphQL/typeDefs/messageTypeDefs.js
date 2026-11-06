import { gql } from 'apollo-server-express';

export default gql`
  type Message {
    id: ID
    _id: ID
    platform: String
    contents: String!
    text: String!
    recipients: [String!]!
    to_chat_room_id: String
    info_Content: String
    channel_id: String
    encryption_mode: String
    disappearing_after_seconds: Int
    expiresAt: DateTime
    readAt: DateTime
    sentAt: DateTime
    isMine: Boolean
    inbound: Boolean
    delivery_error: String
    "A line for the conversation list, such as the text or [圖片]."
    preview: String
    "Where this message is in its conversation, for messagePage's before and after."
    cursor: String
  }
  type ChatRoomUser {
    id: String
    name: String
    first_name: String
    last_name: String
    avatar: String
  }
  "The customer in a conversation, as far as the platform tells us. Fields it doesn't share are null."
  type ChatRoomCustomer {
    id: String!
    name: String
    avatar: String
    username: String
    phone: String
  }
  type CustomerTag {
    id: ID!
    name: String!
  }
  type ChatRoom {
    id: ID!
    title: String
    platform: String
    channel_id: String
    channel_name: String
    chat_room_id: String
    users: [ChatRoomUser!]!
    customer: ChatRoomCustomer
    tags: [CustomerTag!]!
    "The last message, as one line; attachments show as [圖片] and the like."
    lastMessage: String
    lastMessageAt: DateTime
    lastMessageInbound: Boolean
    "Customer messages the signed-in account hasn't read."
    unreadCount: Int!
    createdAt: DateTime
    updatedAt: DateTime
  }
  type ChatRoomPage {
    rooms: [ChatRoom!]!
    "Pass as after for the next page; null on the last page."
    nextCursor: String
    hasMore: Boolean!
  }
  type MessagePage {
    "Oldest first."
    messages: [Message!]!
    hasOlder: Boolean
    hasNewer: Boolean!
  }
  input ChatRoomFilter {
    "Matches the customer's name, username or id, or the text of a message."
    search: String
    platform: String
    channel_id: ID
    unread_only: Boolean
  }
  type SubscribedChannel {
    channel_id: ID!
    platform: String!
    name: String!
    enabled: Boolean!
  }
  input MessageInput {
    to_chat_room_id: String
    contents: String!
    encryption_mode: String
    disappearing_after_seconds: Int
    platform: String
    info_Content: String
    channel_id: String
  }
  type Mutation {
    appSendMessage(MessageInput: MessageInput): Message
    markMessageRead(messageId: ID!): Message
    setChannelEnabled(channel_id: ID!, enabled: Boolean!): SubscribedChannel!
    "Marks the conversation read for the signed-in account, up to messageId or its newest message."
    markChatRoomRead(id: ID!, messageId: ID): ChatRoom!
    addChatRoomTag(id: ID!, name: String!): ChatRoom!
    removeChatRoomTag(id: ID!, tagId: ID!): ChatRoom!
  }
  type Query {
    Message: Message
    getUserSubscribedChannels: [SubscribedChannel!]!
    chatRooms: [ChatRoom!]!
    messages(conversationId: ID, roomId: ID): [Message!]!
    "The conversations in the signed-in account's channels, newest message first."
    chatRoomPage(first: Int, after: String, filter: ChatRoomFilter): ChatRoomPage!
    "One conversation, by its id or by the chat_room_id and channel_id that messages carry."
    chatRoom(id: ID, chat_room_id: String, channel_id: ID): ChatRoom
    "A conversation's messages: the newest by default, older ones with before, newer ones with after."
    messagePage(id: ID!, first: Int, before: String, after: String): MessagePage!
    customerTags: [CustomerTag!]!
  }
  type Subscription { sendMessage: Message }
`;
