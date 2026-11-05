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
  }
  type ChatRoomUser {
    id: String
    name: String
    first_name: String
    last_name: String
    avatar: String
  }
  type ChatRoom {
    id: ID!
    title: String
    platform: String
    channel_id: String
    chat_room_id: String
    users: [ChatRoomUser!]!
    lastMessage: String
    updatedAt: DateTime
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
  }
  type Query {
    Message: Message
    getUserSubscribedChannels: [SubscribedChannel!]!
    chatRooms: [ChatRoom!]!
    messages(conversationId: ID, roomId: ID): [Message!]!
  }
  type Subscription { sendMessage: Message }
`;
