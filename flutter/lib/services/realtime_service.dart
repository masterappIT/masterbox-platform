import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

typedef SocketConnector = WebSocketChannel Function(
  Uri url,
  Iterable<String> protocols,
);

const _messageFields =
    '_id contents platform channel_id to_chat_room_id sentAt inbound isMine delivery_error preview cursor disappearing_after_seconds readAt';
const _roomFields =
    'id title platform channel_id channel_name chat_room_id users { id name first_name last_name avatar } customer { id name avatar username phone } tags { id name } lastMessage lastMessageAt lastMessageInbound unreadCount lastCustomerMessageAt replyWindow { state closesAt templateRequired humanAgentAvailable } assignee { id name email role } assignedAt createdAt updatedAt';

/// Follows the backend's live feeds over graphql-ws, the same ones the admin
/// inbox uses: new and changed messages, and conversations that changed (such
/// as their agent). A dropped socket reconnects by itself and says so on
/// [reconnects], so pages can catch up on what was sent meanwhile.
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

  static const subscription =
      '''subscription MessageEvents {
    sendMessage { $_messageFields }
  }''';

  static const roomSubscription =
      '''subscription ChatRoomUpdates {
    chatRoomUpdated { $_roomFields }
  }''';

  final Uri url;
  final String? Function() token;
  final Future<void> Function()? onAuthRejected;
  final Duration retryDelay;
  final SocketConnector _connector;

  final _events = StreamController<Map<String, dynamic>>.broadcast();
  final _roomUpdates = StreamController<Map<String, dynamic>>.broadcast();
  final _reconnects = StreamController<void>.broadcast();
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _listener;
  Timer? _retry;
  bool _running = false;
  bool _connected = false;
  bool _everConnected = false;

  /// Messages as the server sends them.
  Stream<Map<String, dynamic>> get events => _events.stream;

  /// Conversations as the server sends them after a change.
  Stream<Map<String, dynamic>> get roomUpdates => _roomUpdates.stream;

  /// The connection is back after being down; updates may have been missed.
  Stream<void> get reconnects => _reconnects.stream;

  bool get isConnected => _connected;

  void start() {
    if (_running) return;
    _running = true;
    _connect();
  }

  void stop() {
    _running = false;
    _everConnected = false;
    _retry?.cancel();
    _retry = null;
    _closeSocket();
  }

  void _closeSocket() {
    _connected = false;
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
        _send({
          'id': '2',
          'type': 'subscribe',
          'payload': {'query': roomSubscription},
        });
        _connected = true;
        if (_everConnected) _reconnects.add(null);
        _everConnected = true;
      case 'ping':
        _send({'type': 'pong'});
      case 'next':
        final payload = decoded['payload'];
        final data = payload is Map ? payload['data'] : null;
        if (data is! Map) return;
        final message = data['sendMessage'];
        if (message is Map<String, dynamic>) _events.add(message);
        final room = data['chatRoomUpdated'];
        if (room is Map<String, dynamic>) _roomUpdates.add(room);
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
