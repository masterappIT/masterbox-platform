import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/app_models.dart';
import 'realtime_service.dart';

class GraphQLException implements Exception {
  const GraphQLException(
    this.message, {
    this.statusCode,
    this.code,
    this.extensions = const {},
  });
  final String message;
  final int? statusCode;
  final String? code;

  /// What the server added to the error, such as templateRequired when
  /// WhatsApp's 24 hours ran out, or sentAttachment when only the file went out.
  final Map<String, dynamic> extensions;
  bool get templateRequired => extensions['templateRequired'] == true;
  bool get sentAttachment => extensions['sentAttachment'] == true;
  @override
  String toString() => message;
}

class AuthTokens {
  const AuthTokens({
    required this.token,
    this.refreshToken,
    this.accountId,
    this.companyId,
    this.account,
  });

  final String token;
  final String? refreshToken;
  final String? accountId;
  final String? companyId;
  final CurrentAccount? account;
}

const _accountFields =
    'token refreshToken _id email company_id role info { name avatar }';
const _teamAccountFields =
    '_id email role company_id enabled info { name avatar mobile }';
const _templateFields =
    'id name category platform contents createdAt updatedAt';
const _messageFields =
    '_id contents platform channel_id to_chat_room_id sentAt inbound isMine delivery_error preview cursor disappearing_after_seconds readAt';
const _roomFields =
    'id title platform channel_id channel_name chat_room_id users { id name first_name last_name avatar } customer { id name avatar username phone } tags { id name } lastMessage lastMessageAt lastMessageInbound unreadCount lastCustomerMessageAt replyWindow { state closesAt templateRequired humanAgentAvailable } assignee { id name email role } assignedAt createdAt updatedAt';
const _whatsappWebFields =
    'channel_id state qr phone name error updated_at progress { chats_total chats_done messages }';
const _channelConnectionFields = 'state message checked_at';
const _whatsappTemplateFields =
    'id name language category header_format header_text body_text footer_text buttons { type text url phone_number } variables { key component name label example } supported unsupported_reason';

/// A page of the conversation list.
class RoomListPage {
  const RoomListPage({
    required this.rooms,
    required this.nextCursor,
    required this.hasMore,
  });
  final List<ChatConversation> rooms;
  final String? nextCursor;
  final bool hasMore;
}

/// What the conversation list is narrowed to, as the server's ChatRoomFilter.
class ConversationFilter {
  const ConversationFilter({
    this.search = '',
    this.channelId,
    this.unreadOnly = false,
    this.assignment = 'all',
  });
  final String search;
  final String? channelId;
  final bool unreadOnly;

  /// all, mine or unassigned
  final String assignment;

  /// Whether a conversation the server just sent belongs in the list. Searches
  /// only match on the server, so new conversations wait for the next search.
  bool admits(ChatConversation room, {String? myId}) =>
      search.trim().isEmpty &&
      (channelId == null || room.channelId == channelId) &&
      (!unreadOnly || room.unreadCount > 0) &&
      switch (assignment) {
        'mine' => room.assignee?.id == myId,
        'unassigned' => room.assignee == null,
        _ => true,
      };

  Map<String, dynamic> toJson() => {
    if (search.trim().isNotEmpty) 'search': search.trim(),
    'channel_id': ?channelId,
    if (unreadOnly) 'unread_only': true,
    if (assignment != 'all') 'assignment': assignment,
  };

  @override
  bool operator ==(Object other) =>
      other is ConversationFilter &&
      other.search.trim() == search.trim() &&
      other.channelId == channelId &&
      other.unreadOnly == unreadOnly &&
      other.assignment == assignment;

  @override
  int get hashCode =>
      Object.hash(search.trim(), channelId, unreadOnly, assignment);
}

/// A page of a conversation's messages, oldest first.
class MessagePage {
  const MessagePage({
    required this.messages,
    required this.hasOlder,
    required this.hasNewer,
  });
  final List<ChatMessage> messages;
  final bool hasOlder;
  final bool hasNewer;
}

const _friendlyErrors = {
  'INVALID_CREDENTIALS': '電子信箱或密碼錯誤',
  'ACCOUNT_DISABLED': '此帳號已停用，請聯絡公司管理員',
  'EMAIL_ALREADY_REGISTERED': '此電子信箱已註冊，請直接登入',
  'MOBILE_ALREADY_REGISTERED': '此電話號碼已註冊',
  'USER_ALREADY_EXISTS': '這個電子信箱已經有帳號了',
};

class GraphQLService {
  GraphQLService({
    String? endpoint,
    String? realtimeEndpoint,
    String? adminUrl,
    this.token,
    this.refreshToken,
    this.accountId,
    this.companyId,
    this.account,
    this.onTokensChanged,
    this.onSessionExpired,
    http.Client? httpClient,
    this.socketConnector,
  }) : endpoint =
           endpoint ??
           const String.fromEnvironment(
             'GRAPHQL_ENDPOINT',
             defaultValue: 'http://localhost:4000/graphql',
           ),
       realtimeEndpoint =
           realtimeEndpoint ??
           const String.fromEnvironment(
             'REALTIME_ENDPOINT',
             defaultValue: 'http://localhost:4000',
           ),
       adminUrl =
           adminUrl ??
           const String.fromEnvironment(
             'ADMIN_URL',
             defaultValue: 'http://localhost:3000',
           ),
       _client = httpClient ?? http.Client();

