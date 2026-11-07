/// The chat room's add-ons: the parts a conversation shows only when its source
/// declares the capability (models/chat_source.dart). Every source has the
/// basic parts (the message list, the input, quick replies); these sit in fixed
/// places around them and are simply absent for sources without them.
///
/// | Add-on                       | Capability                     |
/// |------------------------------|--------------------------------|
/// | Photos, videos, files in ＋  | send_image / send_video / ...  |
/// | Templates in ＋ and the input | templates                      |
/// | The 24-hour notice           | reply_window                   |
/// | Voice and video calls        | calls                          |
/// | Disappearing messages        | disappearing                   |
/// | End-to-end encryption        | e2ee                           |
library;

import 'package:flutter/material.dart';

import '../../models/app_models.dart';
import '../../models/chat_source.dart';
import '../../models/reply_window.dart';
import '../../theme/chat_colors.dart';
import 'chat_parts.dart';

/// What the conversation's source adds to the chat room, worked out once from
/// its capabilities.
class ChatAddOns {
  const ChatAddOns(this.capabilities);
  final Capabilities capabilities;

  bool get photos => capabilities.canSendImage;
  bool get videos => capabilities.canSendVideo;
  bool get files => capabilities.canSendDocument || capabilities.canSendAudio;
  bool get templates => capabilities.hasTemplates;
  bool get replyWindow => capabilities.hasReplyWindow;
  bool get calls => capabilities.hasCalls;
  bool get disappearing => capabilities.hasDisappearing;
  bool get encryption => capabilities.hasE2ee;

  /// The room's settings sheet has something to set.
  bool get settings => disappearing || encryption;
}

/// The strip above the input while the platform's rules limit replying: the
/// reason and what to do instead (Figma App/限制提示, 9 超過 24 小時).
class ReplyWindowNotice extends StatelessWidget {
  const ReplyWindowNotice({required this.window, this.onTemplates, super.key});
  final ReplyWindow window;

  /// Opens the templates, offered when only a template can go.
  final VoidCallback? onTemplates;

  @override
  Widget build(BuildContext context) {
    final notice = replyNotice(window);
    final offerTemplates = window.templates && onTemplates != null;
    return NoticeBar(
      kind: NoticeKind.platformRule,
      text: notice.text,
      actionLabel: offerTemplates && window.templateRequired ? '選範本' : null,
      onAction: offerTemplates && window.templateRequired ? onTemplates : null,
    );
  }
}

/// One choice in the ＋ panel.
class SendOption {
  const SendOption({
    required this.icon,
    required this.label,
    required this.onTap,
    this.addOn = false,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  /// From the source's capabilities (soft orange) rather than basic (grey).
  final bool addOn;
}

/// The ＋ panel: what can be sent besides text (Figma App/4 ＋面板). The basic
/// choices are on grey, the source's add-ons on soft orange.
Future<void> showSendOptions(
  BuildContext context, {
  required List<SendOption> options,
}) => showModalBottomSheet<void>(
  context: context,
  showDragHandle: true,
  backgroundColor: context.chat.surfaceCard,
  builder: (sheetContext) {
    final colors = sheetContext.chat;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '傳送',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 16,
              children: [
                for (final option in options)
                  SizedBox(
                    width: 80,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () {
                        Navigator.pop(sheetContext);
                        option.onTap();
                      },
                      child: Column(
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: option.addOn
                                  ? colors.brandPrimarySoft
                                  : colors.surfacePage,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Icon(
                              option.icon,
                              color: option.addOn
                                  ? colors.brandPrimaryDark
                                  : colors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            option.label,
                            style: TextStyle(
                              fontSize: 13,
                              color: colors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  },
);

/// The room's settings for sources with disappearing messages or end-to-end
/// encryption. Returns the chosen seconds, or null when nothing was saved.
Future<int?> showChatSettings(
  BuildContext context, {
  required ChatAddOns addOns,
  required int disappearingSeconds,
}) async {
  var seconds = disappearingSeconds;
  final saved = await showModalBottomSheet<bool>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheetContext) => StatefulBuilder(
      builder: (context, setSheetState) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (addOns.encryption) ...[
                DropdownButtonFormField<EncryptionMode>(
                  initialValue: EncryptionMode.standard,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: '加密模式',
                    helperText: '目前傳輸時會加密。端對端加密需要雙方都支援，尚未開放。',
                    helperMaxLines: 2,
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: EncryptionMode.standard,
                      child: Text('傳輸加密'),
                    ),
                    DropdownMenuItem(
                      value: EncryptionMode.endToEnd,
                      enabled: false,
                      child: Text('端對端加密（尚未開放）'),
                    ),
                  ],
                  onChanged: (_) {},
                ),
                const SizedBox(height: 14),
              ],
              if (addOns.disappearing)
                DropdownButtonFormField<int>(
                  initialValue: disappearingOptions.contains(seconds)
                      ? seconds
                      : 0,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: '消失訊息',
                    helperText: '訊息顯示後開始倒數，時間到就不再顯示。',
                    helperMaxLines: 3,
                  ),
                  items: [
                    for (final item in disappearingOptions)
                      DropdownMenuItem(
                        value: item,
                        child: Text(
                          item == 0 ? '關閉' : '${disappearingLabel(item)}後刪除',
                        ),
                      ),
                  ],
                  onChanged: (value) =>
                      setSheetState(() => seconds = value ?? seconds),
                ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => Navigator.pop(sheetContext, true),
                child: const Text('儲存設定'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
  return saved == true ? seconds : null;
}
