import 'dart:convert';

class ClientUser {
  const ClientUser({
    required this.id,
    required this.name,
    this.avatarUrl,
    this.email,
  });
  final String id;
  final String name;
  final String? avatarUrl;
  final String? email;

  factory ClientUser.fromJson(Map<String, dynamic> json) => ClientUser(
    id: '${json['id'] ?? json['_id'] ?? ''}',
    name: '${json['name'] ?? json['displayName'] ?? ''}',
    avatarUrl: json['avatarUrl'] as String?,
    email: json['email'] as String?,
  );
}

class RoomCustomer {
  const RoomCustomer({required this.id, required this.name, this.avatarUrl});
  final String id;
  final String name;
  final String? avatarUrl;
}

const unnamedCustomer = '未命名客戶';

class ChatConversation {
  const ChatConversation({
    required this.id,
    required this.title,
    required this.lastMessage,
    this.encryptionMode = EncryptionMode.standard,
    this.disappearingMessageSeconds = 0,
    this.chatRoomId,
    this.platform,
    this.channelId,
    this.channelName,
    this.customer,
    this.updatedAt,
    this.lastMessageAt,
    this.lastMessageInbound,
    this.unreadCount = 0,
    this.lastCustomerMessageAt,
    this.humanAgentAvailable = false,
    this.assignee,
    this.tags = const [],
  });
  final String id;
  final String title;
  final String lastMessage;
  final EncryptionMode encryptionMode;
  final int disappearingMessageSeconds;
  final String? chatRoomId;
  final String? platform;
  final String? channelId;
  final String? channelName;
  final RoomCustomer? customer;
  final DateTime? updatedAt;
  final DateTime? lastMessageAt;
  final bool? lastMessageInbound;

  /// Customer messages the signed-in account hasn't read.
  final int unreadCount;

  /// What Meta's reply windows count from.
  final DateTime? lastCustomerMessageAt;

  /// Meta approved the 7-day human agent window, as the server says.
  final bool humanAgentAvailable;

  /// The agent handling the conversation; null while it is unassigned.
  final RoomAgent? assignee;
  final List<String> tags;

  /// Messages are stored against the platform's room id, not the row id.
  String get messageRoomId => chatRoomId?.isNotEmpty == true ? chatRoomId! : id;

  /// Whether a live message belongs here: messages carry the platform's room id
  /// and the channel, and the same id can exist in two channels.
  bool holds(ChatMessage message) =>
      message.roomId == messageRoomId &&
      (message.channelId == null ||
          channelId == null ||
          message.channelId == channelId);

  ChatConversation copyWith({
    String? lastMessage,
    DateTime? updatedAt,
    DateTime? lastMessageAt,
    bool? lastMessageInbound,
    int? unreadCount,
    DateTime? lastCustomerMessageAt,
  }) => ChatConversation(
    id: id,
    title: title,
    lastMessage: lastMessage ?? this.lastMessage,
    encryptionMode: encryptionMode,
    disappearingMessageSeconds: disappearingMessageSeconds,
    chatRoomId: chatRoomId,
    platform: platform,
    channelId: channelId,
    channelName: channelName,
    customer: customer,
    updatedAt: updatedAt ?? this.updatedAt,
    lastMessageAt: lastMessageAt ?? this.lastMessageAt,
    lastMessageInbound: lastMessageInbound ?? this.lastMessageInbound,
    unreadCount: unreadCount ?? this.unreadCount,
    lastCustomerMessageAt: lastCustomerMessageAt ?? this.lastCustomerMessageAt,
    humanAgentAvailable: humanAgentAvailable,
    assignee: assignee,
    tags: tags,
  );

