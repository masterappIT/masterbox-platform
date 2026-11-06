import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:masterbox_flutter/services/graphql_service.dart';
import 'package:masterbox_flutter/services/realtime_service.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

/// Answers GraphQL by operation name, and records what was asked.
class FakeBackend {
  FakeBackend(this.responses, {this.rest = const {}});

  /// Operation name -> `data` for it, a function of the variables, or a
  /// [FakeError].
  final Map<String, Object?> responses;
  final requests = <RecordedRequest>[];

  /// REST path suffix -> (status, JSON body), for the call endpoints.
  final Map<String, (int, Object?)> rest;
  final restCalls = <String>[];

  /// Every REST request, with its headers and query.
  final restRequests = <http.Request>[];

  http.Client get client => MockClient((request) async {
    if (request.url.path.startsWith('/api/')) {
      restRequests.add(request);
      restCalls.add(
        '${request.url.path} ${utf8.decode(request.bodyBytes, allowMalformed: true)}',
      );
      for (final entry in rest.entries) {
        if (request.url.path.endsWith(entry.key)) {
          return http.Response.bytes(
            utf8.encode(jsonEncode(entry.value.$2)),
            entry.value.$1,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
      }
      return http.Response('{}', 404);
    }
    final body = jsonDecode(request.body) as Map<String, dynamic>;
    final query = body['query'] as String;
    final operation =
        RegExp(r'(?:query|mutation)\s+(\w+)').firstMatch(query)?.group(1) ?? '';
    final variables = (body['variables'] as Map).cast<String, dynamic>();
    requests.add(
      RecordedRequest(
        operation,
        variables,
        request.headers['Authorization'],
        query,
      ),
    );
    var answer = responses[operation];
    if (answer is Function) answer = answer(variables);
    if (answer is FakeError) {
      return http.Response(
        jsonEncode({
          'errors': [
            {
              'message': answer.message,
              'extensions': {'code': answer.code, ...answer.extensions},
            },
          ],
        }),
        answer.status,
        headers: {'content-type': 'application/json; charset=utf-8'},
      );
    }
    return http.Response.bytes(
      utf8.encode(jsonEncode({'data': answer})),
      200,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );
  });

  List<RecordedRequest> named(String operation) =>
      requests.where((request) => request.operation == operation).toList();

  GraphQLService service({
    String? token = 'access-token',
    String? refreshToken = 'refresh-token',
    String? accountId = 'me',
    String? companyId = 'company-1',
    SocketConnector? socketConnector,
  }) => GraphQLService(
    endpoint: 'https://api.test/graphql',
    realtimeEndpoint: 'https://api.test',
    adminUrl: 'https://admin.test',
    token: token,
    refreshToken: refreshToken,
    accountId: accountId,
    companyId: companyId,
    httpClient: client,
    socketConnector: socketConnector,
  );
}

class RecordedRequest {
  const RecordedRequest(
    this.operation,
    this.variables,
    this.authorization,
    this.query,
  );
  final String operation;
  final Map<String, dynamic> variables;
  final String? authorization;
  final String query;
}

class FakeSocketSink implements WebSocketSink {
  final sent = <Map<String, dynamic>>[];
  bool closed = false;

  @override
  void add(dynamic data) =>
      sent.add(jsonDecode('$data') as Map<String, dynamic>);

  @override
  Future<void> close([int? closeCode, String? closeReason]) async =>
      closed = true;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeSocket implements WebSocketChannel {
  final incoming = StreamController<dynamic>();
  final fakeSink = FakeSocketSink();

  void receive(Map<String, dynamic> message) =>
      incoming.add(jsonEncode(message));

  /// The server ends the connection.
  void drop() => incoming.close();

  void receiveMessage(Map<String, dynamic> message) => receive({
    'id': '1',
    'type': 'next',
    'payload': {
      'data': {'sendMessage': message},
    },
  });

  @override
  Stream<dynamic> get stream => incoming.stream;

  @override
  WebSocketSink get sink => fakeSink;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeError {
  const FakeError(
    this.message, {
    this.code = 'INTERNAL',
    this.status = 200,
    this.extensions = const {},
  });
  final String message;
  final String code;
  final int status;
  final Map<String, Object?> extensions;
}

Map<String, dynamic> roomJson({
  String id = 'room-row-1',
  String chatRoomId = 'psid-1',
  String platform = 'fb',
  String channelId = 'channel-1',
  String customerId = 'customer-1',
  String? firstName = '小美',
  String? lastName = '王',
  String updatedAt = '2026-11-05T10:00:00.000Z',
}) => {
  'id': id,
  'title': chatRoomId,
  'lastMessage': null,
  'platform': platform,
  'channel_id': channelId,
  'chat_room_id': chatRoomId,
  'updatedAt': updatedAt,
  'users': [
    {
      'id': customerId,
      'name': null,
      'first_name': firstName,
      'last_name': lastName,
      'avatar': null,
    },
    {
      'id': channelId,
      'name': 'MasterBox',
      'first_name': null,
      'last_name': null,
      'avatar': null,
    },
  ],
};

Map<String, dynamic> channelJson({
  String id = 'channel-1',
  String platform = 'fb',
  String name = '官方粉專',
  bool enabled = true,
}) => {
  'channel_id': id,
  'platform': platform,
  'name': name,
  'enabled': enabled,
};

Map<String, dynamic> accountJson({
  String id = 'me',
  String email = 'me@example.com',
  String role = 'admin',
  bool enabled = true,
  String name = '我',
}) => {
  '_id': id,
  'email': email,
  'role': role,
  'company_id': 'company-1',
  'enabled': enabled,
  'info': {'name': name, 'avatar': null, 'mobile': null},
};
