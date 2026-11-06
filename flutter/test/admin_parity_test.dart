import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masterbox_flutter/main.dart';
import 'package:masterbox_flutter/models/app_models.dart';
import 'package:masterbox_flutter/pages/channels_page.dart';
import 'package:masterbox_flutter/pages/company_page.dart';
import 'package:masterbox_flutter/pages/overview_page.dart';
import 'package:masterbox_flutter/pages/templates_page.dart';
import 'package:masterbox_flutter/pages/users_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fake_backend.dart';

Widget _app(Widget page) => MaterialApp(home: page);

Map<String, Object?> _inbox({List<Map<String, dynamic>>? messages}) => {
  'GetUserSubscribedChannels': {
    'getUserSubscribedChannels': [
      channelJson(),
      channelJson(id: 'channel-2', platform: 'ig', name: 'IG 帳號'),
    ],
  },
  'ChatRooms': {
    'chatRooms': [
      roomJson(),
      roomJson(
        id: 'room-row-2',
        chatRoomId: 'psid-2',
        platform: 'ig',
        channelId: 'channel-2',
        customerId: 'customer-2',
        firstName: '阿明',
        lastName: null,
      ),
      // Another team's channel: this account can't use it.
      roomJson(
        id: 'room-row-3',
        chatRoomId: 'psid-3',
        channelId: 'not-mine',
        customerId: 'customer-3',
        firstName: '別人的客戶',
        lastName: null,
      ),
    ],
  },
  'Messages': {'messages': messages ?? const []},
  'Users': {
    'listAccounts': {
      'items': [
        accountJson(id: 'member-1', email: 'a@example.com', name: '小組員'),
      ],
    },
  },
  'SendMessage': {
    'appSendMessage': {'_id': 'm-new'},
  },
  'Ping': {'__typename': 'Query'},
};

Future<void> _signIn(WidgetTester tester, {required String role}) async {
  SharedPreferences.setMockInitialValues({
    'auth_token': 'access-token',
    'refresh_token': 'refresh-token',
    'account_id': 'me',
    'company_id': 'company-1',
    'account_email': 'me@example.com',
    'account_role': role,
    'account_name': '我',
  });
}

