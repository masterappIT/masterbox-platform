import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../models/app_models.dart';
import '../../models/attachment_rules.dart';
import '../../theme/chat_colors.dart';
import '../common.dart';

/// One message: the company's on the right in soft orange, the customer's on
/// the left in white. Only the first of a run from the same side has a tail.
/// The time, and for the company's messages whether it went, sit inside
/// (Figma App/訊息泡泡).
class MessageBubble extends StatelessWidget {
  const MessageBubble({
    required this.message,
    required this.tail,
    required this.onOpenAttachment,
    this.onRetry,
    this.onUseTemplate,
    super.key,
  });
  final ChatMessage message;
  final bool tail;
  final ValueChanged<String> onOpenAttachment;

  /// Sends a failed message again.
  final VoidCallback? onRetry;

  /// Opens the templates, for a reply refused because only one can go now.
  final VoidCallback? onUseTemplate;

  static const _tailWidth = 15.0;
  static const _tailHeight = 9.0;
  static const _tailInset = 7.0;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    final mine = message.isMine;
    final background = mine ? colors.bubbleCompany : colors.bubbleCustomer;
    final radius = BorderRadius.only(
      topLeft: Radius.circular(!mine && tail ? 0 : 8),
      topRight: Radius.circular(mine && tail ? 0 : 8),
      bottomLeft: const Radius.circular(8),
      bottomRight: const Radius.circular(8),
    );
    final bubble = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: background, borderRadius: radius),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (message.templateName != null) _templateLabel(colors),
          if (message.pending != null) _PendingPreview(message.pending!),
          for (final attachment in message.attachments)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: _AttachmentView(
                attachment: attachment,
                onOpen: onOpenAttachment,
              ),
            ),
          if (_text.isNotEmpty)
            Text(
              _text,
              style: TextStyle(
                fontSize: 16,
                height: 1.45,
                color: colors.textPrimary,
              ),
            ),
          const SizedBox(height: 4),
          _timeRow(colors),
        ],
      ),
    );
    final withTail = Stack(
      clipBehavior: Clip.none,
      children: [
        bubble,
        if (tail)
          Positioned(
            top: 0,
            left: mine ? null : -_tailInset,
            right: mine ? -_tailInset : null,
            child: CustomPaint(
              size: const Size(_tailWidth, _tailHeight),
              painter: _TailPainter(color: background, pointsLeft: !mine),
            ),
          ),
      ],
    );
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.78,
        ),
        child: Column(
          crossAxisAlignment: mine
              ? CrossAxisAlignment.end
              : CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            GestureDetector(
              onTap: message.failed ? _failedAction : null,
              child: withTail,
            ),
            ..._problems(colors),
          ],
        ),
      ),
    );
  }

  String get _text {
    if (message.encrypted) return '[加密訊息]';
    if (message.text.isNotEmpty) return message.text;
    final nothingElse =
        message.attachments.isEmpty &&
        message.pending == null &&
        message.templateName == null;
    return nothingElse ? '附件' : '';
  }

  VoidCallback? get _failedAction =>
      message.templateRequired && onUseTemplate != null
      ? onUseTemplate
      : onRetry;

  Widget _templateLabel(ChatColors colors) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.description_outlined, size: 12, color: colors.textSecondary),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            '範本・${message.templateName}',
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              height: 1.4,
              fontWeight: FontWeight.w500,
              color: colors.textSecondary,
            ),
          ),
        ),
      ],
    ),
  );

  Widget _timeRow(ChatColors colors) {
    final style = TextStyle(
      fontSize: 11,
      height: 1.4,
      color: colors.textTertiary,
    );
    final uploading =
        message.pending != null && message.pending!.uploaded == null;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          message.sending
              ? (uploading ? '上傳中…' : '傳送中…')
              : formatTime(message.sentAt),
          style: style,
        ),
        if (message.isMine) ...[
          const SizedBox(width: 3),
          Icon(
            message.sending
                ? Icons.schedule
                : message.failed
                ? Icons.error_outline_rounded
                : message.readAt != null
                ? Icons.done_all_rounded
                : Icons.done_rounded,
            size: 13,
            semanticLabel: message.sending
                ? '傳送中'
                : message.failed
                ? '未送出'
                : message.readAt != null
                ? '已讀'
                : '已送出',
            color: message.failed
                ? colors.feedbackAlert
                : message.readAt != null
                ? colors.feedbackInfo
                : colors.textTertiary,
          ),
        ],
      ],
    );
  }

  List<Widget> _problems(ChatColors colors) {
    Widget line(String text, {VoidCallback? onTap}) => Padding(
      padding: const EdgeInsets.only(top: 4),
      child: InkWell(
        onTap: onTap,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline_rounded,
              size: 14,
              color: colors.feedbackAlert,
            ),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                text,
                style: TextStyle(
                  fontSize: 12,
                  height: 1.4,
                  color: colors.feedbackAlert,
                ),
              ),
            ),
          ],
        ),
      ),
    );
    final error = message.sendError;
    return [
      if (message.deliveryError != null) line('未送達：${message.deliveryError}'),
      if (message.failed && message.templateRequired && onUseTemplate != null)
        line('只能傳送範本，點一下選範本', onTap: onUseTemplate)
      else if (message.failed)
        line(
          error == null
              ? '未送出，點一下重試'
              : error.startsWith('附件已送出')
              ? '$error，點一下重試'
              : '未送出：$error，點一下重試',
          onTap: onRetry,
        ),
    ];
  }
}