  factory ChatConversation.fromJson(Map<String, dynamic> json) {
    final channelId = json['channel_id'] as String?;
    final customer =
        _customerFromField(json['customer']) ??
        _customerFrom(json['users'], channelId);
    final platform = json['platform'] as String?;
    final fallbackTitle =
        '${json['title'] ?? json['name'] ?? json['chat_room_name'] ?? '聊天室'}';
    final window = json['replyWindow'];
    final assignee = json['assignee'];
    final tags = json['tags'];
    return ChatConversation(
      id: '${json['id'] ?? json['_id'] ?? json['chat_room_id'] ?? ''}',
      title: customer?.name.isNotEmpty == true
          ? customer!.name
          : (platform == null ? fallbackTitle : unnamedCustomer),
      lastMessage: '${json['lastMessage'] ?? json['last_message'] ?? ''}',
      encryptionMode: EncryptionModeX.fromValue(
        json['encryptionMode'] ?? json['encryption_mode'],
      ),
      disappearingMessageSeconds:
          int.tryParse(
            '${json['disappearingMessageSeconds'] ?? json['disappearing_message_seconds'] ?? 0}',
          ) ??
          0,
      chatRoomId: json['chat_room_id'] as String?,
      platform: platform,
      channelId: channelId,
      channelName: json['channel_name'] as String?,
      customer: customer,
      updatedAt: parseServerDate(json['updatedAt']),
      lastMessageAt: parseServerDate(json['lastMessageAt']),
      lastMessageInbound: json['lastMessageInbound'] as bool?,
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      lastCustomerMessageAt: parseServerDate(json['lastCustomerMessageAt']),
      humanAgentAvailable:
          window is Map && window['humanAgentAvailable'] == true,
      assignee: assignee is Map<String, dynamic>
          ? RoomAgent.fromJson(assignee)
          : null,
      tags: tags is List
          ? tags
                .whereType<Map>()
                .map((tag) => '${tag['name'] ?? ''}')
                .where((name) => name.isNotEmpty)
                .toList()
          : const [],
    );
  }
}

/// An agent of the company, as colleagues see them.
class RoomAgent {
  const RoomAgent({required this.id, required this.name});
  final String id;
  final String name;

  factory RoomAgent.fromJson(Map<String, dynamic> json) => RoomAgent(
    id: '${json['id'] ?? ''}',
    name: '${json['name'] ?? json['email'] ?? ''}',
  );
}

/// The server's own reading of the customer, when it sends one.
RoomCustomer? _customerFromField(Object? value) {
  if (value is! Map) return null;
  final id = value['id'];
  if (id is! String || id.isEmpty) return null;
  return RoomCustomer(
    id: id,
    name: '${value['name'] ?? ''}'.trim(),
    avatarUrl: value['avatar'] as String?,
  );
}

/// The room's users include the channel itself; the customer is the other one.
RoomCustomer? _customerFrom(Object? users, String? channelId) {
  if (users is! List) return null;
  for (final user in users.whereType<Map<String, dynamic>>()) {
    final id = user['id'];
    if (id is! String || id.isEmpty || id == channelId) continue;
    final first = user['first_name'] ?? user['name'] ?? '';
    final last = user['last_name'] ?? '';
    return RoomCustomer(
      id: id,
      name: '$first$last'.trim(),
      avatarUrl: user['avatar'] as String?,
    );
  }
  return null;
}

DateTime? parseServerDate(Object? value) {
  if (value == null) return null;
  final millis = value is num ? value.toInt() : int.tryParse('$value');
  if (millis != null) {
    return DateTime.fromMillisecondsSinceEpoch(millis, isUtc: true).toLocal();
  }
  return DateTime.tryParse('$value')?.toLocal();
}

/// How long messages kept inside MasterBox stay visible once shown.
const disappearingOptions = [0, 30, 300, 3600, 86400];

String disappearingLabel(int seconds) => switch (seconds) {
  0 => '關閉',
  < 60 => '$seconds 秒',
  < 3600 => '${seconds ~/ 60} 分鐘',
  < 86400 => '${seconds ~/ 3600} 小時',
  _ => '${seconds ~/ 86400} 天',
};

enum EncryptionMode { standard, endToEnd }

extension EncryptionModeX on EncryptionMode {
  String get apiValue =>
      this == EncryptionMode.endToEnd ? 'END_TO_END' : 'STANDARD';
  String get label => this == EncryptionMode.endToEnd ? '端對端加密' : '傳輸加密';

  static EncryptionMode fromValue(Object? value) =>
      '$value'.toUpperCase().contains('END')
      ? EncryptionMode.endToEnd
      : EncryptionMode.standard;
}

class CallSession {
  const CallSession({
    required this.id,
    required this.kind,
    this.status = 'requested',
  });
  final String id;
  final String kind;
  final String status;

