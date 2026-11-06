import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../models/app_models.dart';
import '../models/attachment_rules.dart';
import '../services/graphql_service.dart';
import '../widgets/common.dart';

/// What a media header needs, as the admin site's template dialog has it.
const _mediaHeaders = {
  'image': (label: '圖片', kind: 'image'),
  'video': (label: '影片', kind: 'video'),
  'document': (label: '文件', kind: 'file'),
};

/// Sends one of the number's approved WhatsApp templates: the only way to
/// write to a customer once the 24 hours have passed, or before they have
/// written at all. Pops with the stored message once it is sent.
class WhatsappTemplatePage extends StatefulWidget {
  const WhatsappTemplatePage({
    required this.graphQL,
    required this.conversation,
    super.key,
  });
  final GraphQLService graphQL;
  final ChatConversation conversation;
  @override
  State<WhatsappTemplatePage> createState() => _WhatsappTemplatePageState();
}

class _WhatsappTemplatePageState extends State<WhatsappTemplatePage> {
  late Future<List<WhatsappTemplate>> _templates = widget.graphQL
      .fetchWhatsappTemplates(widget.conversation.id);
  WhatsappTemplate? _selected;
  final _values = <String, String>{};
  PendingAttachment? _media;
  bool _sending = false;
  String? _error;
  String _query = '';

  ({String label, String kind})? get _mediaInfo {
    final variable = _selected?.mediaVariable;
    return variable == null ? null : _mediaHeaders[variable.name];
  }

  int get _missing {
    final template = _selected;
    if (template == null) return 0;
    final blanks = template.textVariables
        .where((v) => (_values[v.key] ?? '').trim().isEmpty)
        .length;
    return blanks + (_mediaInfo != null && _media == null ? 1 : 0);
  }

  void _choose(WhatsappTemplate template) {
    if (!template.supported || _sending) return;
    setState(() {
      _selected = template;
      _values.clear();
      _media = null;
      _error = null;
    });
  }

