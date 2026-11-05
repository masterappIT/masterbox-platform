import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/app_models.dart';
import '../services/graphql_service.dart';
import '../widgets/common.dart';

typedef UrlOpener = Future<bool> Function(Uri url);

Future<bool> _openExternally(Uri url) =>
    launchUrl(url, mode: LaunchMode.externalApplication);

/// The admin site's channel management: list, filter, switch on or off, connect.
class ChannelsPage extends StatefulWidget {
  const ChannelsPage({
    required this.graphQL,
    this.openUrl = _openExternally,
    super.key,
  });
  final GraphQLService graphQL;
  final UrlOpener openUrl;

  @override
  State<ChannelsPage> createState() => _ChannelsPageState();
}

class _ChannelsPageState extends State<ChannelsPage>
    with WidgetsBindingObserver {
  List<SocialChannel> channels = const [];
  bool loading = true;
  String? loadError;
  String platform = 'all';
  String search = '';
  bool connecting = false;
  final pending = <String>{};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Connecting happens in the browser, so look again on coming back from it.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _load();
  }

  Future<void> _load() async {
    try {
      final result = await widget.graphQL.fetchChannels();
      if (!mounted) return;
      setState(() {
        channels = result;
        loadError = null;
        loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        loadError = '$error';
        loading = false;
      });
    }
  }

  void _notify(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));

  Future<void> _toggle(SocialChannel channel, bool enabled) async {
    setState(() => pending.add(channel.id));
    try {
      final saved = await widget.graphQL.setChannelEnabled(channel.id, enabled);
      if (!mounted) return;
      setState(() {
        channels = [
          for (final item in channels)
            item.id == channel.id ? item.copyWith(enabled: saved) : item,
        ];
      });
      _notify('已${saved ? '啟用' : '停用'}「${channel.name}」');
    } catch (error) {
      if (mounted) {
        _notify('無法${enabled ? '啟用' : '停用'}「${channel.name}」：$error');
      }
    } finally {
      if (mounted) setState(() => pending.remove(channel.id));
    }
  }

  Future<void> _connectMeta() async {
    setState(() => connecting = true);
    try {
      final url = await widget.graphQL.createMetaConnectUrl();
      final opened = await widget.openUrl(Uri.parse(url));
      if (mounted && !opened) _notify('無法開啟瀏覽器進行串接');
    } catch (error) {
      if (mounted) _notify('無法開始串接：$error');
    } finally {
      if (mounted) setState(() => connecting = false);
    }
  }

  Future<void> _showPicker() => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const ListTile(
            title: Text('選擇一個社群平台'),
            subtitle: Text('會開啟瀏覽器完成授權，完成後回到這裡即可看到新頻道'),
          ),
          ListTile(
            leading: const Icon(Icons.facebook, color: primaryColor),
            title: const Text('Meta'),
            subtitle: const Text('Facebook、Instagram、WhatsApp'),
            onTap: () {
              Navigator.pop(sheetContext);
              _connectMeta();
            },
          ),
          const ListTile(
            enabled: false,
            leading: Icon(Icons.forum_outlined),
            title: Text('WeChat'),
            subtitle: Text('尚未開放'),
          ),
          const ListTile(
            enabled: false,
            leading: Icon(Icons.chat_outlined),
            title: Text('LINE'),
            subtitle: Text('尚未開放'),
          ),
        ],
      ),
    ),
  );

  List<SocialChannel> get _visible {
    final query = search.trim().toLowerCase();
    return channels
        .where(
          (channel) =>
              (platform == 'all' || channel.platform == platform) &&
              (query.isEmpty || channel.name.toLowerCase().contains(query)),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('社群平台管理')),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: connecting ? null : _showPicker,
      icon: const Icon(Icons.add),
      label: Text(connecting ? '串接中…' : '新增社群'),
    ),
    body: RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
        children: [
          TextField(
            onChanged: (value) => setState(() => search = value),
            decoration: const InputDecoration(
              hintText: '依社群名稱搜尋',
              prefixIcon: Icon(Icons.search),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: platform,
            decoration: const InputDecoration(labelText: '選擇平台'),
            items: [
              const DropdownMenuItem(value: 'all', child: Text('所有平台')),
              for (final entry in messagePlatforms.entries)
                DropdownMenuItem(value: entry.key, child: Text(entry.value)),
            ],
            onChanged: (value) => setState(() => platform = value ?? 'all'),
          ),
          const SizedBox(height: 16),
          ..._body(),
        ],
      ),
    ),
  );

  List<Widget> _body() {
    if (loading) {
      return const [Center(child: CircularProgressIndicator())];
    }
    if (loadError != null && channels.isEmpty) {
      return [ErrorRetry(message: '目前無法讀取社群，請稍後再試', onRetry: _load)];
    }
    final visible = _visible;
    if (visible.isEmpty) {
      return [
        EmptyState(
          icon: Icons.hub_outlined,
          message: channels.isEmpty ? '尚未連結任何社群，趕快新增一個吧' : '這個平台目前沒有社群',
        ),
      ];
    }
    return [
      for (final channel in visible)
        Card(
          child: SwitchListTile(
            secondary: Icon(
              platformIcon(channel.platform),
              color: primaryColor,
            ),
            title: Text(channel.name),
            subtitle: Text(
              '${platformLabel(channel.platform)} · ${channel.id}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            value: channel.enabled,
            onChanged: pending.contains(channel.id)
                ? null
                : (value) => _toggle(channel, value),
          ),
        ),
    ];
  }
}
