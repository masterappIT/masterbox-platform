import { gql, } from '@apollo/client';


// 送出訊息


export const SEND_MESSAGE = gql`

mutation SendMessage($messageInput: MessageInput) {
  appSendMessage(MessageInput: $messageInput) {
    _id
    contents
    platform
    channel_id
    to_chat_room_id
    sentAt
    inbound
  }
}

 `;




export const CHATROOMS_MESSAGES = gql`

query ChatRoomMessages($roomId: ID) {
  messages(roomId: $roomId) {
    _id
    contents
    platform
    channel_id
    to_chat_room_id
    sentAt
    inbound
  }
}
 `;



// export const APPSENDMESSAGE = gql`
// mutation AppSendMessage( $contents: String! $platform:String $recipients:{[channel_id: String! to_chat_room_id: String!]} ) {
//     appSendMessage(MessageInput:{to_chat_room_id: $to_chat_room_id, contents: $contents, platform: $platform, info_Content: $info_Content, channel_id: $channel_id}) {
//     appSendMessage(MessageInput:{company_id: $company_id, email: $email, password: $password}) {
//     _id
//     platform
//     contents
//     recipients
//   }
// }
//  `;