  factory CallSession.fromJson(Map<String, dynamic> json) => CallSession(
    id: '${json['id'] ?? json['_id'] ?? json['callId'] ?? ''}',
    kind: '${json['kind'] ?? json['type'] ?? 'voice'}',
    status: '${json['status'] ?? 'requested'}',
  );
}

class LiveKitToken {
  const LiveKitToken({
    required this.token,
    required this.roomName,
    required this.serverUrl,
    required this.expiresIn,
  });
  final String token;
  final String roomName;
  final String serverUrl;
  final int expiresIn;

  factory LiveKitToken.fromJson(Map<String, dynamic> json) => LiveKitToken(
    token: '${json['token'] ?? ''}',
    roomName: '${json['roomName'] ?? ''}',
    serverUrl: '${json['serverUrl'] ?? ''}',
    expiresIn: int.tryParse('${json['expiresIn'] ?? 0}') ?? 0,
  );
}

class MessageAttachment {
  const MessageAttachment({
    required this.type,
    this.url,
    this.caption,
    this.filename,
    this.stickerId,
  });
  final String type;
  final String? url;
  final String? caption;
  final String? filename;
  final String? stickerId;

  static const _labels = {
    'image': '圖片',
    'video': '影片',
    'audio': '語音訊息',
    'file': '檔案',
    'document': '文件',
    'sticker': '貼圖',
    'location': '位置',
    'contacts': '聯絡人',
    'order': '訂單',
    'reaction': '表情回應',
    'unknown': '不支援的訊息類型',
    'unsupported': '不支援的訊息類型',
  };

  String get label => _labels[type] ?? '附件';
  bool get isImage => type == 'image' || type == 'sticker';
  bool get isSticker => type == 'sticker' || stickerId != null;

  /// Only https links are opened or shown; anything else falls back to text.
  String? get safeUrl =>
      url != null && url!.startsWith('https://') ? url : null;

  factory MessageAttachment.fromJson(Map<String, dynamic> json) {
    final payload = json['payload'];
    return MessageAttachment(
      type: '${json['type'] ?? 'file'}',
      url: payload is Map ? payload['url'] as String? : null,
      caption: json['caption'] as String?,
      filename: (json['filename'] ?? json['name']) as String?,
      stickerId: payload is Map && payload['sticker_id'] != null
          ? '${payload['sticker_id']}'
          : null,
    );
  }

  /// Meta sends a Messenger sticker, such as the Like button, as an image and a
  /// sticker with the same sticker_id.
  static List<MessageAttachment> withoutRepeatedStickers(
    Iterable<MessageAttachment> attachments,
  ) {
    final seen = <String>{};
    return attachments
        .where((a) => a.stickerId == null || seen.add(a.stickerId!))
        .toList();
  }
}

