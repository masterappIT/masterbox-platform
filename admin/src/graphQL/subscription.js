import { gql, } from '@apollo/client';








const SUBSCRIBE_MESSAGE = gql`

subscription Subscription($accountId: String) {
  sendMessage(accountId: $accountId) {
   company_id
    _id
    contents
    platform
    to_chat_room_id
    channel_id
    sender
    recipient
    createdAt
      updatedAt
  }
}

`;

export { SUBSCRIBE_MESSAGE }