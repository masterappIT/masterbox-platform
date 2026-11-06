import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masterbox_flutter/pages/channels_page.dart';

import 'support/fake_backend.dart';

Widget _app(Widget page) => MaterialApp(home: page);

void _screen(WidgetTester tester, [Size size = const Size(900, 2400)]) {
  tester.view
    ..physicalSize = size
    ..devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

Map<String, dynamic> _web(
  String state, {
  String channelId = 'wa-web-1',
  String? phone = '+886912345678',
  String? name,
  Map<String, int>? progress,
  String? error,
}) => {
  'channel_id': channelId,
  'state': state,
  'qr': null,
  'phone': phone,
  'name': name,
  'error': error,
  'updated_at': null,
  'progress': progress == null ? null : {'messages': 0, ...progress},
};

Map<String, dynamic> _connection(String state, {String? message}) => {
  'state': state,
  'message': message,
  'checked_at': '2026-11-07T02:00:00.000Z',
};

final _channels = [
  channelJson(id: 'fb-1', name: '官方粉專', connection: _connection('ok')),
  channelJson(
    id: 'ig-1',
    platform: 'ig',
    name: 'IG 帳號',
    connection: _connection('auth_expired', message: '授權已失效，請重新串接'),
  ),
  channelJson(
    id: '1234567890',
    platform: 'whatsapp',
    name: '客服 WhatsApp',
    phone: '+886 2 1234 5678',
    connection: _connection('not_subscribed'),
  ),
  channelJson(id: 'line-1', platform: 'line', name: 'LINE 官方帳號'),
  channelJson(
    id: 'fb-2',
    name: '停用的粉專',
    enabled: false,
    connection: _connection('disabled'),
  ),
  channelJson(
    id: 'wa-web-1',
    platform: 'whatsapp',
    name: '業務手機',
    whatsappWeb: _web(
      'syncing',
      progress: {'chats_total': 10, 'chats_done': 4},
    ),
  ),
  channelJson(
    id: 'wa-web-2',
    platform: 'whatsapp',
    name: '舊手機',
    whatsappWeb: _web('logged_out', channelId: 'wa-web-2'),
  ),
];

FakeBackend _backend({
  List<Map<String, dynamic>>? channels,
  Map<String, Object?> more = const {},
}) => FakeBackend({
  'GetChannelsWithConnection': {
    'getUserSubscribedChannels': channels ?? _channels,
  },
  'CheckChannelConnection': (Map<String, dynamic> variables) => {
    'checkChannelConnection': {
      'channel_id': variables['channelId'],
      'phone': null,
      'connection': _connection('ok'),
    },
  },
  'DeleteChannel': {'deleteChannel': true},
  'CreateMetaConnectUrl': {'createMetaConnectUrl': 'https://meta.test/go'},
  ...more,
});

Finder _card(String name) =>
    find.ancestor(of: find.text(name), matching: find.byType(Card));

Finder _inCard(String name, Finder finder) =>
    find.descendant(of: _card(name), matching: finder);

void main() {
  group('connection status', () {
    testWidgets('shows how every channel is doing, as the admin site does', (
      tester,
    ) async {
      _screen(tester);
      final fake = _backend();
      await tester.pumpWidget(
        _app(ChannelsPage(graphQL: fake.service(role: 'admin'))),
      );
      await tester.pumpAndSettle();

      // The page alone asks for the connection; other pages keep the light list.
      expect(fake.named('GetChannelsWithConnection'), hasLength(1));
      expect(fake.named('GetUserSubscribedChannels'), isEmpty);

      expect(_inCard('官方粉專', find.text('已連線')), findsOneWidget);
      expect(_inCard('官方粉專', find.text('重新串接')), findsNothing);
      expect(_inCard('官方粉專', find.text('重新檢查')), findsOneWidget);

      expect(_inCard('IG 帳號', find.text('授權已失效')), findsOneWidget);
      expect(_inCard('IG 帳號', find.text('授權已失效，請重新串接')), findsOneWidget);
      expect(_inCard('IG 帳號', find.text('重新串接')), findsOneWidget);

      expect(_inCard('客服 WhatsApp', find.text('未收到訊息通知')), findsOneWidget);
      expect(_inCard('客服 WhatsApp', find.text('重新串接')), findsOneWidget);
      // A WhatsApp number shows the number, not its id.
      expect(
        _inCard('客服 WhatsApp', find.text('WhatsApp · +886 2 1234 5678')),
        findsOneWidget,
      );
      expect(find.textContaining('1234567890'), findsNothing);

      expect(_inCard('LINE 官方帳號', find.text('無法檢查')), findsOneWidget);
      expect(_inCard('LINE 官方帳號', find.text('重新檢查')), findsNothing);
      expect(_inCard('停用的粉專', find.text('已停用')), findsOneWidget);

      expect(_inCard('業務手機', find.text('同步聊天記錄中 40%')), findsOneWidget);
      expect(
        _inCard('業務手機', find.text('WhatsApp · +886912345678')),
        findsOneWidget,
      );
      expect(_inCard('舊手機', find.text('已斷線，請重新連結')), findsOneWidget);
      expect(_inCard('舊手機', find.text('重新連結')), findsOneWidget);
    });

    testWidgets('reads the list again while a number syncs', (tester) async {
      _screen(tester);
      final fake = _backend();
      await tester.pumpWidget(
        _app(
          ChannelsPage(
            graphQL: fake.service(role: 'admin'),
            refreshInterval: const Duration(seconds: 8),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(fake.named('GetChannelsWithConnection'), hasLength(1));
      await tester.pump(const Duration(seconds: 8));
      await tester.pumpAndSettle();
      expect(fake.named('GetChannelsWithConnection'), hasLength(2));
    });

    testWidgets('does not keep reading once nothing is changing', (
      tester,
    ) async {
      _screen(tester);
      final fake = _backend(channels: [_channels.first]);
      await tester.pumpWidget(
        _app(ChannelsPage(graphQL: fake.service(role: 'admin'))),
      );
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 30));
      expect(fake.named('GetChannelsWithConnection'), hasLength(1));
    });

    testWidgets('checks a channel again', (tester) async {
      _screen(tester);
      final fake = _backend();
      await tester.pumpWidget(
        _app(ChannelsPage(graphQL: fake.service(role: 'admin'))),
      );
      await tester.pumpAndSettle();
      await tester.tap(_inCard('IG 帳號', find.text('重新檢查')));
      await tester.pumpAndSettle();

      expect(fake.named('CheckChannelConnection').single.variables, {
        'channelId': 'ig-1',
      });
      expect(_inCard('IG 帳號', find.text('已連線')), findsOneWidget);
      expect(_inCard('IG 帳號', find.text('重新串接')), findsNothing);
    });

    testWidgets('connects Meta again from an expired channel', (tester) async {
      _screen(tester);
      Uri? opened;
      await tester.pumpWidget(
        _app(
          ChannelsPage(
            graphQL: _backend().service(role: 'admin'),
            openUrl: (url) async {
              opened = url;
              return true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(_inCard('IG 帳號', find.text('重新串接')));
      await tester.pumpAndSettle();
      expect(opened, Uri.parse('https://meta.test/go'));
    });

    testWidgets('fits a small phone', (tester) async {
      _screen(tester, const Size(320, 640));
      await tester.pumpWidget(
        _app(
          ChannelsPage(
            graphQL: _backend(
              channels: [
                channelJson(
                  id: 'ig-long',
                  platform: 'ig',
                  name: '一個名字非常非常非常非常長的 Instagram 帳號',
                  connection: _connection(
                    'auth_expired',
                    message: '授權已失效，請到 Meta 重新串接，否則不會收到新訊息',
                  ),
                ),
              ],
            ).service(role: 'admin'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('deleting', () {
    Future<FakeBackend> open(WidgetTester tester, String name) async {
      _screen(tester);
      final fake = _backend();
      await tester.pumpWidget(
        _app(ChannelsPage(graphQL: fake.service(role: 'admin'))),
      );
      await tester.pumpAndSettle();
      await tester.tap(_inCard(name, find.byTooltip('更多操作')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('刪除'));
      await tester.pumpAndSettle();
      return fake;
    }

    testWidgets('asks first and removes a Meta channel', (tester) async {
      final fake = await open(tester, 'IG 帳號');
      expect(find.text('確定要刪除「IG 帳號」嗎？'), findsOneWidget);
      expect(
        find.text('刪除後會停止收發這個社群的訊息，並從社群列表和對話列表中移除。之後重新串接同一個帳號，可以找回原本的對話。'),
        findsOneWidget,
      );
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text('刪除'),
        ),
      );
      await tester.pumpAndSettle();

      expect(fake.named('DeleteChannel').single.variables, {
        'channelId': 'ig-1',
      });
      expect(find.text('IG 帳號'), findsNothing);
      expect(find.text('已刪除「IG 帳號」'), findsOneWidget);
    });

    testWidgets('tells what happens to a linked WhatsApp number', (
      tester,
    ) async {
      final fake = await open(tester, '業務手機');
      expect(
        find.text(
          '刪除後會停止收發這個社群的訊息，並從社群列表和對話列表中移除。'
          '這支 WhatsApp 號碼也會從手機的「已連結的裝置」登出。'
          '之後重新掃碼連結同一支號碼，可以找回原本的對話。',
        ),
        findsOneWidget,
      );
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      expect(fake.named('DeleteChannel'), isEmpty);
      expect(find.text('業務手機'), findsOneWidget);
    });

    testWidgets('keeps a channel the backend would not remove', (tester) async {
      _screen(tester);
      final fake = _backend(
        more: {'DeleteChannel': const FakeError('找不到這個頻道', code: 'NOT_FOUND')},
      );
      await tester.pumpWidget(
        _app(ChannelsPage(graphQL: fake.service(role: 'admin'))),
      );
      await tester.pumpAndSettle();
      await tester.longPress(find.text('官方粉專'));
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text('刪除'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('無法刪除「官方粉專」：找不到這個頻道'), findsOneWidget);
      expect(find.text('官方粉專'), findsOneWidget);
    });
  });

  testWidgets('agents see the channels but none of the admin actions', (
    tester,
  ) async {
    _screen(tester);
    await tester.pumpWidget(
      _app(ChannelsPage(graphQL: _backend().service(role: 'agent'))),
    );
    await tester.pumpAndSettle();
    expect(find.text('授權已失效'), findsOneWidget);
    expect(find.text('新增社群'), findsNothing);
    expect(find.byTooltip('更多操作'), findsNothing);
    expect(find.text('重新檢查'), findsNothing);
    expect(find.text('重新串接'), findsNothing);
    expect(find.text('重新連結'), findsNothing);
    expect(tester.widget<Switch>(find.byType(Switch).first).onChanged, isNull);
    await tester.longPress(find.text('官方粉專'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
  });

  group('linking WhatsApp', () {
    const poll = Duration(milliseconds: 2500);

    testWidgets('with a pairing code, then names the channel', (tester) async {
      _screen(tester);
      var linked = false;
      var state = 'qr';
      final fake = FakeBackend({
        'GetChannelsWithConnection': (_) => {
          'getUserSubscribedChannels': [
            _channels.first,
            if (linked)
              channelJson(
                id: 'wa-new',
                platform: 'whatsapp',
                name: '門市手機',
                whatsappWeb: _web('ready', channelId: 'wa-new'),
              ),
          ],
        },
        'ConnectWhatsappWeb': {
          'connectWhatsappWeb': _web(
            'starting',
            channelId: 'wa-new',
            phone: null,
          ),
        },
        'WhatsappWebConnection': (_) => {
          'whatsappWebConnection': _web(
            state,
            channelId: 'wa-new',
            phone: state == 'qr' ? null : '+886912345678',
            name: state == 'qr' ? null : '王小明',
            progress: state == 'qr'
                ? null
                : {'chats_total': 4, 'chats_done': 1},
          ),
        },
        'RequestWhatsappWebPairingCode': {
          'requestWhatsappWebPairingCode': 'ABCD1234',
        },
        'ChatRoomAssignees': {
          'chatRoomAssignees': [
            {'id': 'a1', 'name': '阿美', 'email': 'a@x.test', 'role': 'agent'},
            {'id': 'boss', 'name': '老闆', 'email': 'b@x.test', 'role': 'admin'},
          ],
        },
        'UpdateWhatsappWebChannel': (Map<String, dynamic> variables) {
          linked = true;
          return {
            'updateWhatsappWebChannel': {
              'channel_id': variables['channelId'],
              'name': variables['name'],
            },
          };
        },
      });
      await tester.pumpWidget(
        _app(ChannelsPage(graphQL: fake.service(role: 'admin'))),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('新增社群'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('WhatsApp（掃碼／電話號碼連結）'));
      await tester.pump();
      await tester.pump();
      expect(find.text('正在準備連結…'), findsOneWidget);
      expect(fake.named('ConnectWhatsappWeb').single.variables, {
        'channelId': null,
      });

      // The gateway has a code ready.
      await tester.pump(poll);
      await tester.pumpAndSettle();
      expect(find.text('用電話號碼連結'), findsOneWidget);
      expect(find.text('點「連結裝置」，再點畫面下方的「改用電話號碼連結」'), findsOneWidget);
      expect(find.text('用另一支手機掃描 QR 碼'), findsOneWidget);

      await tester.enterText(
        find.byKey(const Key('pairing-phone')),
        '+886 912-345-678',
      );
      await tester.pump();
      await tester.tap(find.text('取得配對碼'));
      await tester.pumpAndSettle();
      expect(fake.named('RequestWhatsappWebPairingCode').single.variables, {
        'channelId': 'wa-new',
        'phone': '886912345678',
      });
      expect(find.text('ABCD-1234'), findsOneWidget);

      // The code was typed on the phone.
      state = 'syncing';
      await tester.pump(poll);
      await tester.pumpAndSettle();
      expect(find.text('同步中'), findsOneWidget);
      expect(find.text('25%'), findsOneWidget);
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('channel-name')))
            .controller!
            .text,
        '王小明',
      );
      // Admins see every channel already.
      expect(find.text('老闆'), findsNothing);

      await tester.enterText(find.byKey(const Key('channel-name')), '門市手機');
      await tester.tap(find.text('阿美'));
      await tester.pump();
      await tester.tap(find.text('完成'));
      await tester.pumpAndSettle();

      expect(fake.named('UpdateWhatsappWebChannel').single.variables, {
        'channelId': 'wa-new',
        'name': '門市手機',
        'agentIds': ['a1'],
      });
      expect(fake.named('CancelWhatsappWeb'), isEmpty);
      expect(find.text('已連結「門市手機」'), findsOneWidget);
      expect(find.text('門市手機'), findsOneWidget);
    });

    testWidgets('leaving before a phone links removes the attempt', (
      tester,
    ) async {
      _screen(tester);
      final fake = _backend(
        more: {
          'ConnectWhatsappWeb': {
            'connectWhatsappWeb': _web('qr', channelId: 'wa-new', phone: null),
          },
          'WhatsappWebConnection': {
            'whatsappWebConnection': _web(
              'qr',
              channelId: 'wa-new',
              phone: null,
            ),
          },
          'CancelWhatsappWeb': {'cancelWhatsappWeb': true},
        },
      );
      await tester.pumpWidget(
        _app(ChannelsPage(graphQL: fake.service(role: 'admin'))),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('新增社群'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('WhatsApp（掃碼／電話號碼連結）'));
      await tester.pumpAndSettle();
      expect(find.text('取得配對碼'), findsOneWidget);

      await tester.tap(find.byTooltip('取消'));
      await tester.pumpAndSettle();
      expect(fake.named('CancelWhatsappWeb').single.variables, {
        'channelId': 'wa-new',
      });
      expect(find.text('社群平台管理'), findsOneWidget);
    });

    testWidgets('links a logged-out number again from the list', (
      tester,
    ) async {
      _screen(tester);
      final fake = _backend(
        more: {
          'ConnectWhatsappWeb': (Map<String, dynamic> variables) => {
            'connectWhatsappWeb': _web(
              'qr',
              channelId: variables['channelId'] as String,
              phone: '+886912345678',
            ),
          },
          'WhatsappWebConnection': (Map<String, dynamic> variables) => {
            'whatsappWebConnection': _web(
              'ready',
              channelId: variables['channelId'] as String,
            ),
          },
        },
      );
      await tester.pumpWidget(
        _app(ChannelsPage(graphQL: fake.service(role: 'admin'))),
      );
      await tester.pumpAndSettle();
      await tester.tap(_inCard('舊手機', find.text('重新連結')));
      await tester.pumpAndSettle();

      expect(fake.named('ConnectWhatsappWeb').single.variables, {
        'channelId': 'wa-web-2',
      });
      expect(find.text('重新連結「舊手機」'), findsOneWidget);
      expect(find.text('只能連結原本的號碼 +886912345678。'), findsOneWidget);
      // The number is the one it had.
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('pairing-phone')))
            .controller!
            .text,
        '886912345678',
      );

      await tester.pump(poll);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('channel-name')), findsNothing);
      await tester.tap(find.text('完成'));
      await tester.pumpAndSettle();
      expect(find.text('已重新連結'), findsOneWidget);
      expect(fake.named('CancelWhatsappWeb'), isEmpty);
      expect(fake.named('UpdateWhatsappWebChannel'), isEmpty);
    });
  });
}