const unsupportedMessageText = '[此訊息類型暫不支援顯示]';

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.text,
    required this.sentAt,
    this.isMine = false,
    this.failed = false,
    this.sending = false,
    this.attachment,
    this.attachments = const [],
    this.deliveryError,
    this.sendError,
    this.roomId,
    this.channelId,
    this.platform,
    this.disappearingSeconds,
    this.readAt,
    this.cursor,
    this.preview,
    this.inbound = false,
    this.pending,
    this.templateRequired = false,
  });
  final String id;
  final String text;
  final DateTime sentAt;
  final bool isMine;
  final bool failed;
  final bool sending;
  final Map<String, dynamic>? attachment;
  final List<MessageAttachment> attachments;

  /// Why the platform could not deliver a reply it had accepted.
  final String? deliveryError;

  /// Why this device could not send the message.
  final String? sendError;
  final String? roomId;
  final String? channelId;
  final String? platform;
  final int? disappearingSeconds;
  final DateTime? readAt;

  /// Where this message is in its conversation, for paging and catching up.
  final String? cursor;

  /// One line for the conversation list, such as the text or [圖片].
  final String? preview;

  /// From the customer, rather than from the team.
  final bool inbound;

  /// The file this device is sending with the message, until the server has it.
  final PendingAttachment? pending;

  /// The send failed because WhatsApp now only takes an approved template.
  final bool templateRequired;

  bool get isLocal => id.startsWith('local-');

  /// The countdown starts once someone has been shown the message.
  bool get needsViewedMark => disappearingSeconds != null && readAt == null;

  ChatMessage copyWith({
    bool? failed,
    bool? sending,
    String? id,
    String? sendError,
    String? text,
    PendingAttachment? pending,
    bool clearPending = false,
    bool? templateRequired,
  }) => ChatMessage(
    id: id ?? this.id,
    text: text ?? this.text,
    sentAt: sentAt,
    isMine: isMine,
    failed: failed ?? this.failed,
    sending: sending ?? this.sending,
    attachment: attachment,
    attachments: attachments,
    deliveryError: deliveryError,
    sendError: sendError,
    roomId: roomId,
    channelId: channelId,
    platform: platform,
    disappearingSeconds: disappearingSeconds,
    readAt: readAt,
    cursor: cursor,
    preview: preview,
    inbound: inbound,
    pending: clearPending ? null : (pending ?? this.pending),
    templateRequired: templateRequired ?? this.templateRequired,
  );

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final raw = json['text'] ?? json['message'] ?? json['contents'] ?? '';
    Map<String, dynamic>? parsed = raw is Map<String, dynamic> ? raw : null;
    if (raw is String) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) parsed = decoded;
      } catch (_) {
        // Contents can be plain text as well as serialized JSON.
      }
    }
    final nested = parsed?['message'];
    final nestedMap = nested is Map<String, dynamic> ? nested : null;
    final attachmentList = parsed?['attachments'] ?? nestedMap?['attachments'];
    final attachments = attachmentList is List
        ? MessageAttachment.withoutRepeatedStickers(
            attachmentList.whereType<Map<String, dynamic>>().map(
              MessageAttachment.fromJson,
            ),
          )
        : const <MessageAttachment>[];
    Object? value = parsed == null
        ? raw
        : parsed['text'] ??
              nestedMap?['text'] ??
              nestedMap?['body'] ??
              parsed['body'] ??
              parsed['content'];
    // WhatsApp keeps its text one level down.
    if (value is Map) value = value['body'];
    var text = value == null ? '' : '$value';
    if (text.isEmpty && attachments.isEmpty && parsed != null) {
      text = unsupportedMessageText;
    }
    final inbound = json['inbound'];
    return ChatMessage(
      id: '${json['_id'] ?? json['id'] ?? ''}',
      text: text,
      sentAt: parseServerDate(json['sentAt']) ?? DateTime.now(),
      // The team's replies, whoever sent them, sit on the right as on the admin site.
      isMine: inbound is bool ? !inbound : json['isMine'] == true,
      attachments: attachments,
      deliveryError: json['delivery_error'] as String?,
      roomId: json['to_chat_room_id'] as String?,
      channelId: json['channel_id'] as String?,
      platform: json['platform'] as String?,
      disappearingSeconds: json['disappearing_after_seconds'] as int?,
      readAt: parseServerDate(json['readAt']),
      cursor: json['cursor'] as String?,
      preview: json['preview'] as String?,
      inbound: inbound == true,
    );
  }
}

/// A file picked for a reply: read into memory so it can be uploaded again if
/// the send fails, and checked against the platform before anything is sent.
class PendingAttachment {
  const PendingAttachment({
    required this.name,
    required this.bytes,
    required this.mime,
    required this.kind,
    this.uploaded,
  });
  final String name;
  final List<int> bytes;
  final String mime;

  /// image, video, audio or file
  final String kind;

  /// Set once it is on the server, so a retry doesn't upload it twice.
  final UploadedFile? uploaded;

  int get size => bytes.length;

  PendingAttachment withUpload(UploadedFile file) => PendingAttachment(
    name: name,
    bytes: bytes,
    mime: mime,
    kind: kind,
    uploaded: file,
  );
}

/// A file the server stored, as POST /api/uploads answers.
class UploadedFile {
  const UploadedFile({
    required this.url,
    required this.filename,
    required this.mimeType,
    required this.size,
    required this.kind,
  });
  final String url;
  final String filename;
  final String mimeType;
  final int size;
  final String kind;

