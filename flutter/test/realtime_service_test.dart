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
      final subscribe = socket.fakeSink.sent.last;
      expect(subscribe['type'], 'subscribe');
      expect(subscribe['payload']['query'], contains('sendMessage'));

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
}
