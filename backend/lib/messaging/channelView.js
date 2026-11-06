// A channel as getUserSubscribedChannels shows it.
import { isWebChannel } from './whatsappGateway.js';
import { connectionView } from './whatsappWeb.js';

export const channelView = channel => ({
  channel_id: channel.id,
  platform: channel.platform,
  name: channel.name,
  enabled: channel.enabled,
  whatsapp_web: isWebChannel(channel) ? connectionView(channel) : null,
});