  factory UploadedFile.fromJson(Map<String, dynamic> json) => UploadedFile(
    url: '${json['url'] ?? ''}',
    filename: '${json['filename'] ?? ''}',
    mimeType: '${json['mime_type'] ?? ''}',
    size: (json['size'] as num?)?.toInt() ?? 0,
    kind: '${json['kind'] ?? 'file'}',
  );

  /// How it appears in a message's contents, as the admin site sends it.
  Map<String, dynamic> toMessageAttachment() => {
    'type': kind,
    'payload': {'url': url},
    'filename': filename,
    'mime_type': mimeType,
    'size': size,
  };
}

class WhatsappTemplateVariable {
  const WhatsappTemplateVariable({
    required this.key,
    required this.component,
    required this.name,
    required this.label,
    this.example,
  });

  /// Sent back as the key of a value, such as body:1 or header:media.
  final String key;

  /// header, header_media, body, button or coupon.
  final String component;
  final String name;
  final String label;
  final String? example;

  factory WhatsappTemplateVariable.fromJson(Map<String, dynamic> json) =>
      WhatsappTemplateVariable(
        key: '${json['key'] ?? ''}',
        component: '${json['component'] ?? ''}',
        name: '${json['name'] ?? ''}',
        label: '${json['label'] ?? ''}',
        example: json['example'] as String?,
      );
}

/// An approved WhatsApp template of the conversation's number.
class WhatsappTemplate {
  const WhatsappTemplate({
    required this.id,
    required this.name,
    required this.language,
    required this.bodyText,
    required this.supported,
    this.category,
    this.headerFormat,
    this.headerText,
    this.footerText,
    this.buttons = const [],
    this.variables = const [],
    this.unsupportedReason,
  });
  final String id;
  final String name;
  final String language;
  final String? category;

  /// TEXT, IMAGE, VIDEO, DOCUMENT or LOCATION; null without a header.
  final String? headerFormat;
  final String? headerText;
  final String bodyText;
  final String? footerText;
  final List<String> buttons;
  final List<WhatsappTemplateVariable> variables;
  final bool supported;
  final String? unsupportedReason;

  WhatsappTemplateVariable? get mediaVariable =>
      variables.where((v) => v.component == 'header_media').firstOrNull;
  List<WhatsappTemplateVariable> get textVariables =>
      variables.where((v) => v.component != 'header_media').toList();

  factory WhatsappTemplate.fromJson(Map<String, dynamic> json) {
    final buttons = json['buttons'];
    final variables = json['variables'];
    return WhatsappTemplate(
      id: '${json['id'] ?? ''}',
      name: '${json['name'] ?? ''}',
      language: '${json['language'] ?? ''}',
      category: json['category'] as String?,
      headerFormat: json['header_format'] as String?,
      headerText: json['header_text'] as String?,
      bodyText: '${json['body_text'] ?? ''}',
      footerText: json['footer_text'] as String?,
      buttons: buttons is List
          ? buttons
                .whereType<Map>()
                .map(
                  (b) =>
                      '${b['text'] ?? (b['type'] == 'COPY_CODE' ? '複製優惠碼' : b['type'] ?? '')}',
                )
                .toList()
          : const [],
      variables: variables is List
          ? variables
                .whereType<Map<String, dynamic>>()
                .map(WhatsappTemplateVariable.fromJson)
                .toList()
          : const [],
      supported: json['supported'] != false,
      unsupportedReason: json['unsupported_reason'] as String?,
    );
  }
}

const whatsappTemplateCategories = {
  'MARKETING': '行銷',
  'UTILITY': '交易通知',
  'AUTHENTICATION': '驗證碼',
};

final _placeholder = RegExp(r'\{\{\s*([A-Za-z0-9_]+)\s*\}\}');

/// The template text with what has been filled in; blanks stay as {{1}}.
String fillTemplateText(
  String text,
  String component,
  Map<String, String> values,
) => text.replaceAllMapped(_placeholder, (match) {
  final value = values['$component:${match.group(1)}']?.trim();
  return value?.isNotEmpty == true ? value! : match.group(0)!;
});

/// A template's messages, inserted into a reply as one quick reply.
String quickReplyText(MessageTemplate template) =>
    template.messages.join('\n\n');

// ---- Admin features ----

