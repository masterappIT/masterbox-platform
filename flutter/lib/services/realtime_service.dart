import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

typedef SocketConnector = WebSocketChannel Function(
  Uri url,
  Iterable<String> protocols,
);

/// Follows the backend's `sendMessage` subscription over graphql-ws, the same
/// feed the admin inbox uses. Polling stays on as the fallback, so a dropped
/// socket only delays updates until the next reconnect.
class RealtimeService {
  RealtimeService({
    required this.url,
    required this.token,
    this.onAuthRejected,
    SocketConnector? connector,
    this.retryDelay = const Duration(seconds: 5),
  }) : _connector =
           connector ??
           ((url, protocols) =>
               WebSocketChannel.connect(url, protocols: protocols));

  static const subscription = r'''subscription MessageEvents {
    sendMessage { _id contents platform to_chat_room_id channel_id sentAt inbound delivery_error }
  }''';

  final Uri url;
  final String? Function() token;
  final Future<void> Function()? onAuthRejected;
  final Duration retryDelay;
  final SocketConnector _connector;

  final _events = StreamController<Map<String, dynamic>>.broadcast();
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _listener;
  Timer? _retry;
  bool _running = false;

  Stream<Map<String, dynamic>> get events => _events.stream;

  void start() {
    if (_running) return;
    _running = true;
    _connect();
  }

  void stop() {
    _running = false;
    _retry?.cancel();
    _retry = null;
    _closeSocket();
  }

  void _closeSocket() {
    _listener?.cancel();
    _listener = null;
    _channel?.sink.close();
    _channel = null;
  }

  void _connect() {
    if (!_running) return;
    try {
      final channel = _connector(url, const ['graphql-transport-ws']);
      _channel = channel;
      _listener = channel.stream.listen(
        _handle,
        onError: (_) => _scheduleReconnect(),
        onDone: _scheduleReconnect,
        cancelOnError: true,
      );
      final current = token();
      _send({
        'type': 'connection_init',
        'payload': {
          if (current?.isNotEmpty == true) 'authorization': 'Bearer $current',
        },
      });
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _send(Map<String, dynamic> message) =>
      _channel?.sink.add(jsonEncode(message));

  void _handle(dynamic raw) {
    final Object? decoded;
    try {
      decoded = jsonDecode('$raw');
    } on FormatException {
      return;
    }
    if (decoded is! Map<String, dynamic>) return;
    switch (decoded['type']) {
      case 'connection_ack':
        _send({
          'id': '1',
          'type': 'subscribe',
          'payload': {'query': subscription},
        });
      case 'ping':
        _send({'type': 'pong'});
      case 'next':
        final payload = decoded['payload'];
        final data = payload is Map ? payload['data'] : null;
        final message = data is Map ? data['sendMessage'] : null;
        if (message is Map<String, dynamic>) _events.add(message);
      case 'error':
        // The subscription is refused when the token has expired.
        _closeSocket();
        final refresh = onAuthRejected?.call() ?? Future<void>.value();
        unawaited(refresh.catchError((_) {}).whenComplete(_scheduleReconnect));
      case 'complete':
        _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    _closeSocket();
    if (!_running || _retry != null) return;
    _retry = Timer(retryDelay, () {
      _retry = null;
      _connect();
    });
  }
}
