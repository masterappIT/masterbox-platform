import { gql } from 'apollo-server-express';

export default gql`
  "A file or other attachment in a message, the same for every source."
  type MessageAttachment {
    "image, video, audio, file, document, sticker, location, contacts, share and the like."
    type: String!
    "Our own copy of the file; null when it couldn't be saved or the attachment isn't a file."
    url: String
    filename: String
    mime_type: String
    size: Int
    caption: String
  }
  "The WhatsApp template a message was sent from."
  type MessageBodyTemplate {
    id: ID!
    name: String!
  }
  "What a message says, the same for every source and however it was stored."
  type MessageBody {
    text: String
    attachments: [MessageAttachment!]!
    template: MessageBodyTemplate
  }
  type Message {
    id: ID
    _id: ID
    platform: String
    "The stored contents as clients built before body read them. New clients read body."
    contents: String!
    text: String!
    "The message in the unified shape; null for an end-to-end encrypted message, which only its devices can read."
    body: MessageBody
    recipients: [String!]!
    to_chat_room_id: String
    info_Content: String
    channel_id: String
    encryption_mode: String
    disappearing_after_seconds: Int
    expiresAt: DateTime
    readAt: DateTime
    sentAt: DateTime
    "Sent by the signed-in account, rather than by the customer or a colleague."
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
  "An agent of the company, as colleagues see them."
  type Agent {
    id: ID!
    "The name they set, or their email."
    name: String!
    email: String!
    role: String
  }
  "Whether a conversation can still be answered, by Meta's rules for its platform."
  type ReplyWindow {
    "open: any reply. human_agent: Messenger and Instagram within 7 days, sent with the HUMAN_AGENT tag. closed: the window has passed. no_customer_message: the customer hasn't written. unsupported: the platform can't be answered here. no_limit: WhatsApp connected by QR code, which can always be answered."
    state: String!
    "When this state ends, or null when it doesn't."
    closesAt: DateTime
    "WhatsApp only accepts an approved template now."
    templateRequired: Boolean!
    "Meta approved this app for the 7-day human agent window, and the platform has one."
    humanAgentAvailable: Boolean!
  }
  type ChatRoom {
    id: ID!
    title: String
    platform: String
    "messenger, instagram, whatsapp_cloud, whatsapp_web, line or masterbox; null for a platform without one yet."
    source: String
    "The optional features of the conversation's source, such as send_image, caption, reply_window and templates."
    capabilities: [String!]!
    "open, pending or closed. Every conversation is open for now."
    status: String!
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
    "The customer's last message, which Meta's reply windows count from."
    lastCustomerMessageAt: DateTime
    replyWindow: ReplyWindow!
    "The agent handling the conversation; null while it is unassigned."
    assignee: Agent
    assignedAt: DateTime
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
    "messenger, instagram, whatsapp_cloud, whatsapp_web, line or masterbox."
    source: String
    channel_id: ID
    unread_only: Boolean
    "all (the default), mine: assigned to the signed-in account, or unassigned."
    assignment: String
    "Only the conversations this agent handles."
    assignee_id: ID
  }
  "How a channel's connection to its platform is doing, as last checked."
  type ChannelConnection {
    "ok, auth_expired (connect again through Meta), not_subscribed (Meta doesn't send its messages), error, disabled, or unknown (not checked yet, or the platform can't be checked)."
    state: String!
    "What to tell the admin, in Chinese."
    message: String
    checked_at: DateTime
  }
  type SubscribedChannel {
    channel_id: ID!
    platform: String!
    "messenger, instagram, whatsapp_cloud, whatsapp_web, line or masterbox; null for a platform without one yet."
    source: String
    "The optional features of the channel's source, such as send_image, caption, reply_window and templates."
    capabilities: [String!]!
    name: String!
    enabled: Boolean!
    "The WhatsApp number, such as +886 912 345 678; null for other platforms."
    phone: String
    "Null for WhatsApp numbers connected by QR code, which have whatsapp_web instead. Admins' lists ask Meta again when the last check is 10 minutes old."
    connection: ChannelConnection
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
  type WhatsappTemplateVariable {
    "Pass back as the key of a WhatsappTemplateValue, such as body:1 or header:media."
    key: String!
    "header, header_media, body, button or coupon."
    component: String!
    name: String!
    label: String!
    example: String
  }
  type WhatsappTemplateButton {
    type: String!
    text: String
    url: String
    phone_number: String
  }
  "An approved WhatsApp template of the conversation's number."
  type WhatsappTemplate {
    id: ID!
    name: String!
    language: String!
    category: String
    "TEXT, IMAGE, VIDEO, DOCUMENT or LOCATION; null without a header."
    header_format: String
    header_text: String
    body_text: String!
    footer_text: String
    buttons: [WhatsappTemplateButton!]!
    variables: [WhatsappTemplateVariable!]!
    "False when it has something the chat can't fill in; unsupported_reason says what."
    supported: Boolean!
    unsupported_reason: String
  }
  input WhatsappTemplateValue {
    key: String!
    value: String!
  }
  type Mutation {
    appSendMessage(MessageInput: MessageInput): Message
    markMessageRead(messageId: ID!): Message
    setChannelEnabled(channel_id: ID!, enabled: Boolean!): SubscribedChannel!
    "Removes one of the company's channels: it stops taking in and sending messages and its conversations are hidden. Connecting the same account or number again brings them back. Admins only."
    deleteChannel(channel_id: ID!): Boolean!
    "Asks the platform now how the channel's connection is doing. Admins only."
    checkChannelConnection(channel_id: ID!): SubscribedChannel!
    "Marks the conversation read for the signed-in account, up to messageId or its newest message."
    markChatRoomRead(id: ID!, messageId: ID): ChatRoom!
    addChatRoomTag(id: ID!, name: String!): ChatRoom!
    removeChatRoomTag(id: ID!, tagId: ID!): ChatRoom!
    "Hands the conversation to an agent who works in its channel, or leaves it unassigned when assigneeId is null."
    assignChatRoom(id: ID!, assigneeId: ID): ChatRoom!
    "Sends an approved WhatsApp template in the conversation; header_media_url is an uploaded file for an image, video or document header."
    sendWhatsappTemplate(id: ID!, templateId: ID!, values: [WhatsappTemplateValue!], header_media_url: String): Message!
  }
  type Query {
    Message: Message
    getUserSubscribedChannels: [SubscribedChannel!]!
    chatRooms: [ChatRoom!]!
    messages(conversationId: ID, roomId: ID): [Message!]!
    "The conversations in the signed-in account's channels, newest message first."
    chatRoomPage(first: Int, after: String, filter: ChatRoomFilter): ChatRoomPage!
    "How many of the signed-in account's conversations have customer messages it hasn't read."
    unreadChatRoomCount: Int!
    "One conversation, by its id or by the chat_room_id and channel_id that messages carry."
    chatRoom(id: ID, chat_room_id: String, channel_id: ID): ChatRoom
    "A conversation's messages: the newest by default, older ones with before, newer ones with after."
    messagePage(id: ID!, first: Int, before: String, after: String): MessagePage!
    customerTags: [CustomerTag!]!
    "The agents a conversation can be assigned to; without id, every enabled agent of the company."
    chatRoomAssignees(id: ID): [Agent!]!
    "The approved templates of a WhatsApp conversation's number, read from Meta."
    whatsappTemplates(id: ID!): [WhatsappTemplate!]!
  }
  type Subscription {
    sendMessage: Message
    "A conversation in the signed-in account's channels changed, such as its agent or its tags."
    chatRoomUpdated: ChatRoom
  }
`;
