// What a conversation's source can do, as the server declares it (ChatRoom.capabilities, SubscribedChannel.capabilities).
// The chat room shows its basic features for every source and an optional one only when the source declares it,
// so nothing here asks which platform a conversation is on.

/** What people see for each source; the same names as the server's SOURCE_LABELS. */
export const SOURCE_LABELS = {
  messenger: 'Facebook',
  instagram: 'Instagram',
  whatsapp_cloud: 'WhatsApp 官方',
  whatsapp_web: 'WhatsApp 掃碼',
  line: 'LINE',
  masterbox: 'MasterBox',
};

/** The sources the conversation list can filter on, in the order the filter offers them. */
export const SOURCES = Object.keys(SOURCE_LABELS);

/** The name of a source, or null when the conversation has none (such as WeChat). */
export const sourceLabel = (source) => SOURCE_LABELS[source] || null;

/** Whether the source declares an optional feature, such as 'templates' or 'reply_window'. */
export const can = (capabilities, capability) => Array.isArray(capabilities) && capabilities.includes(capability);

// The capability that lets a kind of file be sent, by the kinds attachmentRules sorts files into.
const ATTACHMENT_CAPABILITIES = { image: 'send_image', video: 'send_video', audio: 'send_audio', file: 'send_document' };

/** Whether a kind of file (image, video, audio or file) can be sent. */
export const canSendKind = (capabilities, kind) => can(capabilities, ATTACHMENT_CAPABILITIES[kind]);

/** Whether any kind of file can be sent, which decides whether the 附件 button shows. */
export const canSendFiles = (capabilities) => Object.values(ATTACHMENT_CAPABILITIES).some((capability) => can(capabilities, capability));

/**
 * The features of a conversation: its own list, or its channel's for a copy of the conversation made before the
 * server sent capabilities (one a live message created, say).
 */
export const capabilitiesOf = (room, channel) => {
  if (Array.isArray(room?.capabilities)) return room.capabilities;
  if (Array.isArray(channel?.capabilities)) return channel.capabilities;
  return [];
};

/**
 * What the message box offers for a conversation. The basic tools (text, emoji, quick replies) are always there;
 * attaching files and templates only when the source declares them.
 * @param capabilities - the conversation's source's
 * @param replyState - replyWindowOf's answer: null when the source has no reply window
 * @returns {{ canWrite: boolean, files: boolean, templates: boolean, templateOnly: boolean }}
 *   canWrite: the agent can write their own reply now. templateOnly: only a template can go now, so the send
 *   button opens the templates.
 */
export const composerTools = (capabilities, replyState = null) => {
  const blocked = Boolean(replyState && (replyState.templateRequired || replyState.state === 'unsupported'));
  const templates = can(capabilities, 'templates');
  return {
    canWrite: !blocked,
    files: !blocked && canSendFiles(capabilities),
    templates,
    templateOnly: blocked && templates && replyState?.state !== 'unsupported',
  };
};

/**
 * The second line of a channel in the channel menu: its phone number (WhatsApp) or its page or account name
 * (Facebook, Instagram), after the source's name. Never the internal id.
 */
export const channelSubtitle = (channel) => {
  if (!channel) return '';
  return [sourceLabel(channel.source), channel.phone || channel.name].filter(Boolean).join('・');
};

/**
 * The sources the conversation list can filter on: those of the account's channels, in SOURCES order.
 * Only worth a filter when there are two or more.
 */
export const sourcesOfChannels = (channels) => {
  const present = new Set((channels || []).map(({ source }) => source).filter(Boolean));
  return SOURCES.filter((source) => present.has(source));
};
