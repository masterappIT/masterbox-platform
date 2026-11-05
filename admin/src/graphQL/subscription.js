import { gql, } from '@apollo/client';








const SUBSCRIBE_MESSAGE = gql`

subscription MessageEvents {
  sendMessage {
    _id
    contents
    platform
    to_chat_room_id
    channel_id
    sentAt
    inbound
    delivery_error
  }
}

`;

export { SUBSCRIBE_MESSAGE }