import 'dart:convert';
import 'dart:io';

import '../models/app_models.dart';

class GraphQLException implements Exception {
  const GraphQLException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;
  @override
  String toString() => message;
}

class AuthTokens {
  const AuthTokens({
    required this.token,
    this.refreshToken,
    this.accountId,
    this.companyId,
  });

  final String token;
  final String? refreshToken;
  final String? accountId;
  final String? companyId;
}

class GraphQLService {
  GraphQLService({
    String? endpoint,
    String? realtimeEndpoint,
    this.token,
    this.refreshToken,
    this.accountId,
    this.companyId,
  })  : endpoint = endpoint ?? const String.fromEnvironment(
          'GRAPHQL_ENDPOINT',
          defaultValue: 'http://localhost:4000/graphql',
        ),
        realtimeEndpoint = realtimeEndpoint ?? const String.fromEnvironment(
          'REALTIME_ENDPOINT',
          defaultValue: 'http://localhost:4000',
        );
  final String endpoint;
  final String realtimeEndpoint;
  String? token;
  String? refreshToken;
  String? accountId;
  String? companyId;
  bool _refreshing = false;
  bool get isAuthenticated => token != null && token!.isNotEmpty;

  Future<String?> login({
    required String email,
    required String password,
  }) async {
    final tokens = await authenticate(email: email, password: password);
    return tokens.token;
  }

  Future<AuthTokens> authenticate({
    required String email,
    required String password,
  }) async {
    final result = await _request(
      r'''mutation Login($email: String, $password: String) {
      loginAccount(LoginInput: {email: $email, password: $password}) {
      token _id company_id refreshToken
      }
    }''',
      {'email': email, 'password': password},
      allowRefresh: false,
    );
    final value = _map(result, const ['data', 'loginAccount']);
    final access = value?['token'];
    if (access is! String || access.isEmpty) {
      throw const GraphQLException('登入失敗，伺服器未提供有效的驗證 Token');
    }
    return AuthTokens(
      token: access,
      refreshToken: value?['refreshToken'] as String?,
      accountId: value?['_id'] as String?,
      companyId: value?['company_id'] as String?,
    );
  }

  Future<bool> refresh() async {
    if (_refreshing ||
        refreshToken == null ||
        refreshToken!.isEmpty ||
        accountId == null ||
        companyId == null) {
      return false;
    }
    _refreshing = true;
    try {
      final result = await _request(
        r'''mutation RefreshToken($refreshToken: String!, $account_id: String!, $company_id: String!) {
        refreshToken(refreshTokenInput: {refreshToken: $refreshToken, company_id: $company_id, account_id: $account_id}) {
          refreshToken token
        }
      }''',
        {
          'refreshToken': refreshToken,
          'account_id': accountId,
          'company_id': companyId,
        },
        allowRefresh: false,
      );
      final value = _map(result, const ['data', 'refreshToken']);
      final access = value?['token'];
      if (access is! String || access.isEmpty) return false;
      token = access;
      if (value?['refreshToken'] is String &&
          (value!['refreshToken'] as String).isNotEmpty) {
        refreshToken = value['refreshToken'] as String;
      }
      return true;
    } finally {
      _refreshing = false;
    }
  }

  Future<bool> sendMessage({
    required String conversationId,
    required String contents,
    Map<String, dynamic>? attachment,
  }) async {
    final payload = attachment == null
        ? contents
        : jsonEncode({
            'text': contents,
            'attachments': [attachment],
          });
    final result = await _request(
      r'''mutation SendMessage($roomId: String, $contents: String!) {
      appSendMessage(MessageInput: {to_chat_room_id: $roomId, contents: $contents, platform: "app", info_Content: "{}"}) { _id }
    }''',
      {'roomId': conversationId, 'contents': payload},
    );
    if (_map(result, const ['data', 'appSendMessage']) == null) {
      throw const GraphQLException('訊息傳送失敗');
    }
    return true;
  }

