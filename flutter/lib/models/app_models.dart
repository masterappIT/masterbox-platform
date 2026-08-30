import 'dart:convert';

class ClientUser {
  const ClientUser({required this.id, required this.name, this.avatarUrl});
  final String id;
  final String name;
  final String? avatarUrl;

  factory ClientUser.fromJson(Map<String, dynamic> json) => ClientUser(
    id: '${json['id'] ?? json['_id'] ?? ''}',
    name: '${json['name'] ?? json['displayName'] ?? ''}',
    avatarUrl: json['avatarUrl'] as String?,
  );
}

class ChatConversation {
  const ChatConversation({
    required this.id,
    required this.title,
    required this.lastMessage,
    this.encryptionMode = EncryptionMode.standard,
    this.disappearingMessageSeconds = 0,
  });
  final String id;
  final String title;
  final String lastMessage;
  final EncryptionMode encryptionMode;
  final int disappearingMessageSeconds;

  factory ChatConversation.fromJson(
    Map<String, dynamic> json,
  ) => ChatConversation(
    id: '${json['id'] ?? json['_id'] ?? json['chat_room_id'] ?? ''}',
    title:
        '${json['title'] ?? json['name'] ?? json['chat_room_name'] ?? '聊天室'}',
    lastMessage: '${json['lastMessage'] ?? json['last_message'] ?? ''}',
    encryptionMode: EncryptionModeX.fromValue(
      json['encryptionMode'] ?? json['encryption_mode'],
    ),
    disappearingMessageSeconds:
        int.tryParse(
          '${json['disappearingMessageSeconds'] ?? json['disappearing_message_seconds'] ?? 0}',
        ) ??
        0,
  );
}

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

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.text,
    required this.sentAt,
    this.isMine = false,
    this.failed = false,
    this.sending = false,
    this.attachment,
  });
  final String id;
  final String text;
  final DateTime sentAt;
  final bool isMine;
  final bool failed;
  final bool sending;
  final Map<String, dynamic>? attachment;

  ChatMessage copyWith({bool? failed, bool? sending, String? id}) =>
      ChatMessage(
        id: id ?? this.id,
        text: text,
        sentAt: sentAt,
        isMine: isMine,
        failed: failed ?? this.failed,
        sending: sending ?? this.sending,
        attachment: attachment,
      );

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final raw = json['text'] ?? json['message'] ?? json['contents'] ?? '';
    var text = '$raw';
    if (raw is String) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) {
          text =
              '${decoded['text'] ?? decoded['body'] ?? decoded['content'] ?? raw}';
        }
      } catch (_) {
        // Contents can be plain text as well as serialized JSON.
      }
    }
    return ChatMessage(
      id: '${json['id'] ?? json['_id'] ?? ''}',
      text: text,
      sentAt: DateTime.tryParse('${json['sentAt'] ?? ''}') ?? DateTime.now(),
      isMine: json['isMine'] == true,
    );
  }
}
