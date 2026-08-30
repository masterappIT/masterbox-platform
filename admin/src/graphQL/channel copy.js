import { gql, } from '@apollo/client';



//  find channel_id


export const GET_USER_SUBSCRIBED_CHANNELS = gql`

query Query($paginationInput: PaginationInput) {
  getUserSubscribedChannels(PaginationInput: $paginationInput) {
    platform
    name
    account
    active
    authorized
    channel_id
  }
}
 `;


//  find chatroom
export const CHATROOMS = gql`

query Query($findChatsRoomInput: FindChatsRoomInput $paginationInput: PaginationInput) {
  chatRooms(FindChatsRoomInput: $findChatsRoomInput, PaginationInput: $paginationInput) {
    platform
    channel_id
    users {
      id
      last_name
      first_name
      avatar
    }
    chat_room_id
  }
}
 `;
export const CHATROOM_USERS = gql`

query Query($findChatsRoomInput: FindChatsRoomInput) {
  chatRooms(FindChatsRoomInput: $findChatsRoomInput) {
    users {
      id
      last_name
      first_name
      avatar
    }
  }
}
 `;