void _useScreen(WidgetTester tester, Size size) {
  tester.view
    ..physicalSize = size
    ..devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

/// Everything fits on screen, so lists build all their rows.
void _screenTest(String description, WidgetTesterCallback body) {
  testWidgets(description, (tester) async {
    _useScreen(tester, const Size(900, 2200));
    await body(tester);
  });
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('on a small phone nothing overflows', () {
    const phone = Size(320, 640);

    testWidgets('the main tabs', (tester) async {
      _useScreen(tester, phone);
      await _signIn(tester, role: 'admin');
      final backend = FakeBackend({
        ..._inbox(),
        'ListAccounts': {
          'listAccounts': {
            'items': [accountJson()],
            'total': 1,
          },
        },
      });
      await tester.pumpWidget(
        MasterBoxApp(graphQL: backend.service(token: null)),
      );
      await tester.pumpAndSettle();
      for (final tab in const ['Chat', 'Manage', 'Setting', 'Client']) {
        await tester.tap(find.text(tab).last);
        await tester.pumpAndSettle();
      }
      expect(tester.takeException(), isNull);
    });

    testWidgets('the overview', (tester) async {
      _useScreen(tester, phone);
      await tester.pumpWidget(
        _app(
          OverviewPage(
            graphQL: FakeBackend(_inbox()).service(),
            onOpenConversation: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('the customer sheet', (tester) async {
      _useScreen(tester, phone);
      await _signIn(tester, role: 'admin');
      await tester.pumpWidget(
        MasterBoxApp(graphQL: FakeBackend(_inbox()).service(token: null)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chat'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('小美王'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('客戶資訊'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Facebook'), findsOneWidget);
    });

    testWidgets('the registration form', (tester) async {
      _useScreen(tester, phone);
      await tester.pumpWidget(
        MasterBoxApp(graphQL: FakeBackend(const {}).service(token: null)),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('免費試用註冊'));
      await tester.tap(find.text('免費試用註冊'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('the signed-in app', () {
    _screenTest('admins get the management tab and real customers', (
      tester,
    ) async {
      await _signIn(tester, role: 'admin');
      final backend = FakeBackend(_inbox());
      await tester.pumpWidget(
        MasterBoxApp(graphQL: backend.service(token: null)),
      );
      await tester.pumpAndSettle();

      expect(find.text('Manage'), findsOneWidget);
      expect(find.text('全部頻道'), findsOneWidget);
      expect(find.text('小美王'), findsOneWidget);
      expect(find.text('阿明'), findsOneWidget);
      expect(find.text('別人的客戶'), findsNothing);
      expect(find.text('小組員'), findsOneWidget);

      await tester.tap(find.text('Manage'));
      await tester.pumpAndSettle();
      for (final item in const [
        '首頁總覽',
        '客戶管理',
        '社群平台管理',
        '訊息範本',
        '使用者管理',
        '公司資料',
        '群發工具',
        '對話BOT',
      ]) {
        expect(find.text(item), findsOneWidget, reason: item);
      }
    });

    _screenTest('non-admins get neither the tab nor the team list', (
      tester,
    ) async {
      await _signIn(tester, role: 'user');
      final backend = FakeBackend(_inbox());
      await tester.pumpWidget(
        MasterBoxApp(graphQL: backend.service(token: null)),
      );
      await tester.pumpAndSettle();

      expect(find.text('Manage'), findsNothing);
      expect(find.text('Setting'), findsOneWidget);
      expect(find.text('小美王'), findsOneWidget);
      expect(backend.named('Users'), isEmpty);
      expect(find.text('只有管理者可以查看成員列表'), findsOneWidget);

      await tester.tap(find.text('Setting'));
      await tester.pumpAndSettle();
      expect(find.text('我 · me@example.com · 使用者'), findsOneWidget);
      expect(find.text('已連線'), findsOneWidget);
    });

    _screenTest('the channel switcher narrows the customers', (tester) async {
      await _signIn(tester, role: 'admin');
      final backend = FakeBackend(_inbox());
      await tester.pumpWidget(
        MasterBoxApp(graphQL: backend.service(token: null)),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.tune));
      await tester.pumpAndSettle();
      expect(find.text('LINE'), findsOneWidget);
      await tester.tap(find.text('IG 帳號'));
      await tester.pumpAndSettle();

      expect(find.text('阿明'), findsOneWidget);
      expect(find.text('小美王'), findsNothing);
    });

    _screenTest('customer search matches names and account ids', (
      tester,
    ) async {
      await _signIn(tester, role: 'admin');
      final backend = FakeBackend(_inbox());
      await tester.pumpWidget(
        MasterBoxApp(graphQL: backend.service(token: null)),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'customer-2');
      await tester.pumpAndSettle();
      expect(find.text('阿明'), findsOneWidget);
      expect(find.text('小美王'), findsNothing);
      await tester.enterText(find.byType(TextField), 'nobody');
      await tester.pumpAndSettle();
      expect(find.text('找不到符合條件的客戶'), findsOneWidget);
    });

    _screenTest('the inbox filters by channel and shows no demo room', (
      tester,
    ) async {
      await _signIn(tester, role: 'admin');
      final backend = FakeBackend(_inbox());
      await tester.pumpWidget(
        MasterBoxApp(graphQL: backend.service(token: null)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chat'));
      await tester.pumpAndSettle();

      expect(find.text('小美王'), findsOneWidget);
      expect(find.text('阿明'), findsOneWidget);
      expect(find.text('別人的客戶'), findsNothing);
      expect(find.text('示範聊天室'), findsNothing);

      await tester.tap(find.widgetWithText(ChoiceChip, '官方粉專'));
      await tester.pumpAndSettle();
      expect(find.text('小美王'), findsOneWidget);
      expect(find.text('阿明'), findsNothing);
    });

    _screenTest('an inbox without channels points admins at the channels', (
      tester,
    ) async {
      await _signIn(tester, role: 'admin');
      final backend = FakeBackend({
        ..._inbox(),
        'GetUserSubscribedChannels': {'getUserSubscribedChannels': <Object>[]},
        'ChatRooms': {'chatRooms': <Object>[]},
      });
      await tester.pumpWidget(
        MasterBoxApp(graphQL: backend.service(token: null)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chat'));
      await tester.pumpAndSettle();

      expect(find.text('還沒有可用的社群平台'), findsOneWidget);
      await tester.tap(find.text('前往社群平台管理'));
      await tester.pumpAndSettle();
      expect(find.byType(ChannelsPage), findsOneWidget);
    });

    _screenTest('signs out when the session cannot be refreshed', (
      tester,
    ) async {
      await _signIn(tester, role: 'admin');
      final backend = FakeBackend({
        'GetUserSubscribedChannels': const FakeError(
          'expired',
          code: 'UNAUTHENTICATED',
        ),
        'ChatRooms': const FakeError('expired', code: 'UNAUTHENTICATED'),
        'Users': const FakeError('expired', code: 'UNAUTHENTICATED'),
        'RefreshToken': const FakeError('expired', code: 'UNAUTHENTICATED'),
      });
      await tester.pumpWidget(
        MasterBoxApp(graphQL: backend.service(token: null)),
      );
      await tester.pumpAndSettle();
      expect(find.text('登入 MasterBox'), findsOneWidget);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('auth_token'), isNull);
      expect(prefs.getString('account_role'), isNull);
    });
  });

  group('signing in', () {
    _screenTest('login keeps the account', (tester) async {
      final backend = FakeBackend({
        ..._inbox(),
        'Login': {
          'loginAccount': {
            ...accountJson(role: 'user'),
            'token': 't',
            'refreshToken': 'r',
          },
        },
      });
      await tester.pumpWidget(
        MasterBoxApp(graphQL: backend.service(token: null)),
      );
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).at(0), 'me@example.com');
      await tester.enterText(find.byType(TextField).at(1), 'pw');
      await tester.pump();
      await tester.tap(find.text('登入').last);
      await tester.pumpAndSettle();

      expect(find.text('Manage'), findsNothing);
      expect(find.text('Chat'), findsOneWidget);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('auth_token'), 't');
      expect(prefs.getString('account_role'), 'user');
    });

    _screenTest('forgot password says how to get it reset', (tester) async {
      await tester.pumpWidget(
        MasterBoxApp(graphQL: FakeBackend({}).service(token: null)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('忘記密碼？'));
      await tester.pumpAndSettle();
      expect(find.text('重設密碼'), findsOneWidget);
      expect(find.text('目前無法自行重設密碼，請聯絡公司管理員協助重設。'), findsOneWidget);
      await tester.tap(find.text('返回登入'));
      await tester.pumpAndSettle();
      expect(find.text('登入 MasterBox'), findsOneWidget);
    });

    _screenTest('registers a company after checking the form', (tester) async {
      final backend = FakeBackend({
        ..._inbox(),
        'RegisterCompanyAccount': {
          'registerCompanyAccount': {
            ...accountJson(),
            'token': 't',
            'refreshToken': 'r',
          },
        },
      });
      await tester.pumpWidget(
        MasterBoxApp(graphQL: backend.service(token: null)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('免費試用註冊'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('立即註冊'));
      await tester.pumpAndSettle();
      expect(find.text('請輸入中文名稱'), findsOneWidget);
      expect(find.text('請選擇所在地區'), findsOneWidget);
      expect(backend.named('RegisterCompanyAccount'), isEmpty);

      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), '測試公司');
      await tester.enterText(fields.at(1), 'Test Co');
      await tester.enterText(fields.at(2), 'new@example.com');
      await tester.enterText(fields.at(3), 'secret1');
      await tester.enterText(fields.at(4), '0912345678');
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Taiwan').last);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('立即註冊'));
      await tester.tap(find.text('立即註冊'));
      await tester.pumpAndSettle();

      expect(backend.named('RegisterCompanyAccount'), hasLength(1));
      expect(find.text('Manage'), findsOneWidget);
    });
  });

  group('a conversation', () {
    const room = '小美王';

    Future<FakeBackend> open(
      WidgetTester tester, {
      List<Map<String, dynamic>>? messages,
      Map<String, Object?> overrides = const {},
    }) async {
      await _signIn(tester, role: 'admin');
      final backend = FakeBackend({
        ..._inbox(messages: messages),
        ...overrides,
      });
      await tester.pumpWidget(
        MasterBoxApp(graphQL: backend.service(token: null)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chat'));
      await tester.pumpAndSettle();
      await tester.tap(find.text(room));
      await tester.pumpAndSettle();
      return backend;
    }

    _screenTest('reads the room it is stored under and tells sides apart', (
      tester,
    ) async {
      final backend = await open(
        tester,
        messages: [
          {
            '_id': 'm1',
            'contents': '{"message":{"text":"請問有貨嗎"}}',
            'inbound': true,
            'sentAt': '2026-11-05T10:00:00.000Z',
          },
          {
            '_id': 'm2',
            'contents': '{"message":{"text":"有的"}}',
            'inbound': false,
            'sentAt': '2026-11-05T10:01:00.000Z',
            'delivery_error': '已超過 24 小時回覆期限',
          },
        ],
      );
      expect(backend.named('Messages').first.variables, {'roomId': 'psid-1'});
      expect(find.text('請問有貨嗎'), findsOneWidget);
      expect(find.text('有的'), findsOneWidget);
      expect(find.text('未送達：已超過 24 小時回覆期限'), findsOneWidget);
      expect(
        tester
            .widget<Align>(
              find
                  .ancestor(
                    of: find.text('請問有貨嗎'),
                    matching: find.byType(Align),
                  )
                  .first,
            )
            .alignment,
        Alignment.centerLeft,
      );
      expect(
        tester
            .widget<Align>(
              find
                  .ancestor(of: find.text('有的'), matching: find.byType(Align))
                  .first,
            )
            .alignment,
        Alignment.centerRight,
      );
    });

    _screenTest('a sent reply shows once, from the server', (tester) async {
      var sent = false;
      final backend = await open(
        tester,
        overrides: {
          'SendMessage': (Map<String, dynamic> _) {
            sent = true;
            return {
              'appSendMessage': {'_id': 'm-new'},
            };
          },
          'Messages': (Map<String, dynamic> _) => {
            'messages': sent
                ? [
                    {
                      '_id': 'm-new',
                      'contents': '{"message":{"text":"您好"}}',
                      'inbound': false,
                      'sentAt': '2026-11-05T10:02:00.000Z',
                    },
                  ]
                : <Object>[],
          },
        },
      );
      await tester.enterText(find.byType(TextField), '您好');
      await tester.tap(find.byKey(const ValueKey('send-message')));
      await tester.pumpAndSettle();

      expect(backend.named('SendMessage'), hasLength(1));
      expect(find.text('您好'), findsOneWidget);
    });

    _screenTest('pressing enter sends', (tester) async {
      final backend = await open(tester);
      await tester.enterText(find.byType(TextField), '您好');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await tester.pumpAndSettle();
      expect(backend.named('SendMessage'), hasLength(1));
    });

    _screenTest('a refused reply says why and can be retried', (tester) async {
      var attempts = 0;
      final backend = await open(
        tester,
        overrides: {
          'SendMessage': (Map<String, dynamic> _) => attempts++ == 0
              ? const FakeError('頻道授權已失效', code: 'SEND_FAILED')
              : {
                  'appSendMessage': {'_id': 'm-new'},
                },
        },
      );
      await tester.enterText(find.byType(TextField), '您好');
      await tester.tap(find.byKey(const ValueKey('send-message')));
      await tester.pumpAndSettle();
      expect(find.text('訊息未送出：頻道授權已失效'), findsOneWidget);

      await tester.tap(find.text('重試'));
      await tester.pumpAndSettle();
      expect(find.text('訊息未送出：頻道授權已失效'), findsNothing);
      expect(backend.named('SendMessage'), hasLength(2));
    });

    _screenTest('shows the customer from the room', (tester) async {
      await open(tester);
      await tester.tap(find.byTooltip('客戶資訊'));
      await tester.pumpAndSettle();
      expect(find.text('customer-1'), findsOneWidget);
      expect(find.text('Facebook'), findsOneWidget);
    });
  });

  group('fixed existing features', () {
    Future<FakeBackend> openRoom(
      WidgetTester tester, {
      Map<String, Object?> overrides = const {},
      Map<String, (int, Object?)> rest = const {},
    }) async {
      await _signIn(tester, role: 'admin');
      final backend = FakeBackend({..._inbox(), ...overrides}, rest: rest);
      await tester.pumpWidget(
        MasterBoxApp(graphQL: backend.service(token: null)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chat'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('小美王'));
      await tester.pumpAndSettle();
      return backend;
    }

    _screenTest('calling a social customer warns first', (tester) async {
      final backend = await openRoom(tester);
      await tester.tap(find.byTooltip('語音通話'));
      await tester.pumpAndSettle();
      expect(find.text('這是 MasterBox 內部通話'), findsOneWidget);
      expect(find.text('客戶無法從 Facebook 加入，也不會收到來電。'), findsOneWidget);
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      expect(backend.restCalls, isEmpty);
    });

    _screenTest('a call that cannot connect is closed on the server', (
      tester,
    ) async {
      final backend = await openRoom(
        tester,
        rest: {
          '/calls': (201, {'id': 'call-1', 'kind': 'voice'}),
          '/livekit-token': (503, {'error': 'LiveKit is not configured'}),
          '/events': (201, {'id': 'e1'}),
        },
      );
      await tester.tap(find.byTooltip('語音通話'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('繼續'));
      await tester.pumpAndSettle();
      expect(find.text('通話服務尚未設定，暫時無法通話'), findsOneWidget);
      expect(
        backend.restCalls.last,
        allOf(contains('/calls/call-1/events'), contains('call.ended')),
      );
    });

    _screenTest('room settings are honest and stay on this device', (
      tester,
    ) async {
      await openRoom(tester);
      await tester.tap(find.byTooltip('聊天室設定'));
      await tester.pumpAndSettle();
      expect(find.textContaining('端對端加密需要雙方都支援'), findsOneWidget);
      expect(find.textContaining('傳給客戶的訊息會留在 Facebook'), findsOneWidget);

      await tester.tap(find.byType(DropdownButtonFormField<int>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('5 分鐘後刪除').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('儲存設定'));
      await tester.pumpAndSettle();

      expect(find.text('消失訊息：5 分鐘'), findsOneWidget);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getInt('room_disappearing_psid-1'), 300);
    });

    _screenTest('showing a disappearing message starts its countdown once', (
      tester,
    ) async {
      final backend = await openRoom(
        tester,
        overrides: {
          'Messages': {
            'messages': [
              {
                '_id': 'gone-soon',
                'contents': '紀錄',
                'inbound': false,
                'sentAt': '2026-11-05T10:00:00.000Z',
                'disappearing_after_seconds': 30,
                'readAt': null,
              },
              {
                '_id': 'normal',
                'contents': '一般',
                'inbound': true,
                'sentAt': '2026-11-05T10:00:00.000Z',
              },
            ],
          },
          'MarkMessageRead': {
            'markMessageRead': {'_id': 'gone-soon'},
          },
        },
      );
      expect(backend.named('MarkMessageRead').single.variables, {
        'messageId': 'gone-soon',
      });
    });

    _screenTest('the search icon goes to the search box', (tester) async {
      await _signIn(tester, role: 'admin');
      await tester.pumpWidget(
        MasterBoxApp(graphQL: FakeBackend(_inbox()).service(token: null)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chat'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '小美');
      await tester.pumpAndSettle();
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('搜尋聊天室'));
      await tester.pumpAndSettle();
      expect(find.text('小美'), findsOneWidget, reason: 'keeps what was typed');
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.focusNode?.hasFocus, isTrue);
    });

    _screenTest('team members show their email, not an internal id', (
      tester,
    ) async {
      await _signIn(tester, role: 'admin');
      await tester.pumpWidget(
        MasterBoxApp(graphQL: FakeBackend(_inbox()).service(token: null)),
      );
      await tester.pumpAndSettle();
      expect(find.text('a@example.com'), findsOneWidget);
      expect(find.text('member-1'), findsNothing);
    });

    group('settings', () {
      Future<void> openSettings(
        WidgetTester tester, {
        Map<String, Object> prefs = const {},
      }) async {
        SharedPreferences.setMockInitialValues({
          'auth_token': 'access-token',
          'account_id': 'me',
          'company_id': 'company-1',
          'account_role': 'user',
          ...prefs,
        });
        await tester.pumpWidget(
          MasterBoxApp(graphQL: FakeBackend(_inbox()).service(token: null)),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('Setting'));
        await tester.pumpAndSettle();
      }

      bool darkSwitch(WidgetTester tester) => tester
          .widget<SwitchListTile>(find.widgetWithText(SwitchListTile, '深色模式'))
          .value;

      _screenTest('the dark mode switch matches the theme on a dark system', (
        tester,
      ) async {
        tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
        addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
        await openSettings(tester);
        expect(darkSwitch(tester), isFalse);
        expect(
          Theme.of(tester.element(find.text('深色模式'))).brightness,
          Brightness.light,
        );
      });

      _screenTest('a saved dark mode still applies', (tester) async {
        await openSettings(tester, prefs: {'dark_mode': true});
        expect(darkSwitch(tester), isTrue);
        expect(
          Theme.of(tester.element(find.text('深色模式'))).brightness,
          Brightness.dark,
        );
      });

      _screenTest('logging out asks first', (tester) async {
        await openSettings(tester);
        await tester.tap(find.widgetWithText(ListTile, '登出'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('取消'));
        await tester.pumpAndSettle();
        expect(find.text('登入 MasterBox'), findsNothing);

        await tester.tap(find.widgetWithText(ListTile, '登出'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('登出').last);
        await tester.pumpAndSettle();
        expect(find.text('登入 MasterBox'), findsOneWidget);
      });

      _screenTest('Live Activity says where it works', (tester) async {
        await openSettings(tester);
        expect(find.text('只有 iPhone 支援 Live Activity'), findsOneWidget);
        expect(
          tester
              .widget<ListTile>(
                find.widgetWithText(ListTile, '啟動 Live Activity'),
              )
              .enabled,
          isFalse,
        );
      });

      _screenTest('English is shown as not available yet', (tester) async {
        await openSettings(tester, prefs: {'language': 'English'});
        expect(find.text('繁體中文'), findsWidgets);
        expect(find.text('English'), findsNothing);
      });
    });

    group('new message prompts', () {
      late List<FakeSocket> sockets;

      Future<FakeBackend> openApp(
        WidgetTester tester, {
        bool notifications = true,
      }) async {
        SharedPreferences.setMockInitialValues({
          'auth_token': 'access-token',
          'account_id': 'me',
          'company_id': 'company-1',
          'account_role': 'admin',
          'notifications': notifications,
        });
        sockets = [];
        final backend = FakeBackend(_inbox());
        await tester.pumpWidget(
          MasterBoxApp(
            graphQL: backend.service(
              token: null,
              socketConnector: (_, _) {
                final socket = FakeSocket();
                sockets.add(socket);
                return socket;
              },
            ),
          ),
        );
        await tester.pumpAndSettle();
        return backend;
      }

      Map<String, dynamic> event({String id = 'm1', bool inbound = true}) => {
        '_id': id,
        'contents': '請問有貨嗎',
        'to_chat_room_id': 'psid-1',
        'inbound': inbound,
        'sentAt': '2026-11-05T10:00:00.000Z',
      };

      _screenTest('announce a customer message once, and open it', (
        tester,
      ) async {
        await openApp(tester);
        sockets.single.receiveMessage(event());
        sockets.single.receiveMessage(event());
        await tester.pumpAndSettle();
        expect(find.text('新訊息：請問有貨嗎'), findsOneWidget);

        await tester.tap(find.text('查看'));
        await tester.pumpAndSettle();
        expect(find.byType(ConversationPage), findsOneWidget);
      });

      _screenTest('skip the team\'s own messages', (tester) async {
        await openApp(tester);
        sockets.single.receiveMessage(event(inbound: false));
        await tester.pumpAndSettle();
        expect(find.textContaining('新訊息：'), findsNothing);
      });

      _screenTest('respect the settings switch', (tester) async {
        await openApp(tester, notifications: false);
        sockets.single.receiveMessage(event());
        await tester.pumpAndSettle();
        expect(find.textContaining('新訊息：'), findsNothing);
      });

      _screenTest('skip the conversation already on screen', (tester) async {
        await openApp(tester);
        await tester.tap(find.text('Chat'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('小美王'));
        await tester.pumpAndSettle();
        sockets.single.receiveMessage(event());
        await tester.pumpAndSettle();
        expect(find.textContaining('新訊息：'), findsNothing);
      });
    });
  });

  group('channel management', () {
    FakeBackend backend() => FakeBackend({
      ..._inbox(),
      'SetChannelEnabled': (Map<String, dynamic> variables) => {
        'setChannelEnabled': {
          'channel_id': variables['channelId'],
          'enabled': variables['enabled'],
        },
      },
      'CreateMetaConnectUrl': {'createMetaConnectUrl': 'https://meta.test/go'},
    });

    _screenTest('filters by name and platform', (tester) async {
      await tester.pumpWidget(_app(ChannelsPage(graphQL: backend().service())));
      await tester.pumpAndSettle();
      expect(find.text('官方粉專'), findsOneWidget);
      expect(find.text('IG 帳號'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'IG');
      await tester.pumpAndSettle();
      expect(find.text('官方粉專'), findsNothing);
      expect(find.text('IG 帳號'), findsOneWidget);
    });

    _screenTest('switches a channel off', (tester) async {
      final fake = backend();
      await tester.pumpWidget(_app(ChannelsPage(graphQL: fake.service())));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(Switch).first);
      await tester.pumpAndSettle();

      expect(fake.named('SetChannelEnabled').single.variables, {
        'channelId': 'channel-1',
        'enabled': false,
      });
      expect(find.text('已停用「官方粉專」'), findsOneWidget);
      expect(tester.widget<Switch>(find.byType(Switch).first).value, isFalse);
    });

    _screenTest('a refused switch stays as it was', (tester) async {
      final fake = FakeBackend({
        ..._inbox(),
        'SetChannelEnabled': const FakeError('不行'),
      });
      await tester.pumpWidget(_app(ChannelsPage(graphQL: fake.service())));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(Switch).first);
      await tester.pumpAndSettle();
      expect(find.text('無法停用「官方粉專」：不行'), findsOneWidget);
      expect(tester.widget<Switch>(find.byType(Switch).first).value, isTrue);
    });

    _screenTest('connects Meta in the browser', (tester) async {
      Uri? opened;
      await tester.pumpWidget(
        _app(
          ChannelsPage(
            graphQL: backend().service(),
            openUrl: (url) async {
              opened = url;
              return true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('新增社群'));
      await tester.pumpAndSettle();
      expect(find.text('尚未開放'), findsNWidgets(2));
      await tester.tap(find.text('Meta'));
      await tester.pumpAndSettle();
      expect(opened, Uri.parse('https://meta.test/go'));
    });
  });

  group('message templates', () {
    final template = {
      'id': 't1',
      'name': '問候',
      'category': 'sales',
      'platform': 'fb',
      'contents': '{"messages":[{"type":"text","text":"您好"}]}',
      'createdAt': '2026-11-05T10:00:00.000Z',
      'updatedAt': '2026-11-05T10:00:00.000Z',
    };

    FakeBackend backend() => FakeBackend({
      'MessageTemplates': {
        'messageTemplates': [template],
      },
      'CreateMessageTemplate': {
        'createMessageTemplate': {'id': 't2'},
      },
      'UpdateMessageTemplate': {
        'updateMessageTemplate': {'id': 't1'},
      },
      'DeleteMessageTemplate': {'deleteMessageTemplate': true},
    });

    _screenTest('lists and searches', (tester) async {
      await tester.pumpWidget(
        _app(TemplatesPage(graphQL: backend().service())),
      );
      await tester.pumpAndSettle();
      expect(find.text('問候'), findsOneWidget);
      expect(find.text('您好'), findsOneWidget);
      await tester.enterText(find.byType(TextField), '沒有這個');
      await tester.pumpAndSettle();
      expect(find.text('找不到符合的範本'), findsOneWidget);
    });

    _screenTest('checks the form, then creates', (tester) async {
      final fake = backend();
      await tester.pumpWidget(_app(TemplatesPage(graphQL: fake.service())));
      await tester.pumpAndSettle();
      await tester.tap(find.text('新增範本'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('儲存'));
      await tester.pumpAndSettle();
      expect(find.text('請輸入範本名稱'), findsOneWidget);
      expect(find.text('請選擇平台'), findsOneWidget);
      expect(find.text('訊息內容不能空白'), findsOneWidget);
      expect(fake.named('CreateMessageTemplate'), isEmpty);

      await tester.enterText(find.byType(TextField).at(0), '新範本');
      await tester.enterText(find.byType(TextField).at(1), '第一則');
      await tester.tap(find.text('文字訊息'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).at(2), '第二則');
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Instagram').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('儲存'));
      await tester.pumpAndSettle();

      final input =
          fake.named('CreateMessageTemplate').single.variables['input'] as Map;
      expect(input['name'], '新範本');
      expect(input['platform'], 'ig');
      expect(input['category'], 'general');
      expect(parseTemplateMessages(input['contents'] as String), [
        '第一則',
        '第二則',
      ]);
      expect(find.byType(TemplatesPage), findsOneWidget);
    });

    _screenTest('refuses a message over the limit', (tester) async {
      final fake = backend();
      await tester.pumpWidget(_app(TemplatesPage(graphQL: fake.service())));
      await tester.pumpAndSettle();
      await tester.tap(find.text('問候'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).at(1), 'a' * 161);
      await tester.pumpAndSettle();
      expect(find.text('每則訊息最多 160 字'), findsOneWidget);
      await tester.tap(find.text('儲存'));
      await tester.pumpAndSettle();
      expect(fake.named('UpdateMessageTemplate'), isEmpty);
    });

    _screenTest('edits and keeps the category', (tester) async {
      final fake = backend();
      await tester.pumpWidget(_app(TemplatesPage(graphQL: fake.service())));
      await tester.pumpAndSettle();
      await tester.tap(find.text('問候'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).at(0), '問候二');
      await tester.tap(find.text('儲存'));
      await tester.pumpAndSettle();
      final request = fake.named('UpdateMessageTemplate').single;
      expect(request.variables['id'], 't1');
      expect((request.variables['input'] as Map)['category'], 'sales');
    });

    _screenTest('asks before deleting', (tester) async {
      final fake = backend();
      await tester.pumpWidget(_app(TemplatesPage(graphQL: fake.service())));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('刪除範本'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      expect(fake.named('DeleteMessageTemplate'), isEmpty);

      await tester.tap(find.byTooltip('刪除範本'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('刪除'));
      await tester.pumpAndSettle();
      expect(fake.named('DeleteMessageTemplate').single.variables, {
        'id': 't1',
      });
    });
  });

  group('user management', () {
    FakeBackend backend() => FakeBackend({
      'ListAccounts': {
        'listAccounts': {
          'items': [
            accountJson(),
            {
              ...accountJson(
                id: 'u2',
                email: 'b@example.com',
                role: 'user',
                name: '小組員',
              ),
              'info': {
                'name': '小組員',
                'avatar': 'https://x/a.png',
                'mobile': 912,
              },
            },
          ],
          'total': 2,
        },
      },
      'CreateAccount': {
        'createAccount': {'_id': 'u3'},
      },
      'UpdateAccount': (Map<String, dynamic> variables) => {
        'updateAccount': accountJson(
          id: variables['_id'] as String,
          enabled: (variables['input'] as Map)['enabled'] != false,
        ),
      },
      'DeleteAccount': {'deleteAccount': true},
    });

    _screenTest('protects your own account', (tester) async {
      await tester.pumpWidget(_app(UsersPage(graphQL: backend().service())));
      await tester.pumpAndSettle();
      expect(find.text('我（你）'), findsOneWidget);
      expect(
        tester.widget<Switch>(find.byType(Switch).first).onChanged,
        isNull,
      );
      expect(find.byTooltip('不能刪除自己的帳號'), findsOneWidget);
    });

    _screenTest('switches someone off and deletes after asking', (
      tester,
    ) async {
      final fake = backend();
      await tester.pumpWidget(_app(UsersPage(graphQL: fake.service())));
      await tester.pumpAndSettle();

      await tester.tap(find.byType(Switch).last);
      await tester.pumpAndSettle();
      expect(fake.named('UpdateAccount').single.variables, {
        '_id': 'u2',
        'input': {'enabled': false},
      });

      await tester.tap(find.byTooltip('刪除使用者'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('刪除'));
      await tester.pumpAndSettle();
      expect(fake.named('DeleteAccount').single.variables, {'_id': 'u2'});
    });

    _screenTest('checks the form, then adds someone', (tester) async {
      final fake = backend();
      await tester.pumpWidget(_app(UsersPage(graphQL: fake.service())));
      await tester.pumpAndSettle();
      await tester.tap(find.text('新增使用者'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('儲存'));
      await tester.pumpAndSettle();
      expect(find.text('請輸入有效的電子信箱'), findsOneWidget);
      expect(find.text('密碼至少需要 6 個字元'), findsOneWidget);
      expect(find.text('請輸入使用者名稱'), findsOneWidget);

      await tester.enterText(find.byType(TextField).at(0), 'new@example.com');
      await tester.enterText(find.byType(TextField).at(1), 'secret1');
      await tester.enterText(find.byType(TextField).at(2), '新人');
      await tester.tap(find.text('儲存'));
      await tester.pumpAndSettle();

      final request = fake.named('CreateAccount').single;
      expect(request.variables['company_id'], 'company-1');
      final input = request.variables['input'] as Map;
      expect(input['email'], 'new@example.com');
      expect(input['role'], 'admin');
      expect(input['user_info'], '{"name":"新人"}');
    });

    _screenTest('editing keeps fields the form does not show', (tester) async {
      final fake = backend();
      await tester.pumpWidget(_app(UsersPage(graphQL: fake.service())));
      await tester.pumpAndSettle();
      await tester.tap(find.text('小組員'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).at(1), '改名');
      await tester.tap(find.text('儲存'));
      await tester.pumpAndSettle();

      final input =
          fake.named('UpdateAccount').single.variables['input'] as Map;
      expect(
        input['user_info'],
        '{"name":"改名","avatar":"https://x/a.png","mobile":912}',
      );
      expect(input.containsKey('password'), isFalse);
    });
  });

  group('company information', () {
    Map<String, dynamic> company() => {
      '_id': 'company-1',
      'email': 'co@example.com',
      'chinese_name': '示範公司',
      'english_name': 'Demo Co',
      'mobile': '0912345678',
      'pin_number': '85041234',
      'address': '台北市',
      'country': 'Taiwan',
      'subscription': {
        'name': '試用',
        'period': {'start': null, 'end': '2026-12-31T00:00:00.000Z'},
      },
      'principal_info': {
        'first_name': 'Mei',
        'last_name': 'Wang',
        'cn_name': '王小美',
        'mobile': '0987654321',
      },
    };

    FakeBackend backend() => FakeBackend({
      'Company': {'findCompanyById': company()},
      'UpdateCompanyInfo': {'updateCompanyInfo': 'success'},
    });

    Future<void> pumpPage(WidgetTester tester, FakeBackend fake) async {
      await tester.pumpWidget(_app(CompanyPage(graphQL: fake.service())));
      await tester.pumpAndSettle();
    }

    Finder field(String label) => find.widgetWithText(TextField, label);

    _screenTest('shows the company, with email and plan read-only', (
      tester,
    ) async {
      await pumpPage(tester, backend());
      expect(find.text('示範公司'), findsOneWidget);
      expect(find.text('co@example.com'), findsOneWidget);
      expect(field('電子信箱'), findsNothing);
      expect(find.text('試用'), findsOneWidget);
    });

    _screenTest('sends only what changed', (tester) async {
      final fake = backend();
      await pumpPage(tester, fake);
      await tester.enterText(field('地址'), '新竹市');
      await tester.tap(find.text('儲存'));
      await tester.pumpAndSettle();
      expect(
        fake.named('UpdateCompanyInfo').single.variables['updateCompanyInput'],
        {'_id': 'company-1', 'address': '新竹市'},
      );
      expect(find.text('儲存成功'), findsOneWidget);
    });

    _screenTest('one principal change sends the whole principal', (
      tester,
    ) async {
      final fake = backend();
      await pumpPage(tester, fake);
      await tester.enterText(field('英文姓氏'), 'Lin');
      await tester.tap(find.text('儲存'));
      await tester.pumpAndSettle();
      final input =
          fake.named('UpdateCompanyInfo').single.variables['updateCompanyInput']
              as Map;
      expect(input['principal_info'], {
        'cn_name': '王小美',
        'mobile': '0987654321',
        'first_name': 'Mei',
        'last_name': 'Lin',
      });
    });

    _screenTest('refuses invalid fields', (tester) async {
      final fake = backend();
      await pumpPage(tester, fake);
      await tester.enterText(field('統一編號'), 'abc');
      await tester.enterText(field('英文名稱'), '中文');
      await tester.tap(find.text('儲存'));
      await tester.pumpAndSettle();
      expect(find.text('請輸入正確的統一編號'), findsOneWidget);
      expect(find.text('請輸入正確的英文名稱'), findsOneWidget);
      expect(fake.named('UpdateCompanyInfo'), isEmpty);
    });

    _screenTest('says when nothing changed', (tester) async {
      final fake = backend();
      await pumpPage(tester, fake);
      await tester.tap(find.text('儲存'));
      await tester.pumpAndSettle();
      expect(find.text('沒有需要儲存的變更'), findsOneWidget);
      expect(fake.named('UpdateCompanyInfo'), isEmpty);
    });
  });

  group('overview', () {
    _screenTest('counts only the channels this account can use', (
      tester,
    ) async {
      ChatConversation? opened;
      final fake = FakeBackend({
        ..._inbox(),
        'ListAccounts': {
          'listAccounts': {
            'items': [accountJson(name: '管理員甲')],
            'total': 1,
          },
        },
      });
      await tester.pumpWidget(
        _app(
          OverviewPage(
            graphQL: fake.service(),
            onOpenConversation: (room) => opened = room,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('來自全部'), findsOneWidget);
      expect(find.text('來自Facebook'), findsOneWidget);
      expect(find.text('來自Instagram'), findsOneWidget);
      expect(find.text('別人的客戶'), findsNothing);
      expect(find.text('2 個已啟用'), findsOneWidget);

      await tester.tap(find.text('小美王'));
      expect(opened?.messageRoomId, 'psid-1');

      await tester.tap(find.text('成員列表'));
      await tester.pumpAndSettle();
      expect(find.text('管理員甲'), findsOneWidget);
      expect(find.text('已啟用'), findsOneWidget);

      await tester.tap(find.text('BOT列表'));
      await tester.pumpAndSettle();
      expect(find.text('對話BOT 尚未開放'), findsOneWidget);
    });

    _screenTest('without channels it says so', (tester) async {
      final fake = FakeBackend({
        'GetUserSubscribedChannels': {'getUserSubscribedChannels': <Object>[]},
        'ChatRooms': {'chatRooms': <Object>[]},
      });
      await tester.pumpWidget(
        _app(OverviewPage(graphQL: fake.service(), onOpenConversation: (_) {})),
      );
      await tester.pumpAndSettle();
      expect(find.text('還沒有可用的社群平台'), findsOneWidget);
    });
  });
}
