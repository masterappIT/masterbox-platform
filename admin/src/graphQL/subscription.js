import { gql, } from '@apollo/client';
import { MESSAGE_FIELDS } from './messages';








const SUBSCRIBE_MESSAGE = gql`

subscription MessageEvents {
  sendMessage {
    ${MESSAGE_FIELDS}
  }
}

`;

export { SUBSCRIBE_MESSAGE }