  final String endpoint;
  final String realtimeEndpoint;

  /// Meta connections end on the admin site, the only place the backend will return to.
  final String adminUrl;
  final http.Client _client;
  final SocketConnector? socketConnector;
  String? token;
  String? refreshToken;
  String? accountId;
  String? companyId;
  CurrentAccount? account;
  void Function()? onTokensChanged;
  void Function()? onSessionExpired;

  /// The conversation on screen, which needs no new-message prompt.
  String? openRoomId;
  Future<bool>? _pendingRefresh;
  RealtimeService? _realtime;
  final _realtimeListeners = <StreamSubscription<Object?>>[];
  final _messageEvents = StreamController<ChatMessage>.broadcast();
  final _roomEvents = StreamController<ChatConversation>.broadcast();
  final _reconnects = StreamController<void>.broadcast();
  final _readChanges = StreamController<void>.broadcast();

  bool get isAuthenticated => token != null && token!.isNotEmpty;

  /// Messages as they arrive over the socket, for pages to refresh on.
  Stream<ChatMessage> get messageEvents => _messageEvents.stream;

  /// Conversations that changed for this account, such as their agent or tags.
  Stream<ChatConversation> get roomEvents => _roomEvents.stream;

  /// The live connection came back; anything sent meanwhile was missed and
  /// should be caught up on.
  Stream<void> get reconnects => _reconnects.stream;

  /// This device read a conversation, so its unread total went down.
  Stream<void> get readChanges => _readChanges.stream;

  /// Whether live updates are arriving right now.
  bool get isLive => _realtime?.isConnected ?? false;

  Uri get _socketUrl {
    final url = Uri.parse(endpoint);
    return url.replace(scheme: url.scheme == 'https' ? 'wss' : 'ws');
  }

  void startRealtime() {
    if (!isAuthenticated) return;
    final realtime = _realtime ??= RealtimeService(
      url: _socketUrl,
      token: () => token,
      onAuthRejected: () async {
        await refresh();
      },
      connector: socketConnector,
    );
    if (_realtimeListeners.isEmpty) {
      _realtimeListeners
        ..add(
          realtime.events.listen(
            (json) => _messageEvents.add(ChatMessage.fromJson(json)),
          ),
        )
        ..add(
          realtime.roomUpdates.listen(
            (json) => _roomEvents.add(ChatConversation.fromJson(json)),
          ),
        )
        ..add(realtime.reconnects.listen((_) => _reconnects.add(null)));
    }
    realtime.start();
  }

  /// A message this device just sent, shown to every page at once rather than
  /// when the socket echoes it.
  void announceSent(ChatMessage message) => _messageEvents.add(message);

  void stopRealtime() => _realtime?.stop();

  void clearSession() {
    stopRealtime();
    token = null;
    refreshToken = null;
    accountId = null;
    companyId = null;
    account = null;
  }

  Future<String?> login({
    required String email,
    required String password,
  }) async {
    final tokens = await authenticate(email: email, password: password);
    return tokens.token;
  }

  AuthTokens _tokensFrom(Map<String, dynamic>? value, String failure) {
    final access = value?['token'];
    if (access is! String || access.isEmpty) {
      throw GraphQLException(failure);
    }
    return AuthTokens(
      token: access,
      refreshToken: value?['refreshToken'] as String?,
      accountId: value?['_id'] as String?,
      companyId: value?['company_id'] as String?,
      account: CurrentAccount.fromJson(value!),
    );
  }

  Future<AuthTokens> authenticate({
    required String email,
    required String password,
  }) async {
    final result = await _request(
      '''mutation Login(\$email: String, \$password: String) {
      loginAccount(LoginInput: {email: \$email, password: \$password}) {
      $_accountFields
      }
    }''',
      {'email': email, 'password': password},
      public: true,
    );
    return _tokensFrom(
      _map(result, const ['data', 'loginAccount']),
      '登入失敗，伺服器未提供有效的驗證 Token',
    );
  }

  Future<AuthTokens> registerCompany(CompanyRegistration input) async {
    final result = await _request(
      '''mutation RegisterCompanyAccount(\$input: CompanyAccountRegisterInput!) {
      registerCompanyAccount(input: \$input) {
      $_accountFields
      }
    }''',
      {
        'input': {
          'chinese_name': input.chineseName,
          'english_name': input.englishName,
          'email': input.email,
          'password': input.password,
          'country': input.country,
          'mobile': input.mobile,
        },
      },
      public: true,
    );
    return _tokensFrom(
      _map(result, const ['data', 'registerCompanyAccount']),
      '目前無法註冊，請稍後再試',
    );
  }

  /// Callers arriving during a refresh wait for that one instead of starting another.
  Future<bool> refresh() {
    if (refreshToken == null ||
        refreshToken!.isEmpty ||
        accountId == null ||
        companyId == null) {
      return Future.value(false);
    }
    return _pendingRefresh ??= _runRefresh().whenComplete(
      () => _pendingRefresh = null,
    );
  }

