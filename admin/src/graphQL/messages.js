import { gql, } from '@apollo/client';


// 送出訊息


export const SEND_MESSAGE = gql`

mutation Mutation($messageInput: MessageInput) {
  sendMessage(MessageInput: $messageInput) 
    {
    status
    message
  }
  
}

 `;




export const CHATROOMS_MESSAGES = gql`

query Query($paginationInput: PaginationInput $getChatRoomsMessagesInput: getChatRoomsMessagesInput) {
  getChatRoomsMessages(PaginationInput: $paginationInput, getChatRoomsMessagesInput: $getChatRoomsMessagesInput) {
    data {
      company_id
      _id
      contents
      platform
      to_chat_room_id
      channel_id
      sender
      createdAt
      updatedAt
    }
    meta {
      total
      limit
      page
      pages
    }
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
