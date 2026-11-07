/// Whether a conversation can still be answered, for sources that declare the
/// reply_window capability. The server works this out too (each connector's
/// replyRule); the app repeats it so the notice counts down and follows live
/// messages without asking again.
///
/// 24 hours after the customer's last message. Then a source with templates
/// only takes an approved template; the others allow 7 days for a person
/// replying with the human agent tag once Meta has approved it.
library;

import 'chat_source.dart';

const _hour = Duration(hours: 1);
const standardWindow = Duration(hours: 24);
const humanAgentWindow = Duration(days: 7);
const _endingSoon = Duration(hours: 3);

enum ReplyState { open, humanAgent, closed, noCustomerMessage }

class ReplyWindow {
  const ReplyWindow({
    required this.state,
    this.closesAt,
    required this.templateRequired,
    required this.humanAgentAvailable,
    this.templates = false,
  });
  final ReplyState state;
  final DateTime? closesAt;

  /// Only an approved template can go now.
  final bool templateRequired;
  final bool humanAgentAvailable;

  /// The source has templates to fall back on.
  final bool templates;

  /// Whether a typed reply may go out at all.
  bool get canSendFreeform => !templateRequired;
}

/// The reply window of a source that declares reply_window. Sources with
/// templates take only a template once it closes; the others still let the
/// agent try. [humanAgentAvailable] comes from the server's replyWindow.
ReplyWindow replyWindowOf({
  required Capabilities capabilities,
  required DateTime? lastCustomerMessageAt,
  bool humanAgentAvailable = false,
  DateTime? now,
}) {
  final current = now ?? DateTime.now();
  final templates = capabilities.hasTemplates;
  final humanAgent = !templates && humanAgentAvailable;
  ReplyWindow result(ReplyState state, [DateTime? closesAt]) => ReplyWindow(
    state: state,
    closesAt: closesAt,
    templateRequired: templates && state != ReplyState.open,
    humanAgentAvailable: humanAgent,
    templates: templates,
  );
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

/// What the chat tells the agent about replying now.
ReplyNotice replyNotice(ReplyWindow window, {DateTime? now}) {
  final current = now ?? DateTime.now();
  final left = window.closesAt?.difference(current) ?? Duration.zero;
  switch (window.state) {
    case ReplyState.open:
      return ReplyNotice(
        left <= _endingSoon ? NoticeTone.warning : NoticeTone.info,
        '可回覆，還剩 ${formatRemaining(left)}（${_deadline(window.closesAt!)} 前）',
        '客戶最後一則訊息後 24 小時內可以回覆'
            '${window.templates ? '，之後只能傳送範本' : ''}。',
      );
    case ReplyState.humanAgent:
      return ReplyNotice(
        NoticeTone.warning,
        '超過 24 小時，以真人客服身分還能回覆 ${formatRemaining(left)}',
        '這段期間的訊息會加上 Meta 的 Human Agent 標籤，只能由真人回覆，不能用於自動回覆或行銷。',
      );
    case ReplyState.closed:
      if (window.templates) {
        return const ReplyNotice(
          NoticeTone.blocked,
          '超過 24 小時，只能傳送範本',
          '客戶再傳訊息後，就能恢復一般回覆。',
        );
      }
      return ReplyNotice(
        NoticeTone.warning,
        '已超過回覆期限（${window.humanAgentAvailable ? '7 天' : '24 小時'}），訊息可能會被拒絕',
        '若對話來自 Facebook／Instagram 廣告，Meta 可能給更長的期限，仍可試著傳送。',
      );
    case ReplyState.noCustomerMessage:
      return window.templates
          ? const ReplyNotice(NoticeTone.blocked, '客戶還沒傳訊息，只能用範本開啟對話')
          : const ReplyNotice(NoticeTone.warning, '客戶還沒傳訊息，商家先傳的訊息可能會被拒絕');
  }
}

/// Whether the notice shows above the input: a closed or closing window, not
/// an open one with plenty of time left.
bool noticeWorthShowing(ReplyNotice notice) => notice.tone != NoticeTone.info;

/// How often the notice needs redrawing: every minute near the end, otherwise
/// every few minutes is plenty.
Duration noticeRefreshInterval(ReplyWindow window, {DateTime? now}) {
  final left = window.closesAt?.difference(now ?? DateTime.now());
  if (left == null) return const Duration(minutes: 5);
  return left < _hour
      ? const Duration(seconds: 30)
      : const Duration(minutes: 1);
}