const messagePlatforms = <String, String>{
  'fb': 'Facebook',
  'ig': 'Instagram',
  'whatsapp': 'WhatsApp',
  'line': 'LINE',
  'wechat': 'WeChat',
};

String platformLabel(String? value) => messagePlatforms[value] ?? value ?? '';

class CurrentAccount {
  const CurrentAccount({
    required this.id,
    required this.email,
    required this.role,
    this.name,
    this.companyId,
  });
  final String? id;
  final String? email;
  final String? role;
  final String? name;
  final String? companyId;

  bool get isAdmin => role?.toLowerCase() == 'admin';
  String get displayName => name?.isNotEmpty == true ? name! : (email ?? '');

  factory CurrentAccount.fromJson(Map<String, dynamic> json) {
    final info = json['info'];
    return CurrentAccount(
      id: json['_id'] as String?,
      email: json['email'] as String?,
      role: json['role'] as String?,
      companyId: json['company_id'] as String?,
      name: info is Map ? info['name'] as String? : null,
    );
  }
}

class SocialChannel {
  const SocialChannel({
    required this.id,
    required this.platform,
    required this.name,
    required this.enabled,
  });
  final String id;
  final String platform;
  final String name;
  final bool enabled;

  SocialChannel copyWith({bool? enabled}) => SocialChannel(
    id: id,
    platform: platform,
    name: name,
    enabled: enabled ?? this.enabled,
  );

  factory SocialChannel.fromJson(Map<String, dynamic> json) => SocialChannel(
    id: '${json['channel_id'] ?? ''}',
    platform: '${json['platform'] ?? ''}',
    name: '${json['name'] ?? ''}',
    enabled: json['enabled'] != false,
  );
}

class Customer {
  const Customer({
    required this.key,
    required this.id,
    required this.name,
    required this.platform,
    required this.channelId,
    required this.channelName,
    required this.conversation,
    this.avatarUrl,
    this.lastInteraction,
  });
  final String key;
  final String id;
  final String name;
  final String? avatarUrl;
  final String platform;
  final String channelId;
  final String channelName;
  final ChatConversation conversation;
  final DateTime? lastInteraction;

  String get displayName => name.isEmpty ? unnamedCustomer : name;
}

/// Customers aren't stored on their own yet, so the list is worked out from the
/// chat rooms, keeping each customer's latest room.
List<Customer> customersFromRooms(
  List<ChatConversation> rooms,
  List<SocialChannel> channels,
) {
  final byCustomer = <String, Customer>{};
  for (final room in rooms) {
    final customer = room.customer;
    if (customer == null) continue;
    final channel = channels.where((item) => item.id == room.channelId);
    if (channel.isEmpty) continue;
    final key = '${room.channelId}:${customer.id}';
    final known = byCustomer[key]?.lastInteraction;
    if (known != null &&
        (room.updatedAt == null || !room.updatedAt!.isAfter(known))) {
      continue;
    }
    byCustomer[key] = Customer(
      key: key,
      id: customer.id,
      name: customer.name,
      avatarUrl: customer.avatarUrl,
      platform: room.platform ?? channel.first.platform,
      channelId: channel.first.id,
      channelName: channel.first.name,
      conversation: room,
      lastInteraction: room.updatedAt,
    );
  }
  final customers = byCustomer.values.toList();
  customers.sort(
    (a, b) => (b.lastInteraction ?? DateTime(0)).compareTo(
      a.lastInteraction ?? DateTime(0),
    ),
  );
  return customers;
}

const templateTextLimit = 160;

/// Reads the stored JSON: `{messages: [{type: 'text', text}]}`, or the older `{text}`.
List<String> parseTemplateMessages(String contents) {
  Object? data;
  try {
    data = jsonDecode(contents);
  } catch (_) {
    return const [];
  }
  if (data is! Map) return const [];
  final messages = data['messages'];
  if (messages is List) {
    return messages
        .whereType<Map>()
        .where((message) => message['type'] == 'text')
        .map((message) => '${message['text'] ?? ''}')
        .toList();
  }
  final text = data['text'];
  return text is String ? [text] : const [];
}

