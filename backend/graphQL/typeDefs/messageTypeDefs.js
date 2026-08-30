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
  }
  type ChatRoom {
    id: ID!
    title: String
    platform: String
    channel_id: String
    lastMessage: String
    updatedAt: DateTime
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
    receivedMessageFromWebhook(MessageInput: MessageInput): Message
    appSendMessage(MessageInput: MessageInput): Message
    markMessageRead(messageId: ID!): Message
  }
  type Query {
    Message: Message
    chatRooms: [ChatRoom!]!
    messages(conversationId: ID, roomId: ID): [Message!]!
  }
  type Subscription { sendMessage(accountId: String): Message }
`;