  Future<bool> _runRefresh() async {
    final Map<String, dynamic> result;
    try {
      result = await _request(
        '''mutation RefreshToken(\$refreshToken: String!, \$account_id: String!, \$company_id: String!) {
        refreshToken(refreshTokenInput: {refreshToken: \$refreshToken, company_id: \$company_id, account_id: \$account_id}) {
          $_accountFields
        }
      }''',
        {
          'refreshToken': refreshToken,
          'account_id': accountId,
          'company_id': companyId,
        },
        public: true,
      );
    } on GraphQLException catch (error) {
      if (error.code == 'UNAUTHENTICATED') return false;
      rethrow;
    }
    final value = _map(result, const ['data', 'refreshToken']);
    final access = value?['token'];
    if (access is! String || access.isEmpty) return false;
    token = access;
    if (value?['refreshToken'] is String &&
        (value!['refreshToken'] as String).isNotEmpty) {
      refreshToken = value['refreshToken'] as String;
    }
    account = CurrentAccount.fromJson(value!);
    onTokensChanged?.call();
    return true;
  }

  /// Replies go out through the conversation's platform, as they do in the
  /// admin inbox, file and all. The platform's refusal comes back as an error,
  /// so nothing looks sent when it wasn't.
  /// @returns the stored message, or the last one when it went as two
  Future<ChatMessage?> sendMessage({
    required ChatConversation conversation,
    required String contents,
    UploadedFile? attachment,
    int disappearingSeconds = 0,
  }) async {
    final platform = conversation.platform;
    final Map<String, dynamic> input;
    if (platform != null && platform != 'app') {
      final message = {
        if (contents.isNotEmpty) 'text': contents,
        if (attachment != null)
          'attachments': [attachment.toMessageAttachment()],
      };
      final recipient = conversation.customer?.id;
      input = {
        'to_chat_room_id': conversation.messageRoomId,
        'platform': platform,
        'channel_id': conversation.channelId,
        'contents': jsonEncode(
          platform == 'fb' || platform == 'ig'
              ? {
                  'recipient': {'id': recipient},
                  'messaging_type': 'RESPONSE',
                  'message': message,
                }
              : {'message': message, 'recipient': recipient},
        ),
      };
    } else {
      input = {
        'to_chat_room_id': conversation.id,
        'platform': 'app',
        'info_Content': '{}',
        // The platforms keep their own copy, so only these can disappear.
        if (disappearingSeconds > 0)
          'disappearing_after_seconds': disappearingSeconds,
        'contents': attachment == null
            ? contents
            : jsonEncode({
                'text': contents,
                'attachments': [attachment.toMessageAttachment()],
              }),
      };
    }
    final result = await _request(
      '''mutation SendMessage(\$messageInput: MessageInput) {
      appSendMessage(MessageInput: \$messageInput) { $_messageFields }
    }''',
      {'messageInput': input},
    );
    final value = _map(result, const ['data', 'appSendMessage']);
    if (value == null) throw const GraphQLException('訊息傳送失敗');
    return ChatMessage.fromJson({
      'to_chat_room_id': conversation.messageRoomId,
      'channel_id': conversation.channelId,
      ...value,
    });
  }

  /// Uploads a file about to be sent. The server applies [platform]'s limits.
  /// [onProgress] gets 0–100 as the file goes out.
  Future<UploadedFile> uploadAttachment(
    PendingAttachment file, {
    required String? platform,
    void Function(int percent)? onProgress,
  }) async {
    Future<http.Response> send() async {
      final request = http.StreamedRequest(
        'POST',
        Uri.parse('$realtimeEndpoint/api/uploads')
            .replace(queryParameters: {'platform': platform ?? ''}),
      );
      request.headers['Content-Type'] = file.mime;
      request.headers['X-File-Name'] = Uri.encodeComponent(file.name);
      if (isAuthenticated) request.headers['Authorization'] = 'Bearer $token';
      request.contentLength = file.size;
      final response = _client.send(request).timeout(_uploadTimeout);
      const chunk = 64 * 1024;
      for (var offset = 0; offset < file.size; offset += chunk) {
        final end = offset + chunk < file.size ? offset + chunk : file.size;
        request.sink.add(file.bytes.sublist(offset, end));
        onProgress?.call((end * 99) ~/ (file.size == 0 ? 1 : file.size));
        await Future<void>.delayed(Duration.zero);
      }
      unawaited(request.sink.close());
      return http.Response.fromStream(await response);
    }

    http.Response response;
    try {
      response = await send();
      if (response.statusCode == 401 && await refresh()) {
        response = await send();
      }
    } on http.ClientException {
      throw const GraphQLException('上傳失敗，請檢查網路連線後重試');
    } on TimeoutException {
      throw const GraphQLException('上傳逾時，請檢查網路連線後重試');
    }
    Object? body;
    try {
      body = jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      body = null;
    }
    if (response.statusCode == 201 &&
        body is Map<String, dynamic> &&
        body['url'] is String) {
      onProgress?.call(100);
      return UploadedFile.fromJson(body);
    }
    if (response.statusCode == 401) {
      onSessionExpired?.call();
      throw const GraphQLException('登入已失效，請重新登入', statusCode: 401);
    }
    final error = body is Map ? body['error'] : null;
    throw GraphQLException(
      error is String && error.isNotEmpty
          ? error
          : '上傳失敗（${response.statusCode}）',
      statusCode: response.statusCode,
    );
  }

