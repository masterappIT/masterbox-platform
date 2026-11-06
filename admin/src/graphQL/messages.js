import { gql, } from '@apollo/client';

// What the admin shows of a message. `cursor` places it in its conversation for paging and catching up.
export const MESSAGE_FIELDS = `
    _id
    contents
    platform
    channel_id
    to_chat_room_id
    sentAt
    inbound
    delivery_error
    preview
    cursor
`;

// 送出訊息
export const SEND_MESSAGE = gql`
mutation SendMessage($messageInput: MessageInput) {
  appSendMessage(MessageInput: $messageInput) {
    ${MESSAGE_FIELDS}
  }
}
`;

// Every message of a conversation, for pages that don't page through them yet.
export const CHATROOMS_MESSAGES = gql`
query ChatRoomMessages($roomId: ID) {
  messages(roomId: $roomId) {
    ${MESSAGE_FIELDS}
  }
}
`;

// A page of a conversation: the newest messages, older ones with before, or newer ones with after.
export const MESSAGE_PAGE = gql`
query MessagePage($id: ID!, $first: Int, $before: String, $after: String) {
  messagePage(id: $id, first: $first, before: $before, after: $after) {
    messages {
      ${MESSAGE_FIELDS}
    }
    hasOlder
    hasNewer
  }
}
`;