/// The tail at the top corner: a triangle that squares off the bubble's
/// corner and points out to the side.
class _TailPainter extends CustomPainter {
  const _TailPainter({required this.color, required this.pointsLeft});
  final Color color;
  final bool pointsLeft;

  @override
  void paint(Canvas canvas, Size size) {
    final path = pointsLeft
        ? (Path()
            ..moveTo(0, 0)
            ..lineTo(size.width, 0)
            ..lineTo(size.width, size.height)
            ..close())
        : (Path()
            ..moveTo(size.width, 0)
            ..lineTo(0, 0)
            ..lineTo(0, size.height)
            ..close());
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_TailPainter old) =>
      old.color != color || old.pointsLeft != pointsLeft;
}

class _AttachmentView extends StatelessWidget {
  const _AttachmentView({required this.attachment, required this.onOpen});
  final MessageAttachment attachment;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    final url = attachment.safeUrl;
    final caption = attachment.caption;
    final fallback = Text(
      '[${attachment.label}'
      '${attachment.filename == null ? '' : '：${attachment.filename}'}]',
      style: TextStyle(fontSize: 16, height: 1.45, color: colors.textPrimary),
    );
    Widget content;
    if (url == null) {
      content = fallback;
    } else if (attachment.isImage) {
      final placeholder = Container(
        width: 220,
        height: 150,
        color: colors.surfacePage,
        alignment: Alignment.center,
        child: Icon(Icons.image_outlined, size: 28, color: colors.textTertiary),
      );
      content = GestureDetector(
        onTap: () => onOpen(url),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: attachment.isSticker
              ? ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: 120,
                    maxHeight: 120,
                  ),
                  child: Image.network(
                    url,
                    fit: BoxFit.contain,
                    webHtmlElementStrategy: WebHtmlElementStrategy.fallback,
                    errorBuilder: (_, _, _) => fallback,
                  ),
                )
              : Image.network(
                  url,
                  width: 220,
                  fit: BoxFit.cover,
                  webHtmlElementStrategy: WebHtmlElementStrategy.fallback,
                  loadingBuilder: (_, child, progress) =>
                      progress == null ? child : placeholder,
                  // Meta's attachment links expire.
                  errorBuilder: (_, _, _) => placeholder,
                ),
        ),
      );
    } else {
      content = InkWell(
        onTap: () => onOpen(url),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: colors.surfacePage.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(switch (attachment.type) {
                'video' => Icons.play_circle_outline,
                'audio' => Icons.graphic_eq_rounded,
                _ => Icons.insert_drive_file_outlined,
              }, color: colors.brandPrimaryDark),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  attachment.filename ?? '查看${attachment.label}',
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14,
                    height: 1.4,
                    color: colors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }
    if (caption == null || caption.isEmpty) return content;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        content,
        const SizedBox(height: 4),
        Text(
          caption,
          style: TextStyle(
            fontSize: 16,
            height: 1.45,
            color: colors.textPrimary,
          ),
        ),
      ],
    );
  }
}

/// A file this device is still sending with the message.
class _PendingPreview extends StatelessWidget {
  const _PendingPreview(this.file);
  final PendingAttachment file;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (file.kind == 'image')
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.memory(
                Uint8List.fromList(file.bytes),
                width: 220,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const Icon(Icons.image_outlined),
              ),
            )
          else
            Icon(switch (file.kind) {
              'video' => Icons.movie_outlined,
              'audio' => Icons.graphic_eq_rounded,
              _ => Icons.insert_drive_file_outlined,
            }, color: colors.brandPrimaryDark),
          Text(
            '${file.name}（${formatFileSize(file.size)}）',
            style: TextStyle(
              fontSize: 11,
              height: 1.4,
              color: colors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
