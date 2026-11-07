import 'package:flutter_test/flutter_test.dart';
import 'package:masterbox_flutter/models/app_models.dart';
import 'package:masterbox_flutter/pages/company_page.dart';
import 'package:masterbox_flutter/widgets/common.dart';

import 'support/fake_backend.dart';

void main() {
  group('ChatConversation', () {
    test('names the room after the customer, not the channel', () {
      final room = ChatConversation.fromJson(roomJson());
      expect(room.title, '小美王');
      expect(room.customer?.id, 'customer-1');
      expect(room.messageRoomId, 'psid-1');
      expect(room.id, 'room-row-1');
    });

    test('a customer without a name is unnamed rather than an id', () {
      final room = ChatConversation.fromJson(
        roomJson(firstName: null, lastName: null),
      );
      expect(room.title, unnamedCustomer);
    });

    test('rooms from older payloads keep their title', () {
      final room = ChatConversation.fromJson({'id': 'a', 'title': '舊聊天室'});
      expect(room.title, '舊聊天室');
      expect(room.messageRoomId, 'a');
    });
  });

  group('ChatMessage reads the unified body every source shares', () {
    ChatMessage read(Object? body, {bool? inbound}) => ChatMessage.fromJson({
      '_id': 'm1',
      'body': body,
      // What older apps read; the app no longer guesses from it.
      'contents': '{"message":{"text":"舊格式"}}',
      'inbound': ?inbound,
      'sentAt': '2026-11-05T10:00:00.000Z',
    });

    test('text', () => expect(read({'text': '你好'}).text, '你好'));

    test('attachments, and their label when the link is unusable', () {
      final message = read({
        'text': null,
        'attachments': [
          {'type': 'image', 'url': 'https://x/a.png', 'mime_type': 'image/png'},
          {'type': 'audio', 'url': 'http://x/a.mp3', 'size': 2048},
          {'type': 'sticker', 'url': 'https://x/s.png'},
        ],
      });
      expect(message.text, '');
      expect(message.attachments, hasLength(3));
      expect(message.attachments.first.isImage, isTrue);
      expect(message.attachments.first.mimeType, 'image/png');
      expect(message.attachments.first.safeUrl, 'https://x/a.png');
      expect(message.attachments[1].label, '語音訊息');
      expect(message.attachments[1].size, 2048);
      expect(message.attachments[1].safeUrl, isNull);
      expect(message.attachments.last.isSticker, isTrue);
    });

    test('a file sent with a caption keeps it', () {
      final message = read({
        'text': '報價單',
        'attachments': [
          {
            'type': 'file',
            'url': 'https://x/a.pdf',
            'filename': 'a.pdf',
            'caption': '報價單',
          },
        ],
      });
      expect(message.attachments.single.caption, '報價單');
      expect(message.attachments.single.filename, 'a.pdf');
    });

    test('a WhatsApp template message names its template', () {
      final message = read({
        'text': '您的訂單已到貨',
        'attachments': <Object>[],
        'template': {'id': 'tpl-1', 'name': 'order_ready'},
      });
      expect(message.text, '您的訂單已到貨');
      expect(message.templateName, 'order_ready');
    });

    test('types with nothing to show say so', () {
      expect(
        read({'text': null, 'attachments': <Object>[]}).text,
        unsupportedMessageText,
      );
    });

    test('an end-to-end encrypted message has no body here', () {
      final message = read(null);
      expect(message.encrypted, isTrue);
      expect(message.text, '');
    });

    test('inbound decides the side', () {
      expect(read({'text': 'a'}, inbound: true).isMine, isFalse);
      expect(read({'text': 'a'}, inbound: false).isMine, isTrue);
      expect(read({'text': 'a'}).isMine, isFalse);
    });

    test('keeps why a reply was not delivered', () {
      final message = ChatMessage.fromJson({
        '_id': 'm1',
        'body': {'text': 'a'},
        'delivery_error': '已超過 24 小時回覆期限',
      });
      expect(message.deliveryError, '已超過 24 小時回覆期限');
    });
  });

  group('customersFromRooms', () {
    const channels = [
      SocialChannel(id: 'channel-1', platform: 'fb', name: '粉專', enabled: true),
    ];

    test('keeps each customer once, with their latest room, newest first', () {
      final customers = customersFromRooms([
        ChatConversation.fromJson(
          roomJson(id: 'old', updatedAt: '2026-01-01T00:00:00.000Z'),
        ),
        ChatConversation.fromJson(
          roomJson(id: 'new', updatedAt: '2026-06-01T00:00:00.000Z'),
        ),
        ChatConversation.fromJson(
          roomJson(
            id: 'other',
            customerId: 'customer-2',
            firstName: '阿明',
            lastName: null,
            updatedAt: '2026-09-01T00:00:00.000Z',
          ),
        ),
      ], channels);
      expect(customers.map((item) => item.displayName), ['阿明', '小美王']);
      expect(customers.last.conversation.id, 'new');
      expect(customers.last.channelName, '粉專');
    });

    test('leaves out channels this account cannot use', () {
      final customers = customersFromRooms([
        ChatConversation.fromJson(roomJson(channelId: 'someone-elses')),
      ], channels);
      expect(customers, isEmpty);
    });
  });

  group('message templates', () {
    test('round trip through the stored form', () {
      final stored = serializeTemplateMessages([' 第一則 ', '第二則']);
      expect(parseTemplateMessages(stored), ['第一則', '第二則']);
    });

    test('read the older form, and skip what they cannot show', () {
      expect(parseTemplateMessages('{"text":"舊的"}'), ['舊的']);
      expect(
        parseTemplateMessages(
          '{"messages":[{"type":"image"},{"type":"text","text":"留下"}]}',
        ),
        ['留下'],
      );
      expect(parseTemplateMessages('not json'), isEmpty);
    });
  });

  test('company phone rule matches the admin site', () {
    expect(isCompanyPhone('0912345678'), isTrue);
    expect(isCompanyPhone('886912345678'), isTrue);
    expect(isCompanyPhone('85291234567'), isTrue);
    expect(isCompanyPhone('12345'), isFalse);
  });

  test('relative time', () {
    final now = DateTime(2026, 11, 6, 12);
    expect(
      formatRelativeTime(now.subtract(const Duration(seconds: 5)), now: now),
      '剛剛',
    );
    expect(
      formatRelativeTime(now.subtract(const Duration(minutes: 5)), now: now),
      '5 分鐘前',
    );
    expect(
      formatRelativeTime(now.subtract(const Duration(hours: 3)), now: now),
      '3 小時前',
    );
    expect(
      formatRelativeTime(now.subtract(const Duration(days: 2)), now: now),
      '2 天前',
    );
    expect(formatRelativeTime(null), '');
  });
}
