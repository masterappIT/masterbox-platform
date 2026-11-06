import { gql } from 'apollo-server-express';

// WhatsApp numbers connected by scanning a QR code with the phone, through whatsapp-gateway.
export default gql`
  type WhatsappWebProgress {
    chats_total: Int!
    chats_done: Int!
    messages: Int!
  }
  "How a WhatsApp channel connected by QR code is doing."
  type WhatsappWebConnection {
    channel_id: ID!
    "starting, qr (waiting for a scan), authenticated, syncing (copying chats), ready, disconnected (reconnecting by itself), logged_out and qr_timeout (scan again), rejected (wrong number), failed, or offline (not running)."
    state: String!
    "A data: URL of the QR code to scan, while state is qr. It changes about every 20 seconds."
    qr: String
    "The connected number, such as +886912345678."
    phone: String
    "The name the number set in WhatsApp."
    name: String
    progress: WhatsappWebProgress
    error: String
    updated_at: DateTime
  }
  extend type SubscribedChannel {
    "The QR connection of a WhatsApp channel connected by scanning; null for other channels."
    whatsapp_web: WhatsappWebConnection
  }
  extend type Query {
    "A QR-connected channel's connection right now, with the newest QR code. Admins only."
    whatsappWebConnection(channel_id: ID!): WhatsappWebConnection!
  }
  extend type Mutation {
    "Starts connecting a WhatsApp number by QR code: a new channel without channel_id, or scanning again for an existing one. Admins only."
    connectWhatsappWeb(channel_id: ID): WhatsappWebConnection!
    "An 8-character code to enter on the phone instead of scanning. phone includes the country code."
    requestWhatsappWebPairingCode(channel_id: ID!, phone: String!): String!
    "Stops connecting. Returns true when a channel no phone ever connected was removed."
    cancelWhatsappWeb(channel_id: ID!): Boolean!
    "Names a QR-connected channel and adds agents who work in it."
    updateWhatsappWebChannel(channel_id: ID!, name: String!, agent_ids: [ID!]): SubscribedChannel!
  }
`;