  /// A page of the account's conversations, newest message first. The server
  /// only lists the channels the account works in.
  Future<RoomListPage> fetchConversationPage({
    ConversationFilter filter = const ConversationFilter(),
    String? after,
    int first = 30,
  }) async {
    final result = await _request(
      '''query ChatRoomPage(\$first: Int, \$after: String, \$filter: ChatRoomFilter) {
      chatRoomPage(first: \$first, after: \$after, filter: \$filter) {
        rooms { $_roomFields }
        nextCursor hasMore
      }
    }''',
      {'first': first, 'after': after, 'filter': filter.toJson()},
    );
    final page = _map(result, const ['data', 'chatRoomPage']);
    return RoomListPage(
      rooms: _list(result, const [
        'data',
        'chatRoomPage',
        'rooms',
      ]).map(ChatConversation.fromJson).toList(),
      nextCursor: page?['nextCursor'] as String?,
      hasMore: page?['hasMore'] == true,
    );
  }

  /// One conversation, by its id or by the room and channel a message carries.
  /// Null when it doesn't exist or is in a channel this account doesn't work in.
  Future<ChatConversation?> fetchConversation({
    String? id,
    String? chatRoomId,
    String? channelId,
  }) async {
    final result = await _request(
      '''query ChatRoom(\$id: ID, \$chatRoomId: String, \$channelId: ID) {
      chatRoom(id: \$id, chat_room_id: \$chatRoomId, channel_id: \$channelId) { $_roomFields }
    }''',
      {'id': ?id, 'chatRoomId': ?chatRoomId, 'channelId': ?channelId},
    );
    final value = _map(result, const ['data', 'chatRoom']);
    return value == null ? null : ChatConversation.fromJson(value);
  }

  /// The newest messages by default, older ones with [before], newer ones
  /// with [after] (both are message cursors).
  Future<MessagePage> fetchMessagePage(
    ChatConversation conversation, {
    String? before,
    String? after,
    int first = 30,
  }) async {
    final result = await _request(
      '''query MessagePage(\$id: ID!, \$first: Int, \$before: String, \$after: String) {
      messagePage(id: \$id, first: \$first, before: \$before, after: \$after) {
        messages { $_messageFields }
        hasOlder hasNewer
      }
    }''',
      {
        'id': conversation.id,
        'first': first,
        'before': ?before,
        'after': ?after,
      },
    );
    final page = _map(result, const ['data', 'messagePage']);
    final messages = _list(result, const [
      'data',
      'messagePage',
      'messages',
    ]).map(ChatMessage.fromJson).toList();
    for (final message in messages.where((item) => item.needsViewedMark)) {
      _markViewedOnce(message.id);
    }
    return MessagePage(
      messages: messages,
      hasOlder: page?['hasOlder'] == true,
      hasNewer: page?['hasNewer'] == true,
    );
  }

  final _markedViewed = <String>{};

  // Disappearing messages count down once someone has been shown them.
  void _markViewedOnce(String messageId) {
    if (!_markedViewed.add(messageId)) return;
    unawaited(
      markMessageRead(messageId).catchError((Object _) {
        _markedViewed.remove(messageId);
      }),
    );
  }

  /// Marks the conversation read for this account, up to [messageId] or its
  /// newest message. Returns the unread count left.
  Future<int> markConversationRead(String id, {String? messageId}) async {
    final result = await _request(
      r'''mutation MarkChatRoomRead($id: ID!, $messageId: ID) {
      markChatRoomRead(id: $id, messageId: $messageId) { id unreadCount }
    }''',
      {'id': id, 'messageId': ?messageId},
    );
    final value = _map(result, const ['data', 'markChatRoomRead']);
    _readChanges.add(null);
    return (value?['unreadCount'] as num?)?.toInt() ?? 0;
  }

  /// How many of this account's conversations have messages it hasn't read.
  Future<int> unreadConversationCount() async {
    final result = await _request(
      r'''query UnreadChatRoomCount { unreadChatRoomCount }''',
      const {},
    );
    final data = result['data'];
    final count = data is Map ? data['unreadChatRoomCount'] : null;
    if (count is! num) throw StateError('unread count missing');
    return count.toInt();
  }

  /// The approved templates of a WhatsApp conversation's number, read from Meta.
  Future<List<WhatsappTemplate>> fetchWhatsappTemplates(String roomId) async {
    final result = await _request(
      '''query WhatsappTemplates(\$id: ID!) {
      whatsappTemplates(id: \$id) { $_whatsappTemplateFields }
    }''',
      {'id': roomId},
    );
    return _list(result, const [
      'data',
      'whatsappTemplates',
    ]).map(WhatsappTemplate.fromJson).toList();
  }

