// Removing a channel from 社群平台管理, and how each channel's connection to its platform is doing.
// A removed channel keeps its conversations: connecting the same Meta account or WhatsApp number again brings them back.
import { ApolloError } from 'apollo-server-errors';
import { prisma } from '../db/prisma.js';
import { isWebChannel, removeSession } from './whatsappGateway.js';
import { connectorFor } from '../connectors/index.js';

/**
 * Removes one of the admin's company channels. It stops taking in and sending messages and disappears from the
 * channel list and the conversation lists. A QR-connected number is logged out, which removes the linked device from
 * the phone; one no phone ever connected is deleted outright.
 * @returns {Promise<boolean>}
 */
export const deleteChannel = async (admin, channelId) => {
  const channel = await prisma.companyChannel.findUnique({ where: { id: channelId } });
  if (!channel || channel.companyId !== admin.company_id || channel.deletedAt) throw new ApolloError('找不到這個頻道', 'NOT_FOUND');

  if (isWebChannel(channel)) {
    // The gateway is told again on its next report, which a removed channel answers with 410, so it may be down now.
    await removeSession(channel.id).catch((error) => console.warn(`WhatsApp channel ${channel.id} not logged out now: ${error.message}`));
    if (!channel.accessInfo?.phone) {
      await prisma.companyChannel.delete({ where: { id: channel.id } });
      return true;
    }
  }

  const { access_token: _token, user_access_token: _userToken, ...accessInfo } = channel.accessInfo || {};
  await prisma.companyChannel.update({
    where: { id: channel.id },
    data: { deletedAt: new Date(), enabled: false, accessInfo, info: { ...(channel.info || {}), connection: null } },
  });
  return true;
};

// --- Connection status ---------------------------------------------------------------------------------------
// How each platform is checked lives in its connector (lib/connectors).

export { failureStatus } from '../connectors/shared/meta.js';
export { markChannelAuthExpired } from '../connectors/shared/connection.js';

/**
 * The channel's connection as SubscribedChannel.connection shows it. QR-connected numbers have whatsapp_web instead.
 * @param {{ refresh?: boolean, force?: boolean }} [options] - refresh: ask the platform when the last check is older
 *   than 10 minutes; force: ask now
 */
export const channelConnection = (channel, options = {}) => connectorFor(channel).connection(channel, options);
