import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../models/app_models.dart';
import '../../theme/chat_colors.dart';
import 'chat_parts.dart';

/// The conversation's white header: back, the customer, where the
/// conversation comes from, and actions on the right (Figma App/對話標頭).
/// Orange is only for the buttons.
class ChatHeader extends StatelessWidget implements PreferredSizeWidget {
  const ChatHeader({
    required this.room,
    this.onCustomerInfo,
    this.actions = const [],
    super.key,
  });
  final ChatConversation room;
  final VoidCallback? onCustomerInfo;

  /// The source's add-ons for the header, such as calls.
  final List<Widget> actions;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final channel = room.channelName;
    return AppBar(
      toolbarHeight: 64,
      backgroundColor: colors.surfaceNav,
      surfaceTintColor: Colors.transparent,
      foregroundColor: colors.brandPrimaryDark,
      systemOverlayStyle: dark
          ? SystemUiOverlayStyle.light
          : SystemUiOverlayStyle.dark,
      elevation: 0,
      scrolledUnderElevation: 0,
      shape: Border(bottom: BorderSide(color: colors.borderDefault)),
      titleSpacing: 0,
      title: InkWell(
        onTap: onCustomerInfo,
        child: Row(
          children: [
            ChatAvatar(
              name: room.title,
              imageUrl: room.customer?.avatarUrl,
              size: 36,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    room.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 17,
                      height: 1.3,
                      fontWeight: FontWeight.w700,
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      if (room.source != null) ...[
                        SourceTag(source: room.source),
                        const SizedBox(width: 6),
                      ],
                      if (channel != null && channel.isNotEmpty)
                        Flexible(
                          child: Text(
                            channel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              color: colors.textTertiary,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        ...actions,
        if (onCustomerInfo != null)
          IconButton(
            onPressed: onCustomerInfo,
            tooltip: '客戶資訊',
            icon: const Icon(Icons.person_outline_rounded),
          ),
        const SizedBox(width: 4),
      ],
    );
  }
}

/// Who handles the conversation, under the header.
class AssigneeStrip extends StatelessWidget {
  const AssigneeStrip({required this.room, required this.myId, super.key});
  final ChatConversation room;
  final String? myId;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    final assignee = room.assignee;
    final text = assignee == null
        ? '未指派'
        : assignee.id == myId
        ? '指派：我負責'
        : '指派：${assignee.name}';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
      decoration: BoxDecoration(
        color: colors.surfaceNav,
        border: Border(bottom: BorderSide(color: colors.borderDefault)),
      ),
      child: Row(
        children: [
          Icon(
            Icons.person_outline_rounded,
            size: 16,
            color: colors.textTertiary,
          ),
          const SizedBox(width: 6),
          Text(
            text,
            style: TextStyle(fontSize: 13, color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}
