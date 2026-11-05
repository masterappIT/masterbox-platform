import { gql, } from '@apollo/client';



//  find channel_id


export const GET_USER_SUBSCRIBED_CHANNELS = gql`

query GetUserSubscribedChannels {
  getUserSubscribedChannels {
    platform
    name
    channel_id
    enabled
  }
}
 `;

// Switches a channel on or off for the whole company.
export const SET_CHANNEL_ENABLED = gql`

mutation SetChannelEnabled($channelId: ID!, $enabled: Boolean!) {
  setChannelEnabled(channel_id: $channelId, enabled: $enabled) {
    channel_id
    enabled
  }
}
 `;


// Where to send the browser to connect Meta channels to the signed-in account's company.
export const CREATE_META_CONNECT_URL = gql`

mutation CreateMetaConnectUrl($returnUrl: String!) {
  createMetaConnectUrl(return_url: $returnUrl)
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
