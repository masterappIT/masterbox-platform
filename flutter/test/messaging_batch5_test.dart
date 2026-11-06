// The chat catching up with the admin site (attachments, paging, unread counts,
// catching up after a dropped connection, Meta's reply windows, WhatsApp
// templates, quick replies) and push notifications.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masterbox_flutter/main.dart';
import 'package:masterbox_flutter/models/app_models.dart';
import 'package:masterbox_flutter/models/attachment_rules.dart';
import 'package:masterbox_flutter/models/reply_window.dart';
import 'package:masterbox_flutter/pages/conversation_page.dart';
import 'package:masterbox_flutter/pages/whatsapp_template_page.dart';
import 'package:masterbox_flutter/services/graphql_service.dart';
import 'package:masterbox_flutter/services/push_service.dart';
import 'package:masterbox_flutter/widgets/common.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fake_backend.dart';

final _now = DateTime.now().toUtc();
String _ago(Duration duration) => _now.subtract(duration).toIso8601String();

Map<String, dynamic> _room({
  String id = 'room-row-1',
  String chatRoomId = 'psid-1',
  String platform = 'fb',
  String channelId = 'channel-1',
  String firstName = '小美',
  int unread = 0,
  String? lastCustomerMessageAt,
  String? updatedAt,
  Map<String, dynamic>? assignee,
}) => {
  ...roomJson(
    id: id,
    chatRoomId: chatRoomId,
    platform: platform,
    channelId: channelId,
    firstName: firstName,
    lastName: null,
    updatedAt: updatedAt ?? _ago(const Duration(minutes: 5)),
  ),
  'channel_name': platform == 'whatsapp' ? 'WhatsApp 門市' : '官方粉專',
  'unreadCount': unread,
  'lastCustomerMessageAt':
      lastCustomerMessageAt ?? _ago(const Duration(minutes: 5)),
  'assignee': assignee,
};

Map<String, dynamic> _message(
  String id,
  String text, {
  bool inbound = true,
  Duration ago = const Duration(minutes: 10),
  String roomId = 'psid-1',
}) => {
  '_id': id,
  'contents': jsonEncode({
    'message': {'text': text},
  }),
  'to_chat_room_id': roomId,
  'channel_id': 'channel-1',
  'inbound': inbound,
  'cursor': 'cursor-$id',
  'sentAt': _ago(ago),
};

Map<String, Object?> _messagePage(
  List<Map<String, dynamic>> messages, {
  bool hasOlder = false,
  bool hasNewer = false,
}) => {
  'messagePage': {
    'messages': messages,
    'hasOlder': hasOlder,
    'hasNewer': hasNewer,
  },
};

Map<String, Object?> _roomPage(
  List<Map<String, dynamic>> rooms, {
  bool hasMore = false,
  String? next,
}) => {
  'chatRoomPage': {'rooms': rooms, 'nextCursor': next, 'hasMore': hasMore},
};

Map<String, Object?> _backend({
  List<Map<String, dynamic>>? rooms,
  Object? messagePage,
}) {
  final all = rooms ?? [_room()];
  return {
    'GetUserSubscribedChannels': {
      'getUserSubscribedChannels': [channelJson()],
    },
    'ChatRooms': {'chatRooms': all},
    'ChatRoomPage': _roomPage(all),
    'ChatRoom': (Map<String, dynamic> variables) => {
      'chatRoom': all
          .where(
            (room) =>
                room['id'] == variables['id'] ||
                room['chat_room_id'] == variables['chatRoomId'],
          )
          .firstOrNull,
    },
    'MessagePage': messagePage ?? _messagePage([]),
    'MarkChatRoomRead': {
      'markChatRoomRead': {'id': 'room-row-1', 'unreadCount': 0},
    },
    'Users': {
      'listAccounts': {'items': <Object>[]},
    },
    'Ping': {'__typename': 'Query'},
    'PushNotificationsAvailable': {'pushNotificationsAvailable': false},
  };
}

void _signedIn() => SharedPreferences.setMockInitialValues({
  'auth_token': 'access-token',
  'refresh_token': 'refresh-token',
  'account_id': 'me',
  'company_id': 'company-1',
  'account_role': 'admin',
  'account_name': '我',
});

