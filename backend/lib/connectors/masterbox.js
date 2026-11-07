// Chat Box, MasterBox's own chat, from phase 2. Chat Box (/chat-management) keeps its current behaviour until then;
// this only reserves the source, so nothing sends through it yet.
import { unsupportedConnector } from './shared/base.js';
import { uncheckedConnection } from './shared/connection.js';

export default {
  ...unsupportedConnector({ source: 'masterbox', platform: null, name: 'MasterBox' }),
  // MasterBox's own conversations have no platform window.
  replyRule: () => ({ state: 'no_limit', closesAt: null, templateRequired: false, messagingTag: null, humanAgentAvailable: false, blockReason: null }),
  connection: uncheckedConnection,
};
