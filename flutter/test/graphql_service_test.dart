import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:masterbox_flutter/models/app_models.dart';
import 'package:masterbox_flutter/services/graphql_service.dart';

import 'support/fake_backend.dart';

const uploaded = UploadedFile(
  url: 'https://api.example/files/a.png',
  filename: 'a.png',
  mimeType: 'image/png',
  size: 1,
  kind: 'image',
);

void main() {
  test('sends the token exactly as the backend expects it', () async {
    final backend = FakeBackend({
      'ChatRooms': {'chatRooms': <Object>[]},
    });
    await backend.service().fetchConversations();
    expect(backend.requests.single.authorization, 'Bearer access-token');
  });

  test('logs in without a token and keeps the account', () async {
    final backend = FakeBackend({
      'Login': {
        'loginAccount': {
          'token': 't',
          'refreshToken': 'r',
          '_id': 'me',
          'email': 'me@example.com',
          'company_id': 'c',
          'role': 'admin',
          'info': {'name': '我', 'avatar': null},
        },
      },
    });
    final tokens = await backend
        .service(token: 'stale')
        .authenticate(email: 'me@example.com', password: 'pw');
    expect(backend.requests.single.authorization, isNull);
    expect(tokens.token, 't');
    expect(tokens.account?.isAdmin, isTrue);
    expect(tokens.account?.name, '我');
  });

  test('shows login failures in words', () async {
    final backend = FakeBackend({
      'Login': const FakeError('bad', code: 'INVALID_CREDENTIALS'),
    });
    await expectLater(
      backend.service(token: null).authenticate(email: 'a', password: 'b'),
      throwsA(
        isA<GraphQLException>().having(
          (error) => error.message,
          'message',
          '電子信箱或密碼錯誤',
        ),
      ),
    );
  });

  test('registers a company without a token', () async {
    final backend = FakeBackend({
      'RegisterCompanyAccount': {
        'registerCompanyAccount': {
          'token': 't',
          '_id': 'me',
          'company_id': 'c',
          'role': 'admin',
        },
      },
    });
    final tokens = await backend
        .service(token: null)
        .registerCompany(
          const CompanyRegistration(
            chineseName: '公司',
            englishName: 'Co',
            email: 'a@b.co',
            password: 'pw',
            country: 'Taiwan',
            mobile: '0912345678',
          ),
        );
    expect(tokens.token, 't');
    final input = backend.requests.single.variables['input'] as Map;
    expect(input['chinese_name'], '公司');
    expect(input['mobile'], '0912345678');
    expect(backend.requests.single.authorization, isNull);
  });

  group('an expired token', () {
    Map<String, Object?> expiringBackend() {
      var calls = 0;
      return {
        'ChatRooms': (Map<String, dynamic> _) => calls++ == 0
            ? const FakeError(
                'Context creation failed: Invalid/Expired token',
                code: 'UNAUTHENTICATED',
                status: 400,
              )
            : {'chatRooms': <Object>[]},
        'RefreshToken': {
          'refreshToken': {
            'token': 'fresh',
            'refreshToken': 'fresh-refresh',
            '_id': 'me',
            'role': 'admin',
          },
        },
      };
    }

    test('is refreshed without a token, then the request retried', () async {
      final backend = FakeBackend(expiringBackend());
      var saved = 0;
      final service = backend.service()..onTokensChanged = () => saved++;
      await service.fetchConversations();

      expect(backend.requests.map((request) => request.operation), [
        'ChatRooms',
        'RefreshToken',
        'ChatRooms',
      ]);
      expect(backend.named('RefreshToken').single.authorization, isNull);
      expect(backend.requests.last.authorization, 'Bearer fresh');
      expect(service.refreshToken, 'fresh-refresh');
      expect(service.account?.isAdmin, isTrue);
      expect(saved, 1);
    });

    test('ends the session when it cannot be refreshed', () async {
      final backend = FakeBackend({
        'ChatRooms': const FakeError('expired', code: 'UNAUTHENTICATED'),
        'RefreshToken': const FakeError('nope', code: 'UNAUTHENTICATED'),
      });
      var expired = false;
      final service = backend.service()
        ..onSessionExpired = () => expired = true;
      await expectLater(
        service.fetchConversations(),
        throwsA(isA<GraphQLException>()),
      );
      expect(expired, isTrue);
    });

    test('shares one refresh between requests', () async {
      final backend = FakeBackend({
        'RefreshToken': {
          'refreshToken': {'token': 'fresh', '_id': 'me'},
        },
      });
      final service = backend.service();
      await Future.wait([service.refresh(), service.refresh()]);
      expect(backend.named('RefreshToken'), hasLength(1));
    });
  });

  group('sending', () {
    Map<String, dynamic> inputOf(FakeBackend backend) =>
        backend.named('SendMessage').single.variables['messageInput']
            as Map<String, dynamic>;

    FakeBackend okBackend() => FakeBackend({
      'SendMessage': {
        'appSendMessage': {'_id': 'm1'},
      },
    });

    test(
      'replies to a Facebook customer in the shape every source takes',
      () async {
        final backend = okBackend();
        await backend.service().sendMessage(
          conversation: ChatConversation.fromJson(roomJson()),
          contents: '您好',
        );
        final input = inputOf(backend);
        expect(input['platform'], 'fb');
        expect(input['channel_id'], 'channel-1');
        expect(input['to_chat_room_id'], 'psid-1');
        expect(jsonDecode(input['contents'] as String), {'text': '您好'});
      },
    );

    test('replies to a WhatsApp customer in the same shape', () async {
      final backend = okBackend();
      await backend.service().sendMessage(
        conversation: ChatConversation.fromJson(roomJson(platform: 'whatsapp')),
        contents: '您好',
      );
      final input = inputOf(backend);
      expect(input['platform'], 'whatsapp');
      expect(jsonDecode(input['contents'] as String), {'text': '您好'});
    });

    test(
      'sends an uploaded file to the customer, as the admin site does',
      () async {
        final backend = okBackend();
        await backend.service().sendMessage(
          conversation: ChatConversation.fromJson(roomJson()),
          contents: '看這個',
          attachment: uploaded,
        );
        final input = inputOf(backend);
        expect(input['platform'], 'fb');
        final message = jsonDecode(input['contents'] as String);
        expect(message['text'], '看這個');
        expect(message['attachments'], [
          {
            'type': 'image',
            'payload': {'url': 'https://api.example/files/a.png'},
            'filename': 'a.png',
            'mime_type': 'image/png',
            'size': 1,
          },
        ]);
      },
    );

    test('a MasterBox room keeps the file in its own record', () async {
      final backend = okBackend();
      await backend.service().sendMessage(
        conversation: const ChatConversation(
          id: 'demo',
          title: 'demo',
          lastMessage: '',
        ),
        contents: '看這個',
        attachment: uploaded,
      );
      final input = inputOf(backend);
      expect(input['platform'], 'app');
      expect(
        jsonDecode(input['contents'] as String)['attachments'],
        hasLength(1),
      );
    });

    test('a room without a platform still uses the app path', () async {
      final backend = okBackend();
      await backend.service().sendMessage(
        conversation: const ChatConversation(
          id: 'demo',
          title: 'demo',
          lastMessage: '',
        ),
        contents: '嗨',
      );
      expect(inputOf(backend)['platform'], 'app');
      expect(inputOf(backend)['contents'], '嗨');
    });

    test("passes on the platform's reason for refusing", () async {
      final backend = FakeBackend({
        'SendMessage': const FakeError('已超過 24 小時回覆期限', code: 'SEND_FAILED'),
      });
      await expectLater(
        backend.service().sendMessage(
          conversation: ChatConversation.fromJson(roomJson()),
          contents: '您好',
        ),
        throwsA(
          isA<GraphQLException>().having(
            (error) => error.message,
            'message',
            contains('24 小時'),
          ),
        ),
      );
    });
  });

  test(
    'reads a page of messages by the conversation, older ones by cursor',
    () async {
      final backend = FakeBackend({
        'MessagePage': {
          'messagePage': {
            'messages': [
              {
                '_id': 'm1',
                'body': {'text': '嗨'},
                'cursor': 'c1',
                'inbound': true,
              },
            ],
            'hasOlder': true,
            'hasNewer': false,
          },
        },
      });
      final page = await backend.service().fetchMessagePage(
        ChatConversation.fromJson(roomJson()),
        before: 'c9',
      );
      final request = backend.requests.single;
      expect(request.variables, {
        'id': 'room-row-1',
        'first': 30,
        'before': 'c9',
      });
      expect(page.hasOlder, isTrue);
      expect(page.messages.single.cursor, 'c1');
      expect(page.messages.single.isMine, isFalse);
    },
  );

  test('sorts conversations newest first', () async {
    final backend = FakeBackend({
      'ChatRooms': {
        'chatRooms': [
          roomJson(id: 'old', updatedAt: '2026-01-01T00:00:00.000Z'),
          roomJson(id: 'new', updatedAt: '2026-06-01T00:00:00.000Z'),
        ],
      },
    });
    final rooms = await backend.service().fetchConversations();
    expect(rooms.map((room) => room.id), ['new', 'old']);
  });

  test('disappearing applies only to messages kept in MasterBox', () async {
    FakeBackend ok() => FakeBackend({
      'SendMessage': {
        'appSendMessage': {'_id': 'm1'},
      },
    });
    Map input(FakeBackend backend) =>
        backend.named('SendMessage').single.variables['messageInput'] as Map;
    final room = ChatConversation.fromJson(roomJson());

    final record = ok();
    await record.service().sendMessage(
      conversation: const ChatConversation(
        id: 'demo',
        title: 'demo',
        lastMessage: '',
      ),
      contents: '紀錄',
      attachment: uploaded,
      disappearingSeconds: 30,
    );
    expect(input(record)['disappearing_after_seconds'], 30);

    final reply = ok();
    await reply.service().sendMessage(
      conversation: room,
      contents: '回覆',
      disappearingSeconds: 30,
    );
    expect(input(reply).containsKey('disappearing_after_seconds'), isFalse);
  });

  test('explains when the call service is not set up', () async {
    final backend = FakeBackend(
      {},
      rest: {
        '/livekit-token': (503, {'error': 'LiveKit is not configured'}),
      },
    );
    await expectLater(
      backend.service().fetchLiveKitToken(callId: 'c1'),
      throwsA(
        isA<GraphQLException>().having(
          (error) => error.message,
          'message',
          '通話服務尚未設定，暫時無法通話',
        ),
      ),
    );
  });

  test('a failed call event does not disturb the call', () async {
    final backend = FakeBackend(
      {},
      rest: {
        '/events': (500, {'error': 'boom'}),
      },
    );
    await backend.service().reportCallEvent('c1', 'call.ended');
    expect(backend.restCalls.single, contains('call.ended'));
  });

  test('Meta connections return to the admin site', () async {
    final backend = FakeBackend({
      'CreateMetaConnectUrl': {'createMetaConnectUrl': 'https://meta.test/go'},
    });
    final url = await backend.service().createMetaConnectUrl();
    expect(url, 'https://meta.test/go');
    expect(
      backend.requests.single.variables['returnUrl'],
      'https://admin.test/channels-management',
    );
  });

  test('team and company calls stay inside the signed-in company', () async {
    final backend = FakeBackend({
      'ListAccounts': {
        'listAccounts': {
          'items': [accountJson()],
          'total': 1,
        },
      },
      'Company': {
        'findCompanyById': {'_id': 'company-1', 'chinese_name': '公司'},
      },
      'UpdateCompanyInfo': {'updateCompanyInfo': 'success'},
    });
    final service = backend.service();
    expect((await service.fetchTeamAccounts()).single.roleName, '管理者');
    expect((await service.fetchCompany()).chineseName, '公司');
    await service.updateCompany({'address': '台北'});

    expect(backend.named('ListAccounts').single.variables['input'], {
      'company_id': 'company-1',
    });
    expect(backend.named('Company').single.variables['id'], 'company-1');
    expect(
      backend.named('UpdateCompanyInfo').single.variables['updateCompanyInput'],
      {'_id': 'company-1', 'address': '台北'},
    );
  });

  test('ping reports whether the backend answers', () async {
    final up = FakeBackend({
      'Ping': {'__typename': 'Query'},
    });
    expect(await up.service().ping(), isTrue);
    expect(up.requests.single.authorization, isNull);
    final down = FakeBackend({'Ping': const FakeError('boom', status: 500)});
    expect(await down.service().ping(), isFalse);
  });
}
