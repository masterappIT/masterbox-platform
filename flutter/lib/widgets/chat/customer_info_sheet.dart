import 'package:flutter/material.dart';

import '../../models/app_models.dart';
import '../../theme/chat_colors.dart';
import '../common.dart';
import 'chat_parts.dart';

/// Who the customer is and where the conversation comes from.
Future<void> showCustomerInfo(BuildContext context, ChatConversation room) {
  final customer = room.customer;
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: context.chat.surfaceCard,
    builder: (sheetContext) {
      final colors = sheetContext.chat;
      Widget row(IconData icon, String title, Widget value) => ListTile(
        leading: Icon(icon, color: colors.brandPrimaryDark),
        title: Text(
          title,
          style: TextStyle(fontSize: 13, color: colors.textSecondary),
        ),
        subtitle: DefaultTextStyle.merge(
          style: TextStyle(fontSize: 15, color: colors.textPrimary),
          child: value,
        ),
      );
      return SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ChatAvatar(
                name: room.title,
                imageUrl: customer?.avatarUrl,
                size: 72,
              ),
              const SizedBox(height: 10),
              Text(
                room.title,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: colors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              if (room.source != null)
                row(
                  Icons.hub_outlined,
                  '來源',
                  Align(
                    alignment: Alignment.centerLeft,
                    child: SourceTag(source: room.source),
                  ),
                ),
              if (room.channelName?.isNotEmpty == true)
                row(Icons.forum_outlined, '頻道', Text(room.channelName!)),
              if (customer != null)
                row(Icons.badge_outlined, '帳號ID', Text(customer.id)),
              row(
                Icons.support_agent_outlined,
                '負責人',
                Text(room.assignee?.name ?? '未指派'),
              ),
              if (room.tags.isNotEmpty)
                row(Icons.sell_outlined, '標籤', Text(room.tags.join('、'))),
              row(
                Icons.schedule,
                '最後互動時間',
                Text(formatDateTime(room.lastMessageAt ?? room.updatedAt)),
              ),
            ],
          ),
        ),
      );
    },
  );
}
