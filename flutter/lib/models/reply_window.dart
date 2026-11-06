/// Whether a conversation can still be answered, by Meta's rules. The server
/// works this out too (backend/lib/messaging/replyWindow.js); the app repeats it
/// the way the admin site does (admin/src/utils/replyWindow.js), so the notice
/// counts down and follows live messages without asking again.
///
/// WhatsApp: 24 hours after the customer's last message, then only an approved
/// template. Messenger and Instagram: 24 hours, or 7 days for a person replying
/// with the human agent tag once Meta has approved it.
library;

const _hour = Duration(hours: 1);
const standardWindow = Duration(hours: 24);
const humanAgentWindow = Duration(days: 7);
const _endingSoon = Duration(hours: 3);

const _platformNames = {
  'fb': 'Facebook',
  'ig': 'Instagram',
  'whatsapp': 'WhatsApp',
  'line': 'LINE',
  'wechat': 'WeChat',
};

enum ReplyState { open, humanAgent, closed, noCustomerMessage, unsupported }

class ReplyWindow {
  const ReplyWindow({
    required this.state,
    this.closesAt,
    required this.templateRequired,
    required this.humanAgentAvailable,
  });
  final ReplyState state;
  final DateTime? closesAt;

  /// WhatsApp only accepts an approved template now.
  final bool templateRequired;
  final bool humanAgentAvailable;

  /// Whether a typed reply may go out at all.
  bool get canSendFreeform =>
      !templateRequired && state != ReplyState.unsupported;
}

/// [humanAgentAvailable] comes from the server's replyWindow.
ReplyWindow replyWindowOf({
  required String? platform,
  required DateTime? lastCustomerMessageAt,
  bool humanAgentAvailable = false,
  DateTime? now,
}) {
  final current = now ?? DateTime.now();
  final isMeta = platform == 'fb' || platform == 'ig';
  final humanAgent = isMeta && humanAgentAvailable;
  ReplyWindow result(ReplyState state, [DateTime? closesAt]) => ReplyWindow(
    state: state,
    closesAt: closesAt,
    templateRequired: platform == 'whatsapp' && state != ReplyState.open,
    humanAgentAvailable: humanAgent,
  );
  if (!const ['fb', 'ig', 'whatsapp'].contains(platform)) {
    return result(ReplyState.unsupported);
  }
  final last = lastCustomerMessageAt;
  if (last == null) return result(ReplyState.noCustomerMessage);
  if (current.isBefore(last.add(standardWindow))) {
    return result(ReplyState.open, last.add(standardWindow));
  }
  if (humanAgent && current.isBefore(last.add(humanAgentWindow))) {
    return result(ReplyState.humanAgent, last.add(humanAgentWindow));
  }
  return result(ReplyState.closed);
}

/// 2 天 3 小時, 5 小時 20 分, 12 分
String formatRemaining(Duration left) {
  // Rounded down, so the agent never has less time than it says.
  final minutes = left.inMinutes < 1 ? 1 : left.inMinutes;
  final days = minutes ~/ (24 * 60);
  final hours = (minutes % (24 * 60)) ~/ 60;
  final rest = minutes % 60;
  if (days > 0) return hours > 0 ? '$days 天 $hours 小時' : '$days 天';
  if (hours > 0) return rest > 0 ? '$hours 小時 $rest 分' : '$hours 小時';
  return '$rest 分';
}

String _deadline(DateTime time) {
  final local = time.toLocal();
  String two(int value) => value.toString().padLeft(2, '0');
  return '${local.month}/${local.day} ${two(local.hour)}:${two(local.minute)}';
}

enum NoticeTone { info, warning, blocked }

class ReplyNotice {
  const ReplyNotice(this.tone, this.text, [this.detail]);
  final NoticeTone tone;
  final String text;
  final String? detail;
}

/// What the chat tells the agent about replying now, in the admin site's words.
ReplyNotice replyNotice(ReplyWindow window, String? platform, {DateTime? now}) {
  final current = now ?? DateTime.now();
  final left = window.closesAt?.difference(current) ?? Duration.zero;
  switch (window.state) {
    case ReplyState.open:
      return ReplyNotice(
        left <= _endingSoon ? NoticeTone.warning : NoticeTone.info,
        '可回覆，還剩 ${formatRemaining(left)}（${_deadline(window.closesAt!)} 前）',
        'Meta 規定客戶最後一則訊息後 24 小時內可以回覆'
            '${platform == 'whatsapp' ? '，之後只能用已核准的範本' : ''}。',
      );
    case ReplyState.humanAgent:
      return ReplyNotice(
        NoticeTone.warning,
        '已超過 24 小時，還能以真人客服身分回覆 ${formatRemaining(left)}'
            '（${_deadline(window.closesAt!)} 前）',
        '這段期間的訊息會加上 Meta 的 Human Agent 標籤，只能由真人回覆，不能用於自動回覆或行銷。',
      );
    case ReplyState.closed:
      if (platform == 'whatsapp') {
        return const ReplyNotice(
          NoticeTone.blocked,
          '已超過 24 小時回覆期限，只能用已核准的 WhatsApp 範本發送',
          '客戶再傳訊息後，就能恢復一般回覆。',
        );
      }
      return ReplyNotice(
        NoticeTone.warning,
        '已超過 Meta 的回覆期限（客戶最後一則訊息後 '
            '${window.humanAgentAvailable ? '7 天' : '24 小時'}），訊息很可能會被拒絕',
        '${window.humanAgentAvailable ? '' : '要延長到 7 天，需要 Meta 核准 App 的 Human Agent 權限。'}'
            '若對話來自 Facebook／Instagram 廣告，Meta 可能給更長的期限，仍可試著傳送。',
      );
    case ReplyState.noCustomerMessage:
      return platform == 'whatsapp'
          ? const ReplyNotice(
              NoticeTone.blocked,
              '這位客戶還沒傳訊息給你，只能用已核准的 WhatsApp 範本開啟對話',
            )
          : const ReplyNotice(
              NoticeTone.warning,
              '這位客戶還沒傳訊息給你，Meta 不允許商家先傳訊息，訊息很可能會被拒絕',
            );
    case ReplyState.unsupported:
      return ReplyNotice(
        NoticeTone.blocked,
        '目前還不支援回覆 ${_platformNames[platform] ?? platform ?? '這個平台'} 的訊息',
      );
  }
}

/// How often the notice needs redrawing: every minute near the end, otherwise
/// every few minutes is plenty.
Duration noticeRefreshInterval(ReplyWindow window, {DateTime? now}) {
  final left = window.closesAt?.difference(now ?? DateTime.now());
  if (left == null) return const Duration(minutes: 5);
  return left < _hour
      ? const Duration(seconds: 30)
      : const Duration(minutes: 1);
}