  Future<ChatConversation> updateConversationSettings({
    required String conversationId,
    required EncryptionMode encryptionMode,
    required int disappearingMessageSeconds,
  }) async {
    final result = await _request(
      r'''mutation UpdateChatSettings($roomId: ID!, $encryptionMode: String!, $disappearingSeconds: Int!) {
        updateChatRoomSettings(roomId: $roomId, encryptionMode: $encryptionMode, disappearingMessageSeconds: $disappearingSeconds) {
          id title lastMessage encryptionMode disappearingMessageSeconds
        }
      }''',
      {
        'roomId': conversationId,
        'encryptionMode': encryptionMode.apiValue,
        'disappearingSeconds': disappearingMessageSeconds,
      },
    );
    final value = _map(result, const ['data', 'updateChatRoomSettings']);
    if (value == null) throw const GraphQLException('聊天室設定更新失敗');
    return ChatConversation.fromJson(value);
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
    final response = await _callApi(
      '/api/realtime/calls/$callId/livekit-token',
      method: 'POST',
      body: const {},
    );
    return LiveKitToken.fromJson(response);
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
      });
    }).toList();
  }

  Future<List<ChatConversation>> fetchConversations() async {
    final result = await _request(
      'query ChatRooms { chatRooms { id title lastMessage } }',
      const {},
    );
    return _list(result, const [
      'data',
      'chatRooms',
    ]).map(ChatConversation.fromJson).toList();
  }

  Future<List<ChatMessage>> fetchMessages(String conversationId) async {
    final result = await _request(
      r'''query Messages($conversationId: ID!) {
      messages(conversationId: $conversationId) { id _id text contents sentAt isMine }
    }''',
      {'conversationId': conversationId},
    );
    return _list(result, const [
      'data',
      'messages',
    ]).map(ChatMessage.fromJson).toList();
  }

  Future<Map<String, dynamic>> _callApi(
    String path, {
    required String method,
    required Map<String, dynamic> body,
  }) async {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 10);
    try {
      final request = await client.openUrl(
        method,
        Uri.parse('$realtimeEndpoint$path'),
      );
      request.headers.contentType = ContentType.json;
      if (isAuthenticated) {
        request.headers.set(
          HttpHeaders.authorizationHeader,
          'Bearer $token',
        );
      }
      request.write(jsonEncode(body));
      final response = await request.close();
      final raw = await response.transform(utf8.decoder).join();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw GraphQLException(
          '伺服器連線失敗（${response.statusCode}）',
          statusCode: response.statusCode,
        );
      }
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) {
        throw const GraphQLException('伺服器回應格式無效');
      }
      return decoded;
    } on GraphQLException {
      rethrow;
    } on SocketException {
      throw const GraphQLException('無法連線至伺服器，請稍後重試');
    } on FormatException {
      throw const GraphQLException('伺服器回應格式無效');
    } finally {
      client.close(force: true);
    }
  }

  Future<Map<String, dynamic>> _request(
    String query,
    Map<String, dynamic> variables, {
    bool allowRefresh = true,
  }) async {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 10);
    try {
      final request = await client.postUrl(Uri.parse(endpoint));
      request.headers.contentType = ContentType.json;
      if (isAuthenticated) {
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token!');
      }
      request.write(jsonEncode({'query': query, 'variables': variables}));
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      final expired =
          response.statusCode == HttpStatus.unauthorized ||
          body.toLowerCase().contains('jwt expired') ||
          body.toLowerCase().contains('unauthorized');
      if (expired && allowRefresh && await refresh()) {
        return await _request(query, variables, allowRefresh: false);
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw GraphQLException(
          '伺服器連線失敗（${response.statusCode}）',
          statusCode: response.statusCode,
        );
      }
      final decoded = jsonDecode(body);
      if (decoded is! Map<String, dynamic>) {
        throw const GraphQLException('伺服器回應格式無效');
      }
      final errors = decoded['errors'];
      if (errors is List && errors.isNotEmpty) {
        final first = errors.first;
        final message = first is Map
            ? '${first['message'] ?? 'GraphQL request failed'}'
            : 'GraphQL request failed';
        if (allowRefresh &&
            message.toLowerCase().contains('jwt expired') &&
            await refresh()) {
          return await _request(query, variables, allowRefresh: false);
        }
        throw GraphQLException(message);
      }
      return decoded;
    } on GraphQLException {
      rethrow;
    } on SocketException {
      throw const GraphQLException('無法連線至伺服器，請稍後重試');
    } on FormatException {
      throw const GraphQLException('伺服器回應格式無效');
    } finally {
      client.close(force: true);
    }
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
