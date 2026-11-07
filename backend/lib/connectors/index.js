// Every chat source MasterBox connects to, behind one set of methods. Sending a reply, reading a message and checking
// a connection go through the channel's connector, so nothing else needs to know which platform it is.
// A new source is one more file here, added to CONNECTORS.
//
// Each connector has:
//   source, platform          what it is, and the platform older clients still see
//   replies                   whether agents can answer its conversations here
//   capabilities(channel)     the optional features it supports, from CAPABILITIES
//   replyRule(room, { lastCustomerMessageAt, now })
//                             { state, closesAt, templateRequired, messagingTag, humanAgentAvailable, blockReason }:
//                             the platform's rules before replying; blockReason is why a free-form reply can't go now
//   send(target, part)        sends one part of a reply to { channel, customerId, messagingTag }; returns the
//                             platform's message id
//   normalize(raw)            a platform message in the unified shape (see messaging/messageBody.js)
//   connection(channel, { refresh, force })
//                             how its connection is doing, as SubscribedChannel.connection shows it
//   notReady(channel), recipient(room), checkAttachment(file), failureReason(error, channel)
//                             what the reply flow asks before and after sending
// and, with the templates capability: templatesUnavailable(channel), templates(channel), sendTemplate(target, payload).
import messenger from './messenger.js';
import instagram from './instagram.js';
import whatsappCloud from './whatsapp_cloud.js';
import whatsappWeb from './whatsapp_web.js';
import line from './line.js';
import masterbox from './masterbox.js';
import { unsupportedConnector } from './shared/base.js';
import { uncheckedConnection } from './shared/connection.js';
import { sourceOf, SOURCES, SOURCE_LABELS } from './source.js';

export { sourceOf, SOURCES, SOURCE_LABELS };

/**
 * The optional features a source can declare. What every source has (text, the conversation list, assignment,
 * tags, quick replies and so on) isn't listed: it never depends on the source.
 * Calls, disappearing messages, end-to-end encryption and groups are for Chat Box from phase 2; reactions, quoted
 * replies, read receipts and recalling messages wait until each platform's support is confirmed.
 */
export const CAPABILITIES = [
  'send_image', 'send_video', 'send_audio', 'send_document',
  'caption', 'reply_window', 'templates',
  'calls', 'disappearing', 'e2ee', 'groups',
  'reactions', 'quote_reply', 'read_receipts', 'recall',
];

export const CONNECTORS = {
  messenger,
  instagram,
  whatsapp_cloud: whatsappCloud,
  whatsapp_web: whatsappWeb,
  line,
  masterbox,
};

const fallback = channel => ({
  ...unsupportedConnector({ source: null, platform: channel?.platform, name: channel?.platform || '這個平台的' }),
  connection: uncheckedConnection,
});

/**
 * The connector for a channel, or for a conversation's channel (pass the channel, or `{ platform }` when it is gone).
 * A platform without a source, such as WeChat, gets one that can't reply.
 */
export const connectorFor = (channel) => CONNECTORS[sourceOf(channel)] || fallback(channel);

/** The features the channel's source supports, in CAPABILITIES order. */
export const capabilitiesOf = (channel) => {
  const declared = new Set(connectorFor(channel).capabilities(channel));
  return CAPABILITIES.filter(capability => declared.has(capability));
};
