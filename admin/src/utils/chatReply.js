// What the admin sends to appSendMessage for a reply: the same for every source. The server finds the customer from
// the stored conversation and lets the source's connector turn the text and file into what its platform accepts.

/**
 * @param room - the conversation: chat_room_id, channel_id, platform
 * @param {{ text?: string, attachments?: object[] }} reply
 * @returns the MessageInput
 */
export const replyInput = (room, { text, attachments } = {}) => ({
  to_chat_room_id: room.chat_room_id,
  channel_id: room.channel_id,
  platform: room.platform,
  contents: JSON.stringify({
    ...(text ? { text } : {}),
    ...(attachments?.length ? { attachments } : {}),
  }),
});