  Future<void> _pickMedia() async {
    final info = _mediaInfo;
    if (info == null) return;
    String name;
    String? mime;
    Uint8List bytes;
    if (info.kind == 'file') {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf'],
        withData: true,
      );
      final file = result?.files.singleOrNull;
      if (file == null) return;
      name = file.name;
      bytes = file.bytes ?? await XFile(file.path!).readAsBytes();
    } else {
      final picker = ImagePicker();
      final file = info.kind == 'image'
          ? await picker.pickImage(
              source: ImageSource.gallery,
              imageQuality: 85,
              maxWidth: 2560,
              maxHeight: 2560,
            )
          : await picker.pickVideo(source: ImageSource.gallery);
      if (file == null) return;
      name = file.name;
      mime = file.mimeType;
      bytes = await file.readAsBytes();
    }
    final check = checkAttachment(
      'whatsapp',
      mime: mime,
      filename: name,
      size: bytes.length,
    );
    if (!mounted) return;
    String? problem;
    if (!check.ok) {
      problem = '無法使用「$name」：${check.reason}';
    } else if (check.kind != info.kind) {
      problem = '這個範本的標題需要${info.label}';
    } else if (info.kind == 'file' && check.mime != 'application/pdf') {
      problem = 'WhatsApp 範本的標題文件只能是 PDF';
    }
    setState(() {
      _error = problem;
      if (problem == null) {
        _media = PendingAttachment(
          name: name,
          bytes: bytes,
          mime: check.mime!,
          kind: check.kind!,
        );
      }
    });
  }

  Future<void> _send() async {
    final template = _selected;
    if (template == null || _sending) return;
    if (_missing > 0) {
      setState(() => _error = '請填完所有欄位');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      var media = _media;
      if (media != null && media.uploaded == null) {
        media = media.withUpload(
          await widget.graphQL.uploadAttachment(media, platform: 'whatsapp'),
        );
        // A retry after a failed send doesn't upload it again.
        _media = media;
      }
      final sent = await widget.graphQL.sendWhatsappTemplate(
        conversation: widget.conversation,
        templateId: template.id,
        values: {
          for (final variable in template.textVariables)
            variable.key: (_values[variable.key] ?? '').trim(),
        },
        headerMediaUrl: media?.uploaded?.url,
      );
      if (mounted) Navigator.pop(context, sent);
    } catch (error) {
      if (mounted) {
        setState(() {
          _sending = false;
          _error = error is GraphQLException ? error.message : '$error';
        });
      }
    }
  }

  Widget _preview(WhatsappTemplate template) {
    final theme = Theme.of(context);
    final header = template.headerText;
    final info = _mediaInfo;
    return Card(
      color: Colors.green.withValues(alpha: 0.1),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (info != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: _media != null && _media!.kind == 'image'
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: Image.memory(
                          Uint8List.fromList(_media!.bytes),
                          height: 140,
                          fit: BoxFit.cover,
                        ),
                      )
                    : Text(
                        _media == null
                            ? '［標題${info.label}］'
                            : '［${_media!.name}］',
                        style: theme.textTheme.bodySmall,
                      ),
              ),
            if (header != null && header.isNotEmpty)
              Text(
                fillTemplateText(header, 'header', _values),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            Text(fillTemplateText(template.bodyText, 'body', _values)),
            if (template.footerText?.isNotEmpty == true)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  template.footerText!,
                  style: theme.textTheme.bodySmall,
                ),
              ),
            if (template.buttons.isNotEmpty)
              Wrap(
                spacing: 6,
                children: [
                  for (final button in template.buttons)
                    Chip(label: Text(button)),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _form(WhatsappTemplate template) {
    final info = _mediaInfo;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            IconButton(
              tooltip: '選擇其他範本',
              onPressed: _sending
                  ? null
                  : () => setState(() => _selected = null),
              icon: const Icon(Icons.arrow_back),
            ),
            Expanded(
              child: Text(
                template.name,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            Text(template.language),
          ],
        ),
        const SizedBox(height: 8),
        _preview(template),
        const SizedBox(height: 12),
        if (info != null)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.attach_file),
            title: Text('標題${info.label}'),
            subtitle: Text(
              _media == null
                  ? '必填'
                  : '${_media!.name}（${formatFileSize(_media!.size)}）',
            ),
            trailing: TextButton(
              onPressed: _sending ? null : _pickMedia,
              child: Text(_media == null ? '選擇' : '更換'),
            ),
          ),
        for (final variable in template.textVariables)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: TextField(
              enabled: !_sending,
              decoration: InputDecoration(
                labelText: variable.label,
                hintText: variable.example == null
                    ? null
                    : '例如：${variable.example}',
              ),
              onChanged: (value) =>
                  setState(() => _values[variable.key] = value),
            ),
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(_error!, style: const TextStyle(color: Colors.red)),
          ),
        FilledButton.icon(
          onPressed: _sending ? null : _send,
          icon: _sending
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.send),
          label: Text(
            _sending
                ? '傳送中…'
                : _missing > 0
                ? '還有 $_missing 個欄位要填'
                : '發送範本',
          ),
        ),
      ],
    );
  }

  Widget _list(List<WhatsappTemplate> templates) {
    if (templates.isEmpty) {
      return const EmptyState(
        icon: Icons.description_outlined,
        message: '這個 WhatsApp 號碼沒有已核准的範本',
        detail: '請到 Meta 的 WhatsApp 管理工具建立範本，核准後就會出現在這裡。',
      );
    }
    final words = _query.trim().toLowerCase();
    final shown = templates
        .where(
          (t) =>
              words.isEmpty ||
              t.name.toLowerCase().contains(words) ||
              t.bodyText.toLowerCase().contains(words),
        )
        .toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: TextField(
            decoration: const InputDecoration(
              hintText: '搜尋範本',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (value) => setState(() => _query = value),
          ),
        ),
        Expanded(
          child: shown.isEmpty
              ? const Center(child: Text('找不到符合的範本'))
              : ListView.separated(
                  itemCount: shown.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final template = shown[index];
                    final category =
                        whatsappTemplateCategories[template.category] ??
                        template.category;
                    return ListTile(
                      enabled: template.supported,
                      title: Text(template.name),
                      subtitle: Text(
                        template.supported
                            ? template.bodyText
                            : '無法從 MasterBox 發送：${template.unsupportedReason ?? '格式不支援'}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: Text(
                        [?category, template.language].join(' · '),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      onTap: () => _choose(template),
                    );
                  },
                ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('使用 WhatsApp 範本發送')),
    body: SafeArea(
      child: FutureBuilder<List<WhatsappTemplate>>(
        future: _templates,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            final error = snapshot.error;
            return ErrorRetry(
              message: error is GraphQLException
                  ? error.message
                  : '目前無法讀取範本，請稍後再試',
              onRetry: () => setState(
                () => _templates = widget.graphQL.fetchWhatsappTemplates(
                  widget.conversation.id,
                ),
              ),
            );
          }
          final selected = _selected;
          return selected != null
              ? _form(selected)
              : _list(snapshot.data ?? const []);
        },
      ),
    ),
  );
}
