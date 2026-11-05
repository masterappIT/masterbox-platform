import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/app_models.dart';
import 'realtime_service.dart';

/// The token debug builds sign in with when no backend is reachable.
const developmentToken = 'development-token';

class GraphQLException implements Exception {
  const GraphQLException(this.message, {this.statusCode, this.code});
  final String message;
  final int? statusCode;
  final String? code;
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
  StreamSubscription<Map<String, dynamic>>? _realtimeListener;
  final _messageEvents = StreamController<ChatMessage>.broadcast();

  bool get isAuthenticated => token != null && token!.isNotEmpty;
  bool get isDevelopmentSession => token == developmentToken;

  /// Messages as they arrive over the socket, for pages to refresh on.
  Stream<ChatMessage> get messageEvents => _messageEvents.stream;

  Uri get _socketUrl {
    final url = Uri.parse(endpoint);
    return url.replace(scheme: url.scheme == 'https' ? 'wss' : 'ws');
  }

  void startRealtime() {
    if (!isAuthenticated || isDevelopmentSession) return;
    final realtime = _realtime ??= RealtimeService(
      url: _socketUrl,
      token: () => token,
      onAuthRejected: () async {
        await refresh();
      },
      connector: socketConnector,
    );
    _realtimeListener ??= realtime.events.listen(
      (json) => _messageEvents.add(ChatMessage.fromJson(json)),
    );
    realtime.start();
  }

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

  /// Replies go out through the conversation's platform, as they do in the admin
  /// inbox. The platform's refusal comes back as an error, so nothing looks sent
  /// when it wasn't. Attachments can't be delivered to customers yet, so they are
  /// only stored in MasterBox.
  Future<bool> sendMessage({
    required ChatConversation conversation,
    required String contents,
    Map<String, dynamic>? attachment,
    int disappearingSeconds = 0,
  }) async {
    final platform = conversation.platform;
    final Map<String, dynamic> input;
    if (attachment == null && platform != null && platform != 'app') {
      final message = {'text': contents};
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
                'attachments': [attachment],
              }),
      };
    }
    final result = await _request(
      r'''mutation SendMessage($messageInput: MessageInput) {
      appSendMessage(MessageInput: $messageInput) { _id delivery_error }
    }''',
      {'messageInput': input},
    );
    if (_map(result, const ['data', 'appSendMessage']) == null) {
      throw const GraphQLException('訊息傳送失敗');
    }
    return true;
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

  Future<List<ChatMessage>> fetchMessages(String roomId) async {
    final result = await _request(
      r'''query Messages($roomId: ID) {
      messages(roomId: $roomId) { id _id contents to_chat_room_id sentAt inbound delivery_error disappearing_after_seconds readAt }
    }''',
      {'roomId': roomId},
    );
    return _list(result, const [
      'data',
      'messages',
    ]).map(ChatMessage.fromJson).toList();
  }

  // ---- Channels ----

  Future<List<SocialChannel>> fetchChannels() async {
    final result = await _request(r'''query GetUserSubscribedChannels {
      getUserSubscribedChannels { platform name channel_id enabled }
    }''', const {});
    return _list(result, const [
      'data',
      'getUserSubscribedChannels',
    ]).map(SocialChannel.fromJson).toList();
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
        if (!isDevelopmentSession) {
          onSessionExpired?.call();
          throw const GraphQLException('登入已過期，請重新登入', code: 'UNAUTHENTICATED');
        }
      }
      throw GraphQLException(
        _friendlyErrors[code] ?? message,
        statusCode: response.statusCode,
        code: code,
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
