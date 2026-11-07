import 'package:flutter/material.dart';

import '../../models/app_models.dart';
import '../../services/graphql_service.dart';
import '../common.dart';

/// Picks one of the company's templates to put into the reply. Opens from the
/// button or by typing / in an empty box: a basic part every source has. The
/// conversation's platform's quick replies come first. Returns the text to insert, or null.
Future<String?> showQuickReplies(
  BuildContext context, {
  required GraphQLService graphQL,
  required String? platform,
}) => showModalBottomSheet<String>(
  context: context,
  showDragHandle: true,
  isScrollControlled: true,
  builder: (_) => _QuickReplySheet(graphQL: graphQL, platform: platform),
);

class _QuickReplySheet extends StatefulWidget {
  const _QuickReplySheet({required this.graphQL, required this.platform});
  final GraphQLService graphQL;
  final String? platform;
  @override
  State<_QuickReplySheet> createState() => _QuickReplySheetState();
}

class _QuickReplySheetState extends State<_QuickReplySheet> {
  // Read again each time, so a template an admin just added is there.
  late Future<List<MessageTemplate>> _templates = widget.graphQL
      .fetchQuickReplies();
  String _query = '';

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.7,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          0,
          16,
          MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          children: [
            Text('插入快速回覆', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            TextField(
              autofocus: true,
              decoration: const InputDecoration(
                hintText: '搜尋範本名稱或內容',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (value) => setState(() => _query = value),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: FutureBuilder<List<MessageTemplate>>(
                future: _templates,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Center(child: Text('正在讀取範本…'));
                  }
                  if (snapshot.hasError) {
                    return ErrorRetry(
                      message: '目前無法讀取範本，請稍後再試',
                      onRetry: () => setState(
                        () => _templates = widget.graphQL.fetchQuickReplies(),
                      ),
                    );
                  }
                  final all = snapshot.data ?? const <MessageTemplate>[];
                  if (all.isEmpty) {
                    return EmptyState(
                      icon: Icons.short_text,
                      message: '還沒有範本',
                      detail: widget.graphQL.account?.isAdmin == true
                          ? '可以到「Manage › 訊息範本」新增'
                          : '請管理員到「訊息範本」新增',
                    );
                  }
                  final words = _query.trim().toLowerCase();
                  final items =
                      all
                          .map((t) => (template: t, text: quickReplyText(t)))
                          .where((item) => item.text.trim().isNotEmpty)
                          .where(
                            (item) =>
                                words.isEmpty ||
                                item.template.name.toLowerCase().contains(
                                  words,
                                ) ||
                                item.text.toLowerCase().contains(words),
                          )
                          .toList()
                        ..sort((a, b) {
                          final mine =
                              (b.template.platform == widget.platform ? 1 : 0) -
                              (a.template.platform == widget.platform ? 1 : 0);
                          return mine != 0
                              ? mine
                              : a.template.name.compareTo(b.template.name);
                        });
                  if (items.isEmpty) {
                    return const Center(child: Text('找不到符合的範本'));
                  }
                  return ListView.separated(
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const Divider(),
                    itemBuilder: (context, index) {
                      final item = items[index];
                      return ListTile(
                        title: Text(item.template.name),
                        subtitle: Text(
                          item.text,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: item.template.platform != widget.platform
                            ? Text(platformLabel(item.template.platform))
                            : null,
                        onTap: () => Navigator.pop(context, item.text),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
