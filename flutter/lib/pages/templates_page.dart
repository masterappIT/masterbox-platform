import 'package:flutter/material.dart';

import '../models/app_models.dart';
import '../services/graphql_service.dart';
import '../widgets/common.dart';

/// Asks before something that can't be undone. Returns whether to go ahead.
Future<bool> confirmDelete(
  BuildContext context, {
  required String title,
  required String detail,
}) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(title),
      content: Text(detail),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: const Text('取消'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          style: TextButton.styleFrom(foregroundColor: Colors.red),
          child: const Text('刪除'),
        ),
      ],
    ),
  );
  return confirmed == true;
}

class TemplatesPage extends StatefulWidget {
  const TemplatesPage({required this.graphQL, super.key});
  final GraphQLService graphQL;

  @override
  State<TemplatesPage> createState() => _TemplatesPageState();
}

class _TemplatesPageState extends State<TemplatesPage> {
  late Future<List<MessageTemplate>> templates = widget.graphQL
      .fetchTemplates();
  String search = '';

  void _reload() {
    setState(() {
      templates = widget.graphQL.fetchTemplates();
    });
  }

  Future<void> _edit([MessageTemplate? template]) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) =>
            TemplateEditPage(graphQL: widget.graphQL, template: template),
      ),
    );
    if (saved == true) _reload();
  }

  Future<void> _delete(MessageTemplate template) async {
    final confirmed = await confirmDelete(
      context,
      title: '確定要刪除「${template.name}」嗎？',
      detail: '刪除後無法復原。',
    );
    if (!confirmed || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await widget.graphQL.deleteTemplate(template.id);
      messenger.showSnackBar(SnackBar(content: Text('已刪除「${template.name}」')));
      _reload();
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('範本刪除失敗：$error')));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('訊息範本')),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: () => _edit(),
      icon: const Icon(Icons.add),
      label: const Text('新增範本'),
    ),
    body: ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: [
        TextField(
          onChanged: (value) => setState(() => search = value),
          decoration: const InputDecoration(
            hintText: '依標題搜尋名稱',
            prefixIcon: Icon(Icons.search),
          ),
        ),
        const SizedBox(height: 16),
        FutureBuilder<List<MessageTemplate>>(
          future: templates,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ErrorRetry(message: '目前無法讀取訊息範本，請稍後再試', onRetry: _reload);
            }
            final query = search.trim().toLowerCase();
            final visible = (snapshot.data ?? const <MessageTemplate>[])
                .where((item) => item.name.toLowerCase().contains(query))
                .toList();
            if (visible.isEmpty) {
              return EmptyState(
                icon: Icons.article_outlined,
                message: query.isEmpty ? '無任何一筆資料，趕快新增一筆資料吧' : '找不到符合的範本',
              );
            }
            return Column(
              children: [
                for (final template in visible)
                  Card(
                    child: ListTile(
                      onTap: () => _edit(template),
                      leading: Icon(
                        platformIcon(template.platform),
                        color: primaryColor,
                      ),
                      title: Text(template.name),
                      subtitle: Text(
                        template.messages.isEmpty
                            ? '（沒有文字內容）'
                            : template.messages.join(' / '),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: IconButton(
                        onPressed: () => _delete(template),
                        tooltip: '刪除範本',
                        icon: const Icon(Icons.delete_outline),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    ),
  );
}

class TemplateEditPage extends StatefulWidget {
  const TemplateEditPage({required this.graphQL, this.template, super.key});
  final GraphQLService graphQL;
  final MessageTemplate? template;

  @override
  State<TemplateEditPage> createState() => _TemplateEditPageState();
}

class _TemplateEditPageState extends State<TemplateEditPage> {
  late final name = TextEditingController(text: widget.template?.name);
  late String? platform = widget.template?.platform;
  late final List<TextEditingController> messages = () {
    final texts = widget.template?.messages ?? const <String>[];
    return [
      for (final text in texts.isEmpty ? const [''] : texts)
        TextEditingController(text: text),
    ];
  }();
  bool touched = false;
  bool saving = false;

  @override
  void dispose() {
    name.dispose();
    for (final message in messages) {
      message.dispose();
    }
    super.dispose();
  }

  bool get _valid =>
      name.text.trim().isNotEmpty &&
      platform != null &&
      messages.every(
        (message) =>
            message.text.trim().isNotEmpty &&
            message.text.length <= templateTextLimit,
      );

  Future<void> _save() async {
    setState(() => touched = true);
    if (!_valid || saving) return;
    setState(() => saving = true);
    final navigator = Navigator.of(context);
    try {
      await widget.graphQL.saveTemplate(
        id: widget.template?.id,
        name: name.text.trim(),
        category: widget.template?.category ?? 'general',
        platform: platform!,
        messages: messages.map((message) => message.text).toList(),
      );
      navigator.pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() => saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('無法儲存範本：$error')));
    }
  }

  String? _messageError(TextEditingController message) {
    if (message.text.length > templateTextLimit) {
      return '每則訊息最多 $templateTextLimit 字';
    }
    if (touched && message.text.trim().isEmpty) return '訊息內容不能空白';
    return null;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.template == null ? '新增範本' : '編輯範本'),
      actions: [
        TextButton(
          onPressed: saving ? null : _save,
          child: Text(saving ? '儲存中…' : '儲存'),
        ),
      ],
    ),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: name,
          maxLength: 80,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            labelText: '範本名稱',
            errorText: touched && name.text.trim().isEmpty ? '請輸入範本名稱' : null,
          ),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: platform,
          decoration: InputDecoration(
            labelText: '選擇平台',
            errorText: touched && platform == null ? '請選擇平台' : null,
          ),
          items: [
            for (final entry in messagePlatforms.entries)
              DropdownMenuItem(value: entry.key, child: Text(entry.value)),
          ],
          onChanged: (value) => setState(() => platform = value),
        ),
        const SizedBox(height: 18),
        const SectionTitle(title: '訊息內容'),
        for (var index = 0; index < messages.length; index++)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: TextField(
              controller: messages[index],
              minLines: 2,
              maxLines: 5,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: '輸入訊息內容',
                errorText: _messageError(messages[index]),
                helperText: '${messages[index].text.length}/$templateTextLimit',
                suffixIcon: IconButton(
                  onPressed: messages.length == 1
                      ? null
                      : () =>
                            setState(() => messages.removeAt(index).dispose()),
                  tooltip: messages.length == 1 ? '至少要有一則訊息' : '刪除這則訊息',
                  icon: const Icon(Icons.delete_outline),
                ),
              ),
            ),
          ),
        OutlinedButton.icon(
          onPressed: () =>
              setState(() => messages.add(TextEditingController())),
          icon: const Icon(Icons.add),
          label: const Text('文字訊息'),
        ),
        const SizedBox(height: 12),
        Text(
          '目前範本只支援文字訊息，其他動作尚未開放。',
          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
        ),
      ],
    ),
  );
}
