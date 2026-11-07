import 'package:flutter/material.dart';

import '../../models/app_models.dart';
import '../../theme/chat_colors.dart';
import 'chat_parts.dart';
import 'message_bubble.dart';

const _weekdays = ['一', '二', '三', '四', '五', '六', '日'];

/// The date pill between days: 今天, 昨天, 11/6（四）, or with the year when it
/// isn't this year.
String chatDayLabel(DateTime value, {DateTime? now}) {
  final local = value.toLocal();
  final today = now ?? DateTime.now();
  final day = DateTime(local.year, local.month, local.day);
  final current = DateTime(today.year, today.month, today.day);
  final days = current.difference(day).inDays;
  if (days == 0) return '今天';
  if (days == 1) return '昨天';
  final weekday = _weekdays[local.weekday - 1];
  final date = local.year == today.year
      ? '${local.month}/${local.day}'
      : '${local.year}/${local.month}/${local.day}';
  return '$date（$weekday）';
}

bool _sameDay(DateTime a, DateTime b) {
  final x = a.toLocal();
  final y = b.toLocal();
  return x.year == y.year && x.month == y.month && x.day == y.day;
}

/// The conversation's messages on the chat background, the basic part every
/// source has: date pills between days, a tail on the first of each run from
/// the same side, older pages above and new messages below.
///
/// [older] were there when the conversation opened (and older pages since);
/// they grow upwards from the centre, so loading more leaves the view where it
/// was. [newer] came since and grow downwards.
class ChatMessageList extends StatelessWidget {
  const ChatMessageList({
    required this.older,
    required this.newer,
    required this.controller,
    required this.centerKey,
    required this.onOpenAttachment,
    required this.onRetry,
    this.onUseTemplate,
    this.hasOlder = false,
    this.loadingOlder = false,
    this.loadOlderFailed = false,
    this.onLoadOlder,
    this.unseenBelow = 0,
    this.onJumpToLatest,
    this.endEvent,
    super.key,
  });
  final List<ChatMessage> older;
  final List<ChatMessage> newer;
  final ScrollController controller;
  final Key centerKey;
  final ValueChanged<String> onOpenAttachment;
  final ValueChanged<ChatMessage> onRetry;

  /// Offered on a reply refused because only a template can go now.
  final VoidCallback? onUseTemplate;
  final bool hasOlder;
  final bool loadingOlder;
  final bool loadOlderFailed;
  final VoidCallback? onLoadOlder;

  /// New messages below while the agent reads further up.
  final int unseenBelow;
  final VoidCallback? onJumpToLatest;

  /// Something that happened after the last message, such as the reply window
  /// closing.
  final String? endEvent;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    final all = [...older, ...newer];
    Widget item(int index) {
      final message = all[index];
      final previous = index > 0 ? all[index - 1] : null;
      final newDay =
          previous == null || !_sameDay(previous.sentAt, message.sentAt);
      final tail = newDay || previous.isMine != message.isMine;
      return Padding(
        padding: EdgeInsets.only(top: tail ? 8 : 2),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (newDay)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: ChatPill(text: chatDayLabel(message.sentAt)),
              ),
            MessageBubble(
              message: message,
              tail: tail,
              onOpenAttachment: onOpenAttachment,
              onRetry: () => onRetry(message),
              onUseTemplate: onUseTemplate,
            ),
          ],
        ),
      );
    }

    final top = hasOlder
        ? Padding(
            padding: const EdgeInsets.all(8),
            child: Center(
              child: loadOlderFailed
                  ? TextButton.icon(
                      onPressed: onLoadOlder,
                      icon: const Icon(Icons.refresh),
                      label: const Text('較舊的訊息載入失敗，點此重試'),
                    )
                  : TextButton(
                      onPressed: loadingOlder ? null : onLoadOlder,
                      child: Text(loadingOlder ? '載入較舊的訊息…' : '載入較舊的訊息'),
                    ),
            ),
          )
        : const SizedBox(height: 8);
    return ColoredBox(
      color: colors.surfaceChat,
      child: Stack(
        children: [
          CustomScrollView(
            controller: controller,
            center: centerKey,
            // Messages there when it opened end at the bottom; older ones go
            // up, newer ones down, so neither moves what the agent is reading.
            anchor: 1,
            slivers: [
              SliverToBoxAdapter(child: top),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                sliver: SliverList.builder(
                  itemCount: older.length,
                  // Before the centre, items are laid out upwards: newest first.
                  itemBuilder: (_, i) => item(older.length - 1 - i),
                ),
              ),
              SliverPadding(
                key: centerKey,
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                sliver: SliverList.builder(
                  itemCount: newer.length + (endEvent == null ? 0 : 1),
                  itemBuilder: (_, i) => i < newer.length
                      ? item(older.length + i)
                      : Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: ChatPill(text: endEvent!, event: true),
                        ),
                ),
              ),
            ],
          ),
          if (unseenBelow > 0)
            Positioned(
              bottom: 12,
              left: 0,
              right: 0,
              child: Center(
                child: FilledButton.tonalIcon(
                  onPressed: onJumpToLatest,
                  icon: const Icon(Icons.arrow_downward),
                  label: Text('$unseenBelow 則新訊息'),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