String serializeTemplateMessages(List<String> messages) => jsonEncode({
  'messages': [
    for (final text in messages) {'type': 'text', 'text': text.trim()},
  ],
});

class MessageTemplate {
  const MessageTemplate({
    required this.id,
    required this.name,
    required this.category,
    required this.platform,
    required this.contents,
    this.updatedAt,
  });
  final String id;
  final String name;
  final String category;
  final String platform;
  final String contents;
  final DateTime? updatedAt;

  List<String> get messages => parseTemplateMessages(contents);

  factory MessageTemplate.fromJson(Map<String, dynamic> json) =>
      MessageTemplate(
        id: '${json['id'] ?? ''}',
        name: '${json['name'] ?? ''}',
        category: '${json['category'] ?? 'general'}',
        platform: '${json['platform'] ?? ''}',
        contents: '${json['contents'] ?? ''}',
        updatedAt: parseServerDate(json['updatedAt']),
      );
}

const accountRoleNames = {'admin': '管理者', 'user': '使用者'};

class TeamAccount {
  const TeamAccount({
    required this.id,
    required this.email,
    required this.role,
    required this.enabled,
    this.info = const {},
  });
  final String id;
  final String email;
  final String role;
  final bool enabled;

  /// Kept whole so saving a form doesn't wipe fields it doesn't show, like the avatar.
  final Map<String, dynamic> info;

  String get name => '${info['name'] ?? ''}';
  String get displayName => name.isEmpty ? email : name;
  String get roleName => accountRoleNames[role] ?? role;
  String? get avatarUrl => info['avatar'] as String?;

  TeamAccount copyWith({bool? enabled}) => TeamAccount(
    id: id,
    email: email,
    role: role,
    enabled: enabled ?? this.enabled,
    info: info,
  );

  factory TeamAccount.fromJson(Map<String, dynamic> json) {
    final info = json['info'];
    return TeamAccount(
      id: '${json['_id'] ?? ''}',
      email: '${json['email'] ?? ''}',
      role: '${json['role'] ?? ''}',
      enabled: json['enabled'] != false,
      info: info is Map<String, dynamic>
          ? (Map.of(info)..remove('__typename'))
          : const {},
    );
  }
}

class CompanyInfo {
  const CompanyInfo({
    required this.id,
    this.email = '',
    this.chineseName = '',
    this.englishName = '',
    this.mobile = '',
    this.pinNumber = '',
    this.address = '',
    this.country = '',
    this.principalFirstName = '',
    this.principalLastName = '',
    this.principalCnName = '',
    this.principalMobile = '',
    this.subscriptionName,
    this.subscriptionEnd,
  });
  final String id;
  final String email;
  final String chineseName;
  final String englishName;
  final String mobile;
  final String pinNumber;
  final String address;
  final String country;
  final String principalFirstName;
  final String principalLastName;
  final String principalCnName;
  final String principalMobile;
  final String? subscriptionName;
  final DateTime? subscriptionEnd;

  factory CompanyInfo.fromJson(Map<String, dynamic> json) {
    final principal = json['principal_info'];
    final subscription = json['subscription'];
    final period = subscription is Map ? subscription['period'] : null;
    String text(Object? value) => value == null ? '' : '$value';
    String principalText(String key) =>
        principal is Map ? text(principal[key]) : '';
    return CompanyInfo(
      id: text(json['_id']),
      email: text(json['email']),
      chineseName: text(json['chinese_name']),
      englishName: text(json['english_name']),
      mobile: text(json['mobile']),
      pinNumber: text(json['pin_number']),
      address: text(json['address']),
      country: text(json['country']),
      principalFirstName: principalText('first_name'),
      principalLastName: principalText('last_name'),
      principalCnName: principalText('cn_name'),
      principalMobile: principalText('mobile'),
      subscriptionName: subscription is Map
          ? subscription['name'] as String?
          : null,
      subscriptionEnd: period is Map ? parseServerDate(period['end']) : null,
    );
  }
}

class CompanyRegistration {
  const CompanyRegistration({
    required this.chineseName,
    required this.englishName,
    required this.email,
    required this.password,
    required this.country,
    required this.mobile,
  });
  final String chineseName;
  final String englishName;
  final String email;
  final String password;
  final String country;
  final String mobile;
}
