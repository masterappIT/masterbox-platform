// A channel as getUserSubscribedChannels shows it.
import { isWebChannel } from './whatsappGateway.js';
import { connectionView } from './whatsappWeb.js';
import { channelConnection } from './channels.js';
import { sourceOf, capabilitiesOf } from '../connectors/index.js';

export const channelView = channel => ({
  channel_id: channel.id,
  platform: channel.platform,
  source: sourceOf(channel),
  capabilities: capabilitiesOf(channel),
  name: channel.name,
  enabled: channel.enabled,
  phone: (isWebChannel(channel) ? channel.accessInfo?.phone : channel.info?.display_phone_number) || null,
  whatsapp_web: isWebChannel(channel) ? connectionView(channel) : null,
  // Only worked out when asked for. Admins' lists check Meta again once the last check is 10 minutes old.
  connection: (_, context) => channelConnection(channel, { refresh: context?.account?.role === 'admin' }),
});
