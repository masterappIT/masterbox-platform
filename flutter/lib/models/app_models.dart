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
    this.customer,
    this.updatedAt,
  });
  final String id;
  final String title;
  final String lastMessage;
  final EncryptionMode encryptionMode;
  final int disappearingMessageSeconds;
  final String? chatRoomId;
  final String? platform;
  final String? channelId;
  final RoomCustomer? customer;
  final DateTime? updatedAt;

  /// Messages are stored against the platform's room id, not the row id.
  String get messageRoomId => chatRoomId?.isNotEmpty == true ? chatRoomId! : id;

  factory ChatConversation.fromJson(Map<String, dynamic> json) {
    final channelId = json['channel_id'] as String?;
    final customer = _customerFrom(json['users'], channelId);
    final platform = json['platform'] as String?;
    final fallbackTitle =
        '${json['title'] ?? json['name'] ?? json['chat_room_name'] ?? '聊天室'}';
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
      customer: customer,
      updatedAt: parseServerDate(json['updatedAt']),
    );
  }
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
  });
  final String type;
  final String? url;
  final String? caption;
  final String? filename;

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
    );
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
    this.disappearingSeconds,
    this.readAt,
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
  final int? disappearingSeconds;
  final DateTime? readAt;

  /// The countdown starts once someone has been shown the message.
  bool get needsViewedMark => disappearingSeconds != null && readAt == null;

  ChatMessage copyWith({
    bool? failed,
    bool? sending,
    String? id,
    String? sendError,
  }) => ChatMessage(
    id: id ?? this.id,
    text: text,
    sentAt: sentAt,
    isMine: isMine,
    failed: failed ?? this.failed,
    sending: sending ?? this.sending,
    attachment: attachment,
    attachments: attachments,
    deliveryError: deliveryError,
    sendError: sendError,
    roomId: roomId,
    disappearingSeconds: disappearingSeconds,
    readAt: readAt,
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
        ? attachmentList
              .whereType<Map<String, dynamic>>()
              .map(MessageAttachment.fromJson)
              .toList()
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
      id: '${json['id'] ?? json['_id'] ?? ''}',
      text: text,
      sentAt: parseServerDate(json['sentAt']) ?? DateTime.now(),
      isMine: inbound is bool ? !inbound : json['isMine'] == true,
      attachments: attachments,
      deliveryError: json['delivery_error'] as String?,
      roomId: json['to_chat_room_id'] as String?,
      disappearingSeconds: json['disappearing_after_seconds'] as int?,
      readAt: parseServerDate(json['readAt']),
    );
  }
}

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
