import { gql, } from '@apollo/client';



//  find channel_id


export const GET_USER_SUBSCRIBED_CHANNELS = gql`

query GetUserSubscribedChannels {
  getUserSubscribedChannels {
    platform
    name
    channel_id
  }
}
 `;


//  find chatroom
export const CHATROOMS = gql`

query ChatRooms {
  chatRooms {
    platform
    channel_id
    users {
      id
      name
      last_name
      first_name
      avatar
    }
    chat_room_id
    updatedAt
  }
}
 `;
