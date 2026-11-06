import { requireAdmin } from '../../middleware/auth.js';
import {
  connectWhatsappWeb, whatsappWebConnection, whatsappWebPairingCode, cancelWhatsappWeb, updateWhatsappWebChannel,
} from '../../lib/messaging/whatsappWeb.js';
import { channelView } from '../../lib/messaging/channelView.js';

export default {
  Query: {
    whatsappWebConnection: (_, { channel_id }, context) => whatsappWebConnection(requireAdmin(context), channel_id),
  },
  Mutation: {
    connectWhatsappWeb: (_, { channel_id }, context) => connectWhatsappWeb(requireAdmin(context), channel_id),
    requestWhatsappWebPairingCode: (_, { channel_id, phone }, context) => whatsappWebPairingCode(requireAdmin(context), channel_id, phone),
    cancelWhatsappWeb: (_, { channel_id }, context) => cancelWhatsappWeb(requireAdmin(context), channel_id),
    async updateWhatsappWebChannel(_, { channel_id, name, agent_ids }, context) {
      return channelView(await updateWhatsappWebChannel(requireAdmin(context), channel_id, { name, agentIds: agent_ids || [] }));
    },
  },
};