  Future<ChatMessage> sendWhatsappTemplate({
    required ChatConversation conversation,
    required String templateId,
    required Map<String, String> values,
    String? headerMediaUrl,
  }) async {
    final result = await _request(
      '''mutation SendWhatsappTemplate(\$id: ID!, \$templateId: ID!, \$values: [WhatsappTemplateValue!], \$headerMediaUrl: String) {
      sendWhatsappTemplate(id: \$id, templateId: \$templateId, values: \$values, header_media_url: \$headerMediaUrl) { $_messageFields }
    }''',
      {
        'id': conversation.id,
        'templateId': templateId,
        'values': [
          for (final entry in values.entries)
            {'key': entry.key, 'value': entry.value},
        ],
        'headerMediaUrl': ?headerMediaUrl,
      },
    );
    final value = _map(result, const ['data', 'sendWhatsappTemplate']);
    if (value == null) throw const GraphQLException('範本未送出');
    return ChatMessage.fromJson({
      'to_chat_room_id': conversation.messageRoomId,
      'channel_id': conversation.channelId,
      ...value,
    });
  }

  /// The company's templates, which any agent can insert into a reply.
  Future<List<MessageTemplate>> fetchQuickReplies() async {
    final result = await _request(
      r'''query QuickReplies { quickReplies { id name platform contents } }''',
      const {},
    );
    return _list(result, const [
      'data',
      'quickReplies',
    ]).map(MessageTemplate.fromJson).toList();
  }

  // ---- Push notifications ----

  Future<bool> pushNotificationsAvailable() async {
    final result = await _request(
      r'''query PushNotificationsAvailable { pushNotificationsAvailable }''',
      const {},
    );
    final data = result['data'];
    return data is Map && data['pushNotificationsAvailable'] == true;
  }

  /// Whether a customer's message in this conversation is for this account
  /// right now, by the rule the server picks who gets a notification with.
  Future<bool> messageNotifiesMe({
    required String chatRoomId,
    required String channelId,
  }) async {
    final result = await _request(
      r'''query MessageNotifiesMe($chatRoomId: String!, $channelId: ID!) {
      messageNotifiesMe(chat_room_id: $chatRoomId, channel_id: $channelId)
    }''',
      {'chatRoomId': chatRoomId, 'channelId': channelId},
    );
    final data = result['data'];
    return !(data is Map && data['messageNotifiesMe'] == false);
  }

  /// [platform] is ios or android.
  Future<void> registerPushDevice(String deviceToken, String platform) async {
    await _request(
      r'''mutation RegisterPushDevice($token: String!, $platform: String!) {
      registerPushDevice(token: $token, platform: $platform)
    }''',
      {'token': deviceToken, 'platform': platform},
    );
  }

  Future<void> unregisterPushDevice(String deviceToken) async {
    await _request(
      r'''mutation UnregisterPushDevice($token: String!) {
      unregisterPushDevice(token: $token)
    }''',
      {'token': deviceToken},
    );
  }

  Future<CallSession> startCall({
    required String conversationId,
    required String kind,
  }) async {
    final response = await _callApi(
      '/api/realtime/calls',
      method: 'POST',
      body: {'roomId': conversationId, 'kind': kind},
    );
    return CallSession.fromJson(response);
  }

  Future<LiveKitToken> fetchLiveKitToken({required String callId}) async {
    try {
      final response = await _callApi(
        '/api/realtime/calls/$callId/livekit-token',
        method: 'POST',
        body: const {},
      );
      return LiveKitToken.fromJson(response);
    } on GraphQLException catch (error) {
      if (error.statusCode == 503) {
        throw const GraphQLException('通話服務尚未設定，暫時無法通話', statusCode: 503);
      }
      rethrow;
    }
  }

  /// Keeps the call's record right. A failure here must not disturb the call.
  Future<void> reportCallEvent(String callId, String type) async {
    try {
      await _callApi(
        '/api/realtime/calls/$callId/events',
        method: 'POST',
        body: {'type': type, 'payload': const <String, dynamic>{}},
      );
    } catch (_) {
      // The call itself is unaffected.
    }
  }

  /// Starts a shown message's countdown. It can be retried on the next refresh.
  Future<void> markMessageRead(String messageId) async {
    await _request(
      r'''mutation MarkMessageRead($messageId: ID!) {
      markMessageRead(messageId: $messageId) { _id }
    }''',
      {'messageId': messageId},
    );
  }

  Future<List<ClientUser>> fetchUsers() async {
    final result = await _request(r'''query Users {
      listAccounts { items { _id email info { name avatar } } }
    }''', const {});
    final accounts = _list(result, const ['data', 'listAccounts', 'items']);
    return accounts.map((account) {
      final info = account['info'] is Map<String, dynamic>
          ? account['info'] as Map<String, dynamic>
          : const <String, dynamic>{};
      return ClientUser.fromJson({
        'id': account['_id'],
        'name': info['name'] ?? account['email'],
        'avatarUrl': info['avatar'],
        'email': account['email'],
      });
    }).toList();
  }

