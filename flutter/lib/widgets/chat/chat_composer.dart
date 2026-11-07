import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../models/app_models.dart';
import '../../models/attachment_rules.dart';
import '../../theme/chat_colors.dart';

/// The input at the bottom of every conversation, the basic part every source
/// has: ＋ on the left for what can be sent besides text, the text box, and
/// send on the right (Figma App/輸入區).
///
/// When only a template can go, the ＋ becomes the template button, the box
/// says so and can't be typed in, and send is greyed out.
class ChatComposer extends StatelessWidget {
  const ChatComposer({
    required this.controller,
    required this.focusNode,
    required this.onSend,
    required this.onPlus,
    this.enabled = true,
    this.templatesOnly = false,
    this.onTemplates,
    this.hint = '訊息',
    this.onChanged,
    this.onKeyEvent,
    this.pendingFile,
    this.onRemovePending,
    this.pickError,
    this.onDismissError,
    super.key,
  });
  final TextEditingController controller;
  final FocusNode focusNode;
  final VoidCallback onSend;

  /// Opens the ＋ panel; null when there is nothing to choose from.
  final VoidCallback? onPlus;

  /// Whether a typed reply may go now.
  final bool enabled;

  /// Only an approved template can go now.
  final bool templatesOnly;
  final VoidCallback? onTemplates;
  final String hint;
  final ValueChanged<String>? onChanged;
  final FocusOnKeyEventCallback? onKeyEvent;

  /// A file picked to go with the next message.
  final PendingAttachment? pendingFile;
  final VoidCallback? onRemovePending;

  /// Why a picked file can't go.
  final String? pickError;
  final VoidCallback? onDismissError;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    final leading = templatesOnly
        ? _RoundButton(
            key: const ValueKey('composer-templates'),
            icon: Icons.description_outlined,
            tooltip: '選範本',
            background: colors.brandPrimarySoft,
            foreground: colors.brandPrimaryDark,
            onPressed: onTemplates,
          )
        : _RoundButton(
            key: const ValueKey('composer-plus'),
            icon: Icons.add_rounded,
            tooltip: '傳送附件、快速回覆或範本',
            background: colors.surfacePage,
            foreground: colors.textPrimary,
            onPressed: enabled ? onPlus : null,
          );
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceNav,
        border: Border(top: BorderSide(color: colors.borderDefault)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (pickError != null) _error(colors),
              if (pendingFile != null) _pending(colors, pendingFile!),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  leading,
                  const SizedBox(width: 8),
                  Expanded(child: _field(colors)),
                  const SizedBox(width: 8),
                  ListenableBuilder(
                    listenable: controller,
                    builder: (context, _) {
                      final hasContent =
                          controller.text.trim().isNotEmpty ||
                          pendingFile != null;
                      final active = enabled && hasContent;
                      return _RoundButton(
                        key: const ValueKey('send-message'),
                        icon: Icons.send_rounded,
                        tooltip: '發送',
                        background: active
                            ? colors.brandPrimary
                            : colors.borderDefault,
                        foreground: active
                            ? colors.textOnPrimary
                            : colors.textTertiary,
                        onPressed: enabled ? onSend : null,
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(ChatColors colors) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(20),
      borderSide: BorderSide.none,
    );
    return Focus(
      onKeyEvent: onKeyEvent,
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        enabled: enabled,
        minLines: 1,
        maxLines: 5,
        keyboardType: TextInputType.multiline,
        textInputAction: TextInputAction.newline,
        onChanged: onChanged,
        style: TextStyle(fontSize: 16, height: 1.4, color: colors.textPrimary),
        decoration: InputDecoration(
          isDense: true,
          hintText: hint,
          hintMaxLines: 2,
          hintStyle: TextStyle(fontSize: 16, color: colors.textTertiary),
          filled: true,
          fillColor: enabled ? colors.surfacePage : colors.borderDefault,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 10,
          ),
          border: border,
          enabledBorder: border,
          disabledBorder: border,
          focusedBorder: border.copyWith(
            borderSide: BorderSide(color: colors.brandPrimary, width: 1.2),
          ),
        ),
      ),
    );
  }

  Widget _error(ChatColors colors) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(
      children: [
        Icon(
          Icons.error_outline_rounded,
          size: 16,
          color: colors.feedbackAlert,
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            pickError!,
            style: TextStyle(fontSize: 13, color: colors.feedbackAlert),
          ),
        ),
        IconButton(
          tooltip: '關閉',
          visualDensity: VisualDensity.compact,
          icon: Icon(Icons.close, size: 18, color: colors.textSecondary),
          onPressed: onDismissError,
        ),
      ],
    ),
  );

  Widget _pending(ChatColors colors, PendingAttachment file) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.fromLTRB(8, 6, 4, 6),
    decoration: BoxDecoration(
      color: colors.surfacePage,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      children: [
        if (file.kind == 'image')
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: Image.memory(
              Uint8List.fromList(file.bytes),
              width: 44,
              height: 44,
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
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                file.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 14, color: colors.textPrimary),
              ),
              Text(
                '${formatFileSize(file.size)}・送出時上傳並傳給客戶',
                style: TextStyle(fontSize: 12, color: colors.textSecondary),
              ),
            ],
          ),
        ),
        IconButton(
          tooltip: '移除附件',
          icon: Icon(Icons.close, color: colors.textSecondary),
          onPressed: onRemovePending,
        ),
      ],
    ),
  );
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    required this.icon,
    required this.tooltip,
    required this.background,
    required this.foreground,
    required this.onPressed,
    super.key,
  });
  final IconData icon;
  final String tooltip;
  final Color background;
  final Color foreground;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 40,
    height: 40,
    child: IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      padding: EdgeInsets.zero,
      style: IconButton.styleFrom(
        backgroundColor: background,
        disabledBackgroundColor: background,
        foregroundColor: foreground,
        disabledForegroundColor: foreground.withValues(alpha: 0.5),
        shape: const CircleBorder(),
      ),
      icon: Icon(icon, size: 22),
    ),
  );
}
