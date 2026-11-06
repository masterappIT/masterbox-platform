import { gql } from 'apollo-server-express';

export default gql`
  extend type Query {
    "Whether this server can send push notifications to phones."
    pushNotificationsAvailable: Boolean!
  }
  extend type Mutation {
    "This phone gets a notification when a customer writes in one of the signed-in account's conversations. platform is ios; Android has no push yet."
    registerPushDevice(token: String!, platform: String!): Boolean!
    "This phone stops getting the signed-in account's notifications."
    unregisterPushDevice(token: String!): Boolean!
  }
`;
