// Which channels' conversations an account may read and answer.
// Admins work in every channel of their company; other accounts only in the channels assigned to them.
import { prisma } from '../db/prisma.js';

/** Who can see a channel's conversations, as a Prisma account filter. */
const seesChannel = channelId => ({ enabled: true, OR: [{ role: 'admin' }, { subscribedChannels: { some: { channelId } } }] });

/**
 * The ids of the channels whose conversations the account may see, read from the database
 * so a role or channel change applies straight away. A disabled or unknown account sees none.
 */
export const visibleChannelIds = async (account) => {
  if (!account?.account_id || !account?.company_id) return [];
  const record = await prisma.account.findFirst({
    where: { id: account.account_id, companyId: account.company_id, enabled: true },
    select: { role: true },
  });
  if (!record) return [];
  const channels = await prisma.companyChannel.findMany({
    where: { companyId: account.company_id, ...(record.role === 'admin' ? {} : { accounts: { some: { accountId: account.account_id } } }) },
    select: { id: true },
  });
  return channels.map(({ id }) => id);
};

/** The account's channels, ordered by name, as getUserSubscribedChannels shows them. */
export const visibleChannels = async (account) => {
  const ids = await visibleChannelIds(account);
  if (!ids.length) return [];
  return prisma.companyChannel.findMany({ where: { id: { in: ids } }, orderBy: { name: 'asc' } });
};

/** The enabled accounts of the company that work in the channel: everyone its live updates go to. */
export const channelAccountIds = async (companyId, channelId) => {
  if (!companyId || !channelId) return [];
  const accounts = await prisma.account.findMany({ where: { companyId, ...seesChannel(channelId) }, select: { id: true } });
  return accounts.map(({ id }) => id);
};

/** Whether this account of the company can work in the channel. */
export const accountSeesChannel = async (companyId, accountId, channelId) => Boolean(await prisma.account.findFirst({
  where: { id: accountId, companyId, ...seesChannel(channelId) },
  select: { id: true },
}));

/** Accounts of the company, enabled, that can work in the channel, or in any channel without one. */
export const companyAgents = (companyId, channelId) => prisma.account.findMany({
  where: { companyId, ...(channelId ? seesChannel(channelId) : { enabled: true }) },
  select: { id: true, email: true, role: true, userInfo: true },
  orderBy: { email: 'asc' },
});