  Future<List<ChatConversation>> fetchConversations() async {
    final result = await _request(r'''query ChatRooms {
      chatRooms {
        id title lastMessage platform channel_id chat_room_id updatedAt
        users { id name first_name last_name avatar }
      }
    }''', const {});
    final rooms = _list(result, const [
      'data',
      'chatRooms',
    ]).map(ChatConversation.fromJson).toList();
    rooms.sort(
      (a, b) =>
          (b.updatedAt ?? DateTime(0)).compareTo(a.updatedAt ?? DateTime(0)),
    );
    return rooms;
  }

  // ---- Channels ----

  /// The channels of this account. [withConnection] also reads how each one's
  /// connection is doing, which may make the backend ask Meta again, so only
  /// the channel management page asks for it.
  Future<List<SocialChannel>> fetchChannels({
    bool withConnection = false,
  }) async {
    final result = withConnection
        ? await _request('''query GetChannelsWithConnection {
      getUserSubscribedChannels {
        platform name channel_id enabled phone
        connection { $_channelConnectionFields }
        whatsapp_web { $_whatsappWebFields }
      }
    }''', const {})
        : await _request(r'''query GetUserSubscribedChannels {
      getUserSubscribedChannels { platform name channel_id enabled }
    }''', const {});
    return _list(result, const [
      'data',
      'getUserSubscribedChannels',
    ]).map(SocialChannel.fromJson).toList();
  }

  /// Removes a channel: it stops taking in and sending messages. Admins only.
  Future<void> deleteChannel(String channelId) async {
    await _request(
      r'''mutation DeleteChannel($channelId: ID!) {
      deleteChannel(channel_id: $channelId)
    }''',
      {'channelId': channelId},
    );
  }

  /// Asks the platform now how the channel's connection is doing, skipping the
  /// backend's 10 minutes between checks. Admins only.
  Future<({String? phone, ChannelConnection? connection})>
  checkChannelConnection(String channelId) async {
    final result = await _request(
      '''mutation CheckChannelConnection(\$channelId: ID!) {
      checkChannelConnection(channel_id: \$channelId) {
        channel_id phone connection { $_channelConnectionFields }
      }
    }''',
      {'channelId': channelId},
    );
    final value = _map(result, const ['data', 'checkChannelConnection']);
    if (value == null) throw const GraphQLException('無法檢查連線');
    final phone = value['phone'];
    return (
      phone: phone is String && phone.isNotEmpty ? phone : null,
      connection: ChannelConnection.fromJson(value['connection']),
    );
  }

  // ---- WhatsApp connected by QR or pairing code ----

  WhatsappWebConnection _webConnection(Map<String, dynamic>? value) {
    final connection = WhatsappWebConnection.fromJson(value);
    if (connection == null) {
      throw const GraphQLException('無法讀取 WhatsApp 連線');
    }
    return connection;
  }

  /// Starts connecting a WhatsApp number: a new channel without [channelId],
  /// or scanning again for an existing one.
  Future<WhatsappWebConnection> connectWhatsappWeb({String? channelId}) async {
    final result = await _request(
      '''mutation ConnectWhatsappWeb(\$channelId: ID) {
      connectWhatsappWeb(channel_id: \$channelId) { $_whatsappWebFields }
    }''',
      {'channelId': channelId},
    );
    return _webConnection(_map(result, const ['data', 'connectWhatsappWeb']));
  }

  /// The connection right now, with the newest QR code while it waits.
  Future<WhatsappWebConnection> whatsappWebConnection(String channelId) async {
    final result = await _request(
      '''query WhatsappWebConnection(\$channelId: ID!) {
      whatsappWebConnection(channel_id: \$channelId) { $_whatsappWebFields }
    }''',
      {'channelId': channelId},
    );
    return _webConnection(
      _map(result, const ['data', 'whatsappWebConnection']),
    );
  }

  /// An 8-character code to type on the phone instead of scanning. [phone]
  /// includes the country code.
  Future<String> requestWhatsappWebPairingCode(
    String channelId,
    String phone,
  ) async {
    final result = await _request(
      r'''mutation RequestWhatsappWebPairingCode($channelId: ID!, $phone: String!) {
      requestWhatsappWebPairingCode(channel_id: $channelId, phone: $phone)
    }''',
      {'channelId': channelId, 'phone': phone},
    );
    final data = result['data'];
    final code = data is Map ? data['requestWhatsappWebPairingCode'] : null;
    if (code is! String || code.isEmpty) {
      throw const GraphQLException('無法取得配對碼');
    }
    return code;
  }

  /// Stops connecting. Returns true when a channel no phone ever connected
  /// was removed.
  Future<bool> cancelWhatsappWeb(String channelId) async {
    final result = await _request(
      r'''mutation CancelWhatsappWeb($channelId: ID!) {
      cancelWhatsappWeb(channel_id: $channelId)
    }''',
      {'channelId': channelId},
    );
    final data = result['data'];
    return data is Map && data['cancelWhatsappWeb'] == true;
  }

