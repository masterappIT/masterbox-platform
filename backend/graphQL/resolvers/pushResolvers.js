import { ApolloError } from 'apollo-server-errors';
import { withAuth } from '../../middleware/auth.js';
import { registerDevice, unregisterDevice, pushConfigured, messageNotifiesAccount } from '../../lib/push/notifications.js';

const signedIn = ({ account, isAuth }) => {
  withAuth(Boolean(isAuth || account));
  if (!account?.company_id || !account?.account_id) throw new ApolloError('Invalid account', 'UNAUTHENTICATED');
  return account;
};

export default {
  Query: {
    pushNotificationsAvailable: (_, __, context) => {
      signedIn(context);
      return pushConfigured();
    },
    messageNotifiesMe: (_, { chat_room_id, channel_id }, context) => (
      messageNotifiesAccount(signedIn(context), { chatRoomId: chat_room_id, channelId: channel_id })
    ),
  },
  Mutation: {
    async registerPushDevice(_, { token, platform }, context) {
      await registerDevice(signedIn(context), { token, platform });
      return true;
    },
    async unregisterPushDevice(_, { token }, context) {
      await unregisterDevice(signedIn(context), { token });
      return true;
    },
  },
};
