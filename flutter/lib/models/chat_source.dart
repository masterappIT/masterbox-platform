/// Where a conversation comes from, and the optional features that source
/// supports, as the backend declares them (backend/lib/connectors). The chat
/// room shows its basic parts for every source and adds the optional ones only
/// when the source lists them, so nothing here checks a platform's name.
library;

/// Every source a channel can be, in the order filters list them.
const chatSources = [
  'messenger',
  'instagram',
  'whatsapp_cloud',
  'whatsapp_web',
  'line',
  'masterbox',
];

/// The sources the conversation filter offers: the ones that can be connected
/// as channels today.
const filterableSources = [
  'messenger',
  'instagram',
  'whatsapp_cloud',
  'whatsapp_web',
];

/// What people see for each source (backend SOURCE_LABELS).
const sourceLabels = {
  'messenger': 'Facebook',
  'instagram': 'Instagram',
  'whatsapp_cloud': 'WhatsApp 官方',
  'whatsapp_web': 'WhatsApp 掃碼',
  'line': 'LINE',
  'masterbox': 'MasterBox',
};

String sourceLabel(String? source) => sourceLabels[source] ?? '其他';

/// The optional features a source can declare.
abstract final class Capability {
  static const sendImage = 'send_image';
  static const sendVideo = 'send_video';
  static const sendAudio = 'send_audio';
  static const sendDocument = 'send_document';
  static const caption = 'caption';
  static const replyWindow = 'reply_window';
  static const templates = 'templates';
  static const calls = 'calls';
  static const disappearing = 'disappearing';
  static const e2ee = 'e2ee';
  static const groups = 'groups';
  static const reactions = 'reactions';
  static const quoteReply = 'quote_reply';
  static const readReceipts = 'read_receipts';
  static const recall = 'recall';

  static const sendFiles = [sendImage, sendVideo, sendAudio, sendDocument];
}

/// A source's declared features, with questions the chat room asks.
class Capabilities {
  const Capabilities(this.values);
  final List<String> values;

  bool has(String capability) => values.contains(capability);

  /// Any kind of file can be sent.
  bool get canAttach => Capability.sendFiles.any(has);
  bool get canSendImage => has(Capability.sendImage);
  bool get canSendVideo => has(Capability.sendVideo);
  bool get canSendAudio => has(Capability.sendAudio);
  bool get canSendDocument => has(Capability.sendDocument);
  bool get hasReplyWindow => has(Capability.replyWindow);
  bool get hasTemplates => has(Capability.templates);
  bool get hasCalls => has(Capability.calls);
  bool get hasDisappearing => has(Capability.disappearing);
  bool get hasE2ee => has(Capability.e2ee);

  /// Which file kind (image, video, audio, file) needs which capability.
  bool canSendKind(String kind) => switch (kind) {
    'image' => canSendImage,
    'video' => canSendVideo,
    'audio' => canSendAudio,
    _ => canSendDocument,
  };

  static Capabilities fromJson(Object? json) =>
      Capabilities(json is List ? json.whereType<String>().toList() : const []);
}