  /// Names a connected number's channel and adds the agents who work in it.
  /// Returns the saved name.
  Future<String> updateWhatsappWebChannel(
    String channelId, {
    required String name,
    List<String> agentIds = const [],
  }) async {
    final result = await _request(
      r'''mutation UpdateWhatsappWebChannel($channelId: ID!, $name: String!, $agentIds: [ID!]) {
      updateWhatsappWebChannel(channel_id: $channelId, name: $name, agent_ids: $agentIds) { channel_id name }
    }''',
      {'channelId': channelId, 'name': name, 'agentIds': agentIds},
    );
    final value = _map(result, const ['data', 'updateWhatsappWebChannel']);
    if (value == null) throw const GraphQLException('無法儲存');
    return '${value['name'] ?? name}';
  }

  /// Everyone in the company who can work in a channel.
  Future<List<ChannelAgent>> fetchChannelAgents() async {
    final result = await _request(r'''query ChatRoomAssignees {
      chatRoomAssignees { id name email role }
    }''', const {});
    return _list(result, const [
      'data',
      'chatRoomAssignees',
    ]).map(ChannelAgent.fromJson).toList();
  }

  Future<bool> setChannelEnabled(String channelId, bool enabled) async {
    final result = await _request(
      r'''mutation SetChannelEnabled($channelId: ID!, $enabled: Boolean!) {
      setChannelEnabled(channel_id: $channelId, enabled: $enabled) { channel_id enabled }
    }''',
      {'channelId': channelId, 'enabled': enabled},
    );
    final value = _map(result, const ['data', 'setChannelEnabled']);
    if (value == null) throw const GraphQLException('頻道狀態更新失敗');
    return value['enabled'] != false;
  }

  Future<String> createMetaConnectUrl() async {
    final result = await _request(
      r'''mutation CreateMetaConnectUrl($returnUrl: String!) {
      createMetaConnectUrl(return_url: $returnUrl)
    }''',
      {'returnUrl': '$adminUrl/channels-management'},
    );
    final data = result['data'];
    final url = data is Map ? data['createMetaConnectUrl'] : null;
    if (url is! String || url.isEmpty) {
      throw const GraphQLException('無法開始串接');
    }
    return url;
  }

  // ---- Team accounts ----

  Future<List<TeamAccount>> fetchTeamAccounts() async {
    final result = await _request(
      '''query ListAccounts(\$input: AccountListInput) {
      listAccounts(input: \$input) { items { $_teamAccountFields } total }
    }''',
      {
        'input': {'company_id': companyId},
      },
    );
    return _list(result, const [
      'data',
      'listAccounts',
      'items',
    ]).map(TeamAccount.fromJson).toList();
  }

  Future<void> createAccount({
    required String email,
    required String password,
    required String role,
    required Map<String, dynamic> info,
  }) async {
    await _request(
      '''mutation CreateAccount(\$input: AccountCreateInput!, \$company_id: String!) {
      createAccount(input: \$input, company_id: \$company_id) { _id }
    }''',
      {
        'company_id': companyId,
        'input': {
          'email': email,
          'password': password,
          'role': role,
          'user_info': jsonEncode(info),
        },
      },
    );
  }

  Future<TeamAccount> updateAccount(
    String id,
    Map<String, dynamic> input,
  ) async {
    final result = await _request(
      '''mutation UpdateAccount(\$_id: String!, \$input: AccountUpdateInput!) {
      updateAccount(_id: \$_id, input: \$input) { $_teamAccountFields }
    }''',
      {'_id': id, 'input': input},
    );
    final value = _map(result, const ['data', 'updateAccount']);
    if (value == null) throw const GraphQLException('無法儲存使用者');
    return TeamAccount.fromJson(value);
  }

  Future<void> deleteAccount(String id) async {
    await _request(
      r'''mutation DeleteAccount($_id: String!) { deleteAccount(_id: $_id) }''',
      {'_id': id},
    );
  }

  // ---- Message templates ----

  Future<List<MessageTemplate>> fetchTemplates() async {
    final result = await _request(
      'query MessageTemplates { messageTemplates { $_templateFields } }',
      const {},
    );
    return _list(result, const [
      'data',
      'messageTemplates',
    ]).map(MessageTemplate.fromJson).toList();
  }

  Future<void> saveTemplate({
    String? id,
    required String name,
    required String category,
    required String platform,
    required List<String> messages,
  }) async {
    final input = {
      'name': name,
      'category': category,
      'platform': platform,
      'contents': serializeTemplateMessages(messages),
    };
    if (id == null) {
      await _request(
        '''mutation CreateMessageTemplate(\$input: MessageTemplateInput!) {
        createMessageTemplate(input: \$input) { id }
      }''',
        {'input': input},
      );
    } else {
      await _request(
        '''mutation UpdateMessageTemplate(\$id: ID!, \$input: MessageTemplateInput!) {
        updateMessageTemplate(id: \$id, input: \$input) { id }
      }''',
        {'id': id, 'input': input},
      );
    }
  }

  Future<void> deleteTemplate(String id) async {
    await _request(
      r'''mutation DeleteMessageTemplate($id: ID!) { deleteMessageTemplate(id: $id) }''',
      {'id': id},
    );
  }

  // ---- Company ----

