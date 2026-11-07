// Which source a channel is. No imports, so anything can use it without pulling in the connectors.

/** Every source a channel can be, as stored in company_channels.source. */
export const SOURCES = ['messenger', 'instagram', 'whatsapp_cloud', 'whatsapp_web', 'line', 'masterbox'];

/** What people see for each source. */
export const SOURCE_LABELS = {
  messenger: 'Facebook',
  instagram: 'Instagram',
  whatsapp_cloud: 'WhatsApp 官方',
  whatsapp_web: 'WhatsApp 掃碼',
  line: 'LINE',
  masterbox: 'MasterBox',
};

/**
 * The source a channel's platform and connection details point to: the same rule the channel_source migration
 * filled the column with. WhatsApp numbers connected by QR code have provider 'web' in accessInfo.
 * @returns {string | null} null for a platform without a source, such as WeChat
 */
export const sourceFromPlatform = (platform, accessInfo) => {
  if (platform === 'fb') return 'messenger';
  if (platform === 'ig') return 'instagram';
  if (platform === 'whatsapp') return accessInfo?.provider === 'web' ? 'whatsapp_web' : 'whatsapp_cloud';
  if (platform === 'line') return 'line';
  return null;
};

/**
 * A channel's source: the stored one, or worked out from its platform for a row written before the column existed.
 * @param {{ source?: string|null, platform?: string, accessInfo?: object }} channel
 */
export const sourceOf = (channel) => {
  if (!channel) return null;
  if (SOURCES.includes(channel.source)) return channel.source;
  return sourceFromPlatform(channel.platform, channel.accessInfo);
};
