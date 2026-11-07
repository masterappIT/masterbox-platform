import 'package:flutter/material.dart';

import '../../models/chat_source.dart';
import '../../theme/chat_colors.dart';

/// Where a conversation comes from: a dot and the source's name, on the
/// source's soft colour (Figma App/來源標記).
class SourceTag extends StatelessWidget {
  const SourceTag({required this.source, super.key});
  final String? source;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: colors.sourceSoftColor(source),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(
              color: colors.sourceColor(source),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            sourceLabel(source),
            style: TextStyle(
              fontSize: 11,
              height: 1.5,
              fontWeight: FontWeight.w500,
              color: colors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

/// A rounded label in the middle of the conversation: the date, or something
/// that happened, such as the reply window closing (Figma 日期／事件膠囊).
class ChatPill extends StatelessWidget {
  const ChatPill({required this.text, this.event = false, super.key});
  final String text;

  /// Events sit on the border colour; dates on the card colour.
  final bool event;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        decoration: BoxDecoration(
          color: event ? colors.borderDefault : colors.surfaceCard,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          text,
          style: TextStyle(
            fontSize: 11,
            height: 1.5,
            color: colors.textSecondary,
          ),
        ),
      ),
    );
  }
}

enum NoticeKind {
  /// A platform rule stops or limits replying now, such as the 24 hours.
  platformRule,

  /// The account isn't allowed to do this.
  permission,

  /// The connection dropped.
  connection,
}

/// A strip above the input or the list that says why something is limited
/// right now, and what to do instead (Figma App/限制提示).
class NoticeBar extends StatelessWidget {
  const NoticeBar({
    required this.kind,
    required this.text,
    this.actionLabel,
    this.onAction,
    super.key,
  });
  final NoticeKind kind;
  final String text;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    final (background, icon, iconColor) = switch (kind) {
      NoticeKind.platformRule => (
        colors.brandPrimarySoft,
        Icons.error_outline_rounded,
        colors.brandPrimaryDark,
      ),
      NoticeKind.permission => (
        colors.surfacePage,
        Icons.lock_outline_rounded,
        colors.textSecondary,
      ),
      NoticeKind.connection => (
        colors.feedbackInfoSoft,
        Icons.error_outline_rounded,
        colors.feedbackInfo,
      ),
    };
    return Semantics(
      liveRegion: true,
      child: Material(
        color: background,
        child: InkWell(
          onTap: onAction,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                Icon(icon, size: 16, color: iconColor),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    text,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: colors.textPrimary,
                    ),
                  ),
                ),
                if (actionLabel != null) ...[
                  const SizedBox(width: 8),
                  Text(
                    actionLabel!,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      fontWeight: FontWeight.w700,
                      color: colors.brandPrimaryDark,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A round letter avatar on the brand's soft colour, or the person's picture
/// (Figma App/頭像). Meta's picture links expire, so a broken one falls back to
/// the letter.
class ChatAvatar extends StatelessWidget {
  const ChatAvatar({
    required this.name,
    this.imageUrl,
    this.size = 48,
    super.key,
  });
  final String name;
  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    final url = imageUrl;
    final hasImage = url != null && url.startsWith('https://');
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: colors.brandPrimarySoft,
      foregroundImage: hasImage
          ? NetworkImage(
              url,
              webHtmlElementStrategy: WebHtmlElementStrategy.fallback,
            )
          : null,
      onForegroundImageError: hasImage ? (_, _) {} : null,
      child: Text(
        name.isEmpty ? '?' : name.characters.first.toUpperCase(),
        style: TextStyle(
          fontSize: size * 0.4,
          height: 1,
          fontWeight: FontWeight.w700,
          color: colors.brandPrimaryDark,
        ),
      ),
    );
  }
}

/// The unread count: white on the brand colour.
class ChatUnreadBadge extends StatelessWidget {
  const ChatUnreadBadge({required this.count, super.key});
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    return Semantics(
      label: '$count 則未讀',
      excludeSemantics: true,
      child: Container(
        constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
        padding: const EdgeInsets.symmetric(horizontal: 6),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: colors.brandPrimary,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          count > 99 ? '99+' : '$count',
          style: TextStyle(
            fontSize: 12,
            height: 1,
            fontWeight: FontWeight.w700,
            color: colors.textOnPrimary,
          ),
        ),
      ),
    );
  }
}

/// A quick filter: soft brand colour when on, an outline when off.
class QuickFilterChip extends StatelessWidget {
  const QuickFilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    super.key,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: selected ? colors.brandPrimarySoft : Colors.transparent,
        shape: StadiumBorder(
          side: selected
              ? BorderSide.none
              : BorderSide(color: colors.borderDefault),
        ),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                fontWeight: selected ? FontWeight.w500 : FontWeight.w400,
                color: selected
                    ? colors.brandPrimaryDark
                    : colors.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

enum EmptyTone { brand, alert }

/// What a list or a conversation shows when there is nothing in it, or it
/// could not load (Figma App/空白狀態).
class ChatEmptyState extends StatelessWidget {
  const ChatEmptyState({
    required this.icon,
    required this.title,
    this.detail,
    this.actionLabel,
    this.onAction,
    this.tone = EmptyTone.brand,
    super.key,
  });
  final IconData icon;
  final String title;
  final String? detail;
  final String? actionLabel;
  final VoidCallback? onAction;
  final EmptyTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    final alert = tone == EmptyTone.alert;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: alert ? colors.feedbackAlertSoft : colors.brandPrimarySoft,
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              size: 32,
              color: alert ? colors.feedbackAlert : colors.brandPrimaryDark,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 18,
              height: 1.4,
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
            ),
          ),
          if (detail != null) ...[
            const SizedBox(height: 12),
            Text(
              detail!,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 15,
                height: 1.5,
                color: colors.textSecondary,
              ),
            ),
          ],
          if (actionLabel != null) ...[
            const SizedBox(height: 12),
            FilledButton(
              onPressed: onAction,
              style: FilledButton.styleFrom(
                backgroundColor: colors.brandPrimary,
                foregroundColor: colors.textOnPrimary,
                minimumSize: const Size(0, 38),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                textStyle: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}