  Future<CompanyInfo> fetchCompany() async {
    final result = await _request(
      r'''query Company($id: String) {
      findCompanyById(_id: $id) {
        _id email chinese_name english_name logo mobile country pin_number address
        subscription { name period { start end } }
        principal_info { first_name last_name cn_name mobile }
      }
    }''',
      {'id': companyId},
    );
    final value = _map(result, const ['data', 'findCompanyById']);
    if (value == null) throw const GraphQLException('找不到公司資料');
    return CompanyInfo.fromJson(value);
  }

  Future<void> updateCompany(Map<String, dynamic> changes) async {
    await _request(
      r'''mutation UpdateCompanyInfo($updateCompanyInput: UpdateCompanyInfoInput) {
      updateCompanyInfo(UpdateCompanyInput: $updateCompanyInput)
    }''',
      {
        'updateCompanyInput': {'_id': companyId, ...changes},
      },
    );
  }

  /// Whether the backend answers at all, for the settings page.
  Future<bool> ping() async {
    try {
      await _request('query Ping { __typename }', const {}, public: true);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>> _callApi(
    String path, {
    required String method,
    required Map<String, dynamic> body,
  }) async {
    try {
      final request = http.Request(method, Uri.parse('$realtimeEndpoint$path'))
        ..headers['Content-Type'] = 'application/json'
        ..body = jsonEncode(body);
      if (isAuthenticated) {
        request.headers['Authorization'] = 'Bearer $token';
      }
      final response = await http.Response.fromStream(
        await _client.send(request).timeout(_timeout),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw GraphQLException(
          '伺服器連線失敗（${response.statusCode}）',
          statusCode: response.statusCode,
        );
      }
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is! Map<String, dynamic>) {
        throw const GraphQLException('伺服器回應格式無效');
      }
      return decoded;
    } on GraphQLException {
      rethrow;
    } on http.ClientException {
      throw const GraphQLException('無法連線至伺服器，請稍後重試');
    } on TimeoutException {
      throw const GraphQLException('無法連線至伺服器，請稍後重試');
    } on FormatException {
      throw const GraphQLException('伺服器回應格式無效');
    }
  }

  static const _timeout = Duration(seconds: 20);
  static const _uploadTimeout = Duration(minutes: 5);

  /// [public] requests go without a token: the backend rejects the whole request
  /// when it carries an expired one, which would also block refreshing it.
  Future<Map<String, dynamic>> _request(
    String query,
    Map<String, dynamic> variables, {
    bool public = false,
    bool allowRefresh = true,
  }) async {
    final http.Response response;
    try {
      response = await _client
          .post(
            Uri.parse(endpoint),
            headers: {
              'Content-Type': 'application/json',
              if (!public && isAuthenticated) 'Authorization': 'Bearer $token',
            },
            body: jsonEncode({'query': query, 'variables': variables}),
          )
          .timeout(_timeout);
    } on http.ClientException {
      throw const GraphQLException('無法連線至伺服器，請稍後重試');
    } on TimeoutException {
      throw const GraphQLException('無法連線至伺服器，請稍後重試');
    }

    final Object? decoded;
    try {
      decoded = jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw GraphQLException(
          '伺服器連線失敗（${response.statusCode}）',
          statusCode: response.statusCode,
        );
      }
      throw const GraphQLException('伺服器回應格式無效');
    }
    if (decoded is! Map<String, dynamic>) {
      throw const GraphQLException('伺服器回應格式無效');
    }

    final errors = decoded['errors'];
    if (errors is List && errors.isNotEmpty) {
      final first = errors.first;
      final message = first is Map
          ? '${first['message'] ?? 'GraphQL request failed'}'
          : 'GraphQL request failed';
      final extensions = first is Map ? first['extensions'] : null;
      final code = extensions is Map ? extensions['code'] as String? : null;
      final expired =
          response.statusCode == 401 ||
          code == 'UNAUTHENTICATED' ||
          message.toLowerCase().contains('jwt expired');
      if (expired && !public) {
        if (allowRefresh && await refresh()) {
          return _request(query, variables, allowRefresh: false);
        }
        onSessionExpired?.call();
        throw const GraphQLException('登入已過期，請重新登入', code: 'UNAUTHENTICATED');
      }
      throw GraphQLException(
        _friendlyErrors[code] ?? message,
        statusCode: response.statusCode,
        code: code,
        extensions: extensions is Map<String, dynamic> ? extensions : const {},
      );
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw GraphQLException(
        '伺服器連線失敗（${response.statusCode}）',
        statusCode: response.statusCode,
      );
    }
    return decoded;
  }

  Map<String, dynamic>? _map(Map<String, dynamic> payload, List<String> path) {
    dynamic value = payload;
    for (final key in path) {
      if (value is! Map<String, dynamic>) return null;
      value = value[key];
    }
    return value is Map<String, dynamic> ? value : null;
  }

  List<Map<String, dynamic>> _list(
    Map<String, dynamic> payload,
    List<String> path,
  ) {
    dynamic value = payload;
    for (final key in path) {
      if (value is! Map<String, dynamic>) return const [];
      value = value[key];
    }
    return value is List
        ? value.whereType<Map<String, dynamic>>().toList()
        : const [];
  }
}