void _bigScreen(WidgetTester tester) {
  tester.view
    ..physicalSize = const Size(900, 2200)
    ..devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

class _App {
  _App(this.backend);
  final FakeBackend backend;
  final sockets = <FakeSocket>[];

  GraphQLService service() => backend.service(
    token: null,
    socketConnector: (_, _) {
      final socket = FakeSocket();
      sockets.add(socket);
      return socket;
    },
  );

  /// The live connection answers, as the server does once signed in.
  Future<void> connect(WidgetTester tester) async {
    sockets.last.receive({'type': 'connection_ack'});
    await tester.pump();
  }
}

Future<_App> _open(
  WidgetTester tester,
  Map<String, Object?> responses, {
  PushClient? push,
  bool openChat = true,
}) async {
  _bigScreen(tester);
  _signedIn();
  final app = _App(FakeBackend(responses));
  await tester.pumpWidget(
    MasterBoxApp(graphQL: app.service(), pushClient: push ?? _NoPush()),
  );
  await tester.pumpAndSettle();
  await app.connect(tester);
  if (openChat) {
    await tester.tap(find.text('Chat'));
    await tester.pumpAndSettle();
  }
  return app;
}

class _NoPush implements PushClient {
  @override
  bool get available => false;
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakePush implements PushClient {
  _FakePush({this.allowed = true, this.launched});
  final bool allowed;
  Map<String, dynamic>? launched;
  final opened = StreamController<Map<String, dynamic>>.broadcast();
  final refreshed = StreamController<String>.broadcast();
  var token = 'fcm-1';
  var deleted = 0;

  @override
  bool get available => true;
  @override
  String get platformName => 'ios';
  @override
  Future<void> initialize() async {}
  @override
  Future<bool> requestPermission() async => allowed;
  @override
  Future<String?> getToken() async => token;
  @override
  Stream<String> get onTokenRefresh => refreshed.stream;
  @override
  Stream<Map<String, dynamic>> get onOpened => opened.stream;
  @override
  Future<Map<String, dynamic>?> launchedFrom() async => launched;
  @override
  Future<void> deleteToken() async => deleted++;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('attachment rules match the backend', () {
    test('Messenger takes a JPEG photo', () {
      final check = checkAttachment(
        'fb',
        mime: 'image/jpeg',
        filename: 'a.jpg',
        size: 1000,
      );
      expect(check.ok, isTrue);
      expect(check.kind, 'image');
    });

    test('a file with no type is read by its extension', () {
      expect(
        resolveFileType('application/octet-stream', 'report.pdf')?.mime,
        'application/pdf',
      );
      expect(resolveFileType(null, 'notes.TXT')?.mime, 'text/plain');
    });

    test("WhatsApp's own limits apply, in the admin site's words", () {
      final big = checkAttachment(
        'whatsapp',
        mime: 'image/png',
        filename: 'big.png',
        size: 6 * 1024 * 1024,
      );
      expect(big.ok, isFalse);
      expect(big.reason, contains('WhatsApp'));
      expect(big.reason, contains('5MB'));
    });

    test('types MasterBox does not keep are refused when picked', () {
      final check = checkAttachment(
        'fb',
        mime: 'application/zip',
        filename: 'a.zip',
      );
      expect(check.ok, isFalse);
      expect(check.reason, contains('只能傳送'));
    });

    test('platforms without replies say so', () {
      expect(checkAttachment('line', mime: 'image/png').reason, '這個平台尚未支援傳送附件');
    });
  });

  group("Meta's reply windows", () {
    test('open for 24 hours after the customer last wrote', () {
      final window = replyWindowOf(
        platform: 'fb',
        lastCustomerMessageAt: _now.subtract(const Duration(hours: 2)),
        now: _now,
      );
      expect(window.state, ReplyState.open);
      expect(
        replyNotice(window, 'fb', now: _now).text,
        contains('可回覆，還剩 22 小時'),
      );
    });

    test('7 days for Messenger once Meta approved the human agent tag', () {
      final window = replyWindowOf(
        platform: 'ig',
        lastCustomerMessageAt: _now.subtract(const Duration(days: 2)),
        humanAgentAvailable: true,
        now: _now,
      );
      expect(window.state, ReplyState.humanAgent);
      expect(window.canSendFreeform, isTrue);
    });

    test('WhatsApp needs a template afterwards', () {
      final window = replyWindowOf(
        platform: 'whatsapp',
        lastCustomerMessageAt: _now.subtract(const Duration(hours: 25)),
        now: _now,
      );
      expect(window.templateRequired, isTrue);
      expect(window.canSendFreeform, isFalse);
      expect(replyNotice(window, 'whatsapp').tone, NoticeTone.blocked);
    });

    test('Messenger past its window warns but still lets the agent try', () {
      final window = replyWindowOf(
        platform: 'fb',
        lastCustomerMessageAt: _now.subtract(const Duration(days: 3)),
        now: _now,
      );
      expect(window.canSendFreeform, isTrue);
      expect(replyNotice(window, 'fb').tone, NoticeTone.warning);
    });

    test('counting down rounds down', () {
      expect(
        formatRemaining(const Duration(hours: 26, minutes: 59)),
        '1 天 2 小時',
      );
      expect(formatRemaining(const Duration(seconds: 20)), '1 分');
    });
  });

  group('the conversation list', () {
    testWidgets('shows unread counts, channel and agent', (tester) async {
      await _open(
        tester,
        _backend(
          rooms: [
            _room(unread: 3, assignee: {'id': 'me', 'name': '我'}),
          ],
        ),
      );
      expect(find.text('3'), findsOneWidget);
      expect(find.text('官方粉專 · 我負責'), findsOneWidget);
    });

    testWidgets('loads the next page at the end of the list', (tester) async {
      final responses = _backend()
        ..['ChatRoomPage'] = (Map<String, dynamic> variables) =>
            variables['after'] == null
            ? _roomPage([_room()], hasMore: true, next: 'page-2')
            : _roomPage([
                _room(
                  id: 'room-row-2',
                  chatRoomId: 'psid-2',
                  firstName: '阿明',
                  updatedAt: _ago(const Duration(days: 3)),
                ),
              ]);
      final app = await _open(tester, responses);
      expect(find.text('小美'), findsOneWidget);
      expect(find.text('阿明'), findsOneWidget);
      expect(
        app.backend.named('ChatRoomPage').last.variables['after'],
        'page-2',
      );
    });

    testWidgets(
      'a customer message moves the conversation up and counts as unread',
      (tester) async {
        final app = await _open(
          tester,
          _backend(
            rooms: [
              _room(id: 'room-row-2', chatRoomId: 'psid-2', firstName: '阿明'),
              _room(updatedAt: _ago(const Duration(days: 1))),
            ],
          ),
        );
        double top(String name) => tester.getTopLeft(find.text(name)).dy;
        expect(top('阿明'), lessThan(top('小美')));

        final message = _message('m9', '還有貨嗎', ago: Duration.zero);
        app.sockets.last.receiveMessage(message);
        // The same message again, as when it changes, isn't counted twice.
        app.sockets.last.receiveMessage(message);
        await tester.pumpAndSettle();
        expect(top('小美'), lessThan(top('阿明')));
        expect(find.text('還有貨嗎'), findsOneWidget);
        expect(find.text('1'), findsOneWidget);
      },
    );

    testWidgets("a new customer's first message brings their conversation in", (
      tester,
    ) async {
      final newcomer = _room(
        id: 'room-row-7',
        chatRoomId: 'psid-7',
        firstName: '新客人',
      );
      final responses = _backend(rooms: [_room()])
        ..['ChatRoom'] = {'chatRoom': newcomer};
      final app = await _open(tester, responses);
      app.sockets.last.receiveMessage(
        _message('m7', '你好', roomId: 'psid-7', ago: Duration.zero),
      );
      await tester.pumpAndSettle();
      expect(find.text('新客人'), findsOneWidget);
      expect(app.backend.named('ChatRoom').single.variables, {
        'chatRoomId': 'psid-7',
        'channelId': 'channel-1',
      });
    });

    testWidgets('filters by unread and by agent on the server', (tester) async {
      final app = await _open(tester, _backend());
      await tester.tap(find.text('只看未讀'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('未指派'));
      await tester.pumpAndSettle();
      expect(app.backend.named('ChatRoomPage').last.variables['filter'], {
        'unread_only': true,
        'assignment': 'unassigned',
      });
    });

    testWidgets('a conversation assigned to someone else leaves "mine"', (
      tester,
    ) async {
      final mine = _room(assignee: {'id': 'me', 'name': '我'});
      final app = await _open(tester, _backend(rooms: [mine]));
      await tester.tap(find.text('我負責的'));
      await tester.pumpAndSettle();
      expect(find.text('小美'), findsOneWidget);
      app.sockets.last.receive({
        'id': '2',
        'type': 'next',
        'payload': {
          'data': {
            'chatRoomUpdated': _room(assignee: {'id': 'other', 'name': '阿華'}),
          },
        },
      });
      await tester.pumpAndSettle();
      expect(find.text('小美'), findsNothing);
    });
  });

  group('a conversation', () {
    Future<_App> openRoom(
      WidgetTester tester,
      Map<String, Object?> responses, {
      String name = '小美',
    }) async {
      final app = await _open(tester, responses);
      await tester.tap(find.text(name));
      await tester.pumpAndSettle();
      return app;
    }

    testWidgets('opening it marks it read for this account', (tester) async {
      var read = false;
      final responses = _backend(
        rooms: [_room(unread: 2)],
        messagePage: _messagePage([_message('m1', '請問有貨嗎')]),
      );
      responses['MarkChatRoomRead'] = (Map<String, dynamic> _) {
        read = true;
        return {
          'markChatRoomRead': {'id': 'room-row-1', 'unreadCount': 0},
        };
      };
      // The list reads the conversation again on coming back.
      responses['ChatRoom'] = (Map<String, dynamic> _) => {
        'chatRoom': _room(unread: read ? 0 : 2),
      };
      final app = await openRoom(tester, responses);
      expect(app.backend.named('MarkChatRoomRead').first.variables, {
        'id': 'room-row-1',
      });
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.byType(UnreadBadge), findsNothing);
    });

    testWidgets('older messages load above without moving what is on screen', (
      tester,
    ) async {
      final app = await openRoom(
        tester,
        _backend(
          messagePage: (Map<String, dynamic> variables) =>
              variables['before'] == null
              ? _messagePage([
                  _message('m2', '第二則'),
                  _message('m3', '第三則', ago: const Duration(minutes: 9)),
                ], hasOlder: true)
              : _messagePage([
                  _message('m1', '第一則', ago: const Duration(hours: 1)),
                ]),
        ),
      );
      final before = tester.getTopLeft(find.text('第三則'));
      await tester.tap(find.text('載入較舊的訊息'));
      await tester.pumpAndSettle();
      expect(
        app.backend.named('MessagePage').last.variables['before'],
        'cursor-m2',
      );
      expect(find.text('第一則'), findsOneWidget);
      expect(tester.getTopLeft(find.text('第三則')), before);
      expect(
        tester.getTopLeft(find.text('第一則')).dy,
        lessThan(tester.getTopLeft(find.text('第二則')).dy),
      );
    });

    testWidgets('after a dropped connection, missed messages come back once', (
      tester,
    ) async {
      final app = await openRoom(
        tester,
        _backend(
          messagePage: (Map<String, dynamic> variables) =>
              switch (variables['after']) {
                null => _messagePage([_message('m1', '第一則')]),
                _ => _messagePage([
                  _message('m2', '斷線前收到', ago: const Duration(minutes: 3)),
                  _message('m3', '斷線時漏掉', ago: const Duration(minutes: 2)),
                ]),
              },
        ),
      );
      app.sockets.last.receiveMessage(
        _message('m2', '斷線前收到', ago: const Duration(minutes: 3)),
      );
      await tester.pumpAndSettle();
      app.sockets.last.drop();
      await tester.pump(const Duration(seconds: 6));
      expect(app.sockets, hasLength(2));
      await app.connect(tester);
      await tester.pumpAndSettle();

      expect(
        app.backend.named('MessagePage').last.variables['after'],
        'cursor-m2',
      );
      expect(find.text('斷線前收到'), findsOneWidget);
      expect(find.text('斷線時漏掉'), findsOneWidget);
      expect(
        tester.getTopLeft(find.text('斷線時漏掉')).dy,
        greaterThan(tester.getTopLeft(find.text('斷線前收到')).dy),
      );
    });

    testWidgets('shows how long is left to reply', (tester) async {
      await openRoom(
        tester,
        _backend(
          rooms: [
            _room(lastCustomerMessageAt: _ago(const Duration(hours: 22))),
          ],
        ),
      );
      expect(find.textContaining('可回覆，還剩 1 小時'), findsOneWidget);
    });

    testWidgets('WhatsApp past 24 hours only takes a template', (tester) async {
      final responses =
          _backend(
              rooms: [
                _room(
                  platform: 'whatsapp',
                  lastCustomerMessageAt: _ago(const Duration(days: 2)),
                ),
              ],
            )
            ..['WhatsappTemplates'] = {
              'whatsappTemplates': [
                {
                  'id': 'tpl-1',
                  'name': 'order_ready',
                  'language': 'zh_TW',
                  'category': 'UTILITY',
                  'body_text': '{{1}} 您好，您的訂單已到貨',
                  'buttons': <Object>[],
                  'variables': [
                    {
                      'key': 'body:1',
                      'component': 'body',
                      'name': '1',
                      'label': '內文 {{1}}',
                      'example': '王先生',
                    },
                  ],
                  'supported': true,
                },
                {
                  'id': 'tpl-2',
                  'name': 'store_map',
                  'language': 'zh_TW',
                  'body_text': '門市位置',
                  'variables': <Object>[],
                  'supported': false,
                  'unsupported_reason': '標題是地點',
                },
              ],
            }
            ..['SendWhatsappTemplate'] = {
              'sendWhatsappTemplate': {
                '_id': 'tpl-sent',
                'contents': jsonEncode({
                  'message': {'text': '小美 您好，您的訂單已到貨'},
                }),
                'inbound': false,
                'cursor': 'cursor-tpl',
                'sentAt': _now.toIso8601String(),
              },
            };
      final app = await openRoom(tester, responses);
      expect(find.text('已超過 24 小時回覆期限，只能用已核准的 WhatsApp 範本發送'), findsOneWidget);
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.enabled, isFalse);

      await tester.tap(find.widgetWithText(TextButton, '使用範本發送'));
      await tester.pumpAndSettle();
      expect(find.byType(WhatsappTemplatePage), findsOneWidget);
      expect(find.textContaining('標題是地點'), findsOneWidget);

      await tester.tap(find.text('order_ready'));
      await tester.pumpAndSettle();
      expect(find.text('還有 1 個欄位要填'), findsOneWidget);
      await tester.enterText(find.byType(TextField), '小美');
      await tester.pumpAndSettle();
      expect(find.text('小美 您好，您的訂單已到貨'), findsOneWidget);
      await tester.tap(find.text('發送範本'));
      await tester.pumpAndSettle();

      expect(app.backend.named('SendWhatsappTemplate').single.variables, {
        'id': 'room-row-1',
        'templateId': 'tpl-1',
        'values': [
          {'key': 'body:1', 'value': '小美'},
        ],
      });
      expect(find.byType(ConversationPage), findsOneWidget);
      expect(find.text('小美 您好，您的訂單已到貨'), findsOneWidget);
    });

    testWidgets('a reply refused for needing a template offers one', (
      tester,
    ) async {
      final responses = _backend(rooms: [_room(platform: 'whatsapp')])
        ..['SendMessage'] = const FakeError(
          '已超過 24 小時回覆期限',
          code: 'SEND_FAILED',
          extensions: {'templateRequired': true},
        )
        ..['WhatsappTemplates'] = {'whatsappTemplates': <Object>[]};
      await openRoom(tester, responses);
      await tester.enterText(find.byType(TextField), '您好');
      await tester.tap(find.byKey(const ValueKey('send-message')));
      await tester.pumpAndSettle();
      expect(find.text('訊息未送出：已超過 24 小時回覆期限'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, '使用範本發送').first);
      await tester.pumpAndSettle();
      expect(find.text('這個 WhatsApp 號碼沒有已核准的範本'), findsOneWidget);
    });

    testWidgets('typing / inserts a quick reply, this platform first', (
      tester,
    ) async {
      final responses = _backend()
        ..['QuickReplies'] = {
          'quickReplies': [
            {
              'id': 't2',
              'name': 'IG 問候',
              'platform': 'ig',
              'contents': jsonEncode({
                'messages': [
                  {'type': 'text', 'text': 'IG 您好'},
                ],
              }),
            },
            {
              'id': 't1',
              'name': '營業時間',
              'platform': 'fb',
              'contents': jsonEncode({
                'messages': [
                  {'type': 'text', 'text': '每天 10:00 到 21:00'},
                ],
              }),
            },
          ],
        };
      await openRoom(tester, responses);
      await tester.enterText(find.byType(TextField), '/');
      await tester.pumpAndSettle();
      expect(find.text('插入快速回覆'), findsWidgets);
      expect(
        tester.getTopLeft(find.text('營業時間')).dy,
        lessThan(tester.getTopLeft(find.text('IG 問候')).dy),
      );
      await tester.tap(find.text('營業時間'));
      await tester.pumpAndSettle();
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.controller!.text, '每天 10:00 到 21:00');
    });

    test(
      'uploads the picked file with its name and platform, then sends it',
      () async {
        final backend = FakeBackend(
          {
            'SendMessage': {
              'appSendMessage': {'_id': 'm1'},
            },
          },
          rest: {
            '/api/uploads': (
              201,
              {
                'url': 'https://api.test/files/x.pdf',
                'filename': '報價單.pdf',
                'mime_type': 'application/pdf',
                'size': 4,
                'kind': 'file',
              },
            ),
          },
        );
        final service = backend.service();
        final progress = <int>[];
        final file = await service.uploadAttachment(
          const PendingAttachment(
            name: '報價單.pdf',
            bytes: [37, 80, 68, 70],
            mime: 'application/pdf',
            kind: 'file',
          ),
          platform: 'whatsapp',
          onProgress: progress.add,
        );
        final request = backend.restRequests.single;
        expect(request.url.queryParameters, {'platform': 'whatsapp'});
        expect(request.headers['X-File-Name'], Uri.encodeComponent('報價單.pdf'));
        expect(request.headers['Authorization'], 'Bearer access-token');
        expect(request.bodyBytes, [37, 80, 68, 70]);
        expect(progress.last, 100);
        expect(file.kind, 'file');
      },
    );

    test("the server's refusal of a file is passed on", () async {
      final backend = FakeBackend(
        {},
        rest: {
          '/api/uploads': (413, {'error': 'WhatsApp 的檔案不能超過 100MB'}),
        },
      );
      await expectLater(
        backend.service().uploadAttachment(
          const PendingAttachment(
            name: 'a.pdf',
            bytes: [1],
            mime: 'application/pdf',
            kind: 'file',
          ),
          platform: 'whatsapp',
        ),
        throwsA(
          isA<GraphQLException>().having(
            (e) => e.message,
            'message',
            'WhatsApp 的檔案不能超過 100MB',
          ),
        ),
      );
    });
  });

  group('push notifications', () {
    Map<String, Object?> withPush(Map<String, Object?> base) => {
      ...base,
      'PushNotificationsAvailable': {'pushNotificationsAvailable': true},
      'RegisterPushDevice': {'registerPushDevice': true},
      'UnregisterPushDevice': {'unregisterPushDevice': true},
    };

    testWidgets('signing in registers this phone', (tester) async {
      final push = _FakePush();
      final app = await _open(
        tester,
        withPush(_backend()),
        push: push,
        openChat: false,
      );
      expect(app.backend.named('RegisterPushDevice').single.variables, {
        'token': 'fcm-1',
        'platform': 'ios',
      });
      push.refreshed.add('fcm-2');
      await tester.pumpAndSettle();
      expect(
        app.backend.named('RegisterPushDevice').last.variables['token'],
        'fcm-2',
      );
    });

    testWidgets('tapping a notification opens its conversation', (
      tester,
    ) async {
      final push = _FakePush();
      await _open(
        tester,
        withPush(
          _backend(
            rooms: [
              _room(),
              _room(id: 'room-row-2', chatRoomId: 'psid-2', firstName: '阿明'),
            ],
          ),
        ),
        push: push,
        openChat: false,
      );
      push.opened.add({'type': 'message', 'roomId': 'room-row-2'});
      await tester.pumpAndSettle();
      expect(find.byType(ConversationPage), findsOneWidget);
      expect(find.widgetWithText(AppBar, '阿明'), findsOneWidget);
    });

    testWidgets(
      'the notification that launched the app opens its conversation',
      (tester) async {
        final push = _FakePush(launched: {'roomId': 'room-row-1'});
        await _open(tester, withPush(_backend()), push: push, openChat: false);
        await tester.pumpAndSettle();
        expect(find.widgetWithText(AppBar, '小美'), findsOneWidget);
      },
    );

    testWidgets('a conversation this account cannot see stays closed', (
      tester,
    ) async {
      final push = _FakePush();
      await _open(tester, withPush(_backend()), push: push, openChat: false);
      push.opened.add({'roomId': 'someone-elses'});
      await tester.pumpAndSettle();
      expect(find.byType(ConversationPage), findsNothing);
      expect(find.text('找不到這個對話，或你已沒有這個頻道的權限'), findsOneWidget);
    });

    testWidgets('signing out stops this phone getting notifications', (
      tester,
    ) async {
      final push = _FakePush();
      final app = await _open(
        tester,
        withPush(_backend()),
        push: push,
        openChat: false,
      );
      await tester.tap(find.text('Setting'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('登出'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, '登出'));
      // The server is told before the session ends, which takes a few turns.
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await tester.pumpAndSettle();
      expect(app.backend.named('UnregisterPushDevice').single.variables, {
        'token': 'fcm-1',
      });
      expect(push.deleted, 1);
      expect(find.text('登入 MasterBox'), findsOneWidget);
    });

    testWidgets('the settings switch turns them off and on', (tester) async {
      final push = _FakePush();
      final app = await _open(
        tester,
        withPush(_backend()),
        push: push,
        openChat: false,
      );
      await tester.tap(find.text('Setting'));
      await tester.pumpAndSettle();
      expect(find.text('客戶傳訊息時，手機會收到推播通知'), findsOneWidget);
      await tester.tap(find.text('手機推播通知'));
      await tester.pumpAndSettle();
      expect(app.backend.named('UnregisterPushDevice'), hasLength(1));
      expect(find.textContaining('已關閉'), findsOneWidget);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool(pushPreferenceKey), isFalse);
    });

    testWidgets('says why when the phone does not allow notifications', (
      tester,
    ) async {
      final push = _FakePush(allowed: false);
      final app = await _open(
        tester,
        withPush(_backend()),
        push: push,
        openChat: false,
      );
      await tester.tap(find.text('Setting'));
      await tester.pumpAndSettle();
      expect(find.text('手機不允許 MasterBox 通知，請到系統設定開啟通知'), findsOneWidget);
      expect(app.backend.named('RegisterPushDevice'), isEmpty);
    });

    testWidgets('says why when the server has no push set up', (tester) async {
      final push = _FakePush();
      final app = await _open(tester, _backend(), push: push, openChat: false);
      await tester.tap(find.text('Setting'));
      await tester.pumpAndSettle();
      expect(find.text('伺服器尚未設定推播，App 開啟時仍會提示新訊息'), findsOneWidget);
      expect(app.backend.named('RegisterPushDevice'), isEmpty);
    });

    testWidgets('a build without Firebase settings says so', (tester) async {
      await _open(tester, _backend(), openChat: false);
      await tester.tap(find.text('Setting'));
      await tester.pumpAndSettle();
      expect(find.textContaining('推播'), findsWidgets);
    });
  });
}
