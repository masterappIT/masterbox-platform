import 'package:flutter_test/flutter_test.dart';
import 'package:masterbox_flutter/services/realtime_service.dart';

import 'support/fake_backend.dart';

void main() {
  late List<FakeSocket> sockets;
  late List<Iterable<String>> protocols;
  var token = 'token-1';
  var refreshes = 0;

  RealtimeService service() => RealtimeService(
    url: Uri.parse('wss://api.test/graphql'),
    token: () => token,
    retryDelay: const Duration(milliseconds: 1),
    onAuthRejected: () async {
      refreshes++;
      token = 'token-2';
    },
    connector: (url, requested) {
      protocols.add(requested);
      final socket = FakeSocket();
      sockets.add(socket);
      return socket;
    },
  );

  setUp(() {
    sockets = [];
    protocols = [];
    token = 'token-1';
    refreshes = 0;
  });

  Future<void> settle() =>
      Future<void>.delayed(const Duration(milliseconds: 10));

  test(
    'authenticates, subscribes after the ack, and passes messages on',
    () async {
      final realtime = service();
      final received = <Map<String, dynamic>>[];
      realtime.events.listen(received.add);
      realtime.start();

      expect(protocols.single, ['graphql-transport-ws']);
      final socket = sockets.single;
      expect(socket.fakeSink.sent.single, {
        'type': 'connection_init',
        'payload': {'authorization': 'Bearer token-1'},
      });

      socket.receive({'type': 'connection_ack'});
      await settle();
      final subscriptions = socket.fakeSink.sent
          .where((message) => message['type'] == 'subscribe')
          .map((message) => message['payload']['query'] as String)
          .toList();
      expect(subscriptions, hasLength(2));
      expect(subscriptions[0], contains('sendMessage'));
      expect(subscriptions[1], contains('chatRoomUpdated'));

      socket.receive({
        'id': '1',
        'type': 'next',
        'payload': {
          'data': {
            'sendMessage': {'_id': 'm1', 'to_chat_room_id': 'room'},
          },
        },
      });
      await settle();
      expect(received.single['_id'], 'm1');
      realtime.stop();
    },
  );

  test('answers pings', () async {
    final realtime = service()..start();
    sockets.single.receive({'type': 'ping'});
    await settle();
    expect(sockets.single.fakeSink.sent.last, {'type': 'pong'});
    realtime.stop();
  });

  test('reconnects when the socket closes', () async {
    final realtime = service()..start();
    await sockets.single.incoming.close();
    await settle();
    expect(sockets, hasLength(2));
    realtime.stop();
  });

  test('refreshes the token when the subscription is refused', () async {
    final realtime = service()..start();
    sockets.single.receive({'id': '1', 'type': 'error', 'payload': []});
    await settle();
    expect(refreshes, 1);
    expect(sockets, hasLength(2));
    expect(sockets.last.fakeSink.sent.first['payload'], {
      'authorization': 'Bearer token-2',
    });
    realtime.stop();
  });

  test('stops for good when stopped', () async {
    final realtime = service()..start();
    final socket = sockets.single;
    realtime.stop();
    expect(socket.fakeSink.closed, isTrue);
    await settle();
    expect(sockets, hasLength(1));
  });

  test('passes on changed conversations', () async {
    final realtime = service();
    final rooms = <Map<String, dynamic>>[];
    realtime.roomUpdates.listen(rooms.add);
    realtime.start();
    sockets.single
      ..receive({'type': 'connection_ack'})
      ..receive({
        'id': '2',
        'type': 'next',
        'payload': {
          'data': {
            'chatRoomUpdated': {'id': 'room-1'},
          },
        },
      });
    await settle();
    expect(rooms.single['id'], 'room-1');
    realtime.stop();
  });

  test(
    'says when it is back after dropping, so missed messages are fetched',
    () async {
      final realtime = service();
      var reconnects = 0;
      realtime.reconnects.listen((_) => reconnects++);
      realtime.start();
      sockets.single.receive({'type': 'connection_ack'});
      await settle();
      expect(realtime.isConnected, isTrue);
      expect(reconnects, 0, reason: 'the first connection is not a reconnect');

      sockets.single.drop();
      await settle();
      expect(realtime.isConnected, isFalse);
      sockets.last.receive({'type': 'connection_ack'});
      await settle();
      expect(sockets, hasLength(2));
      expect(reconnects, 1);
      realtime.stop();
    },
  );
}
