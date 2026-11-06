import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/app_models.dart';
import '../services/graphql_service.dart';
import '../widgets/common.dart';
import 'templates_page.dart' show confirmDelete;
import 'whatsapp_connect_page.dart';

typedef UrlOpener = Future<bool> Function(Uri url);

Future<bool> _openExternally(Uri url) =>
    launchUrl(url, mode: LaunchMode.externalApplication);

enum ChannelTone { ok, warn, busy, error, off }

/// How a channel is doing, in the list's words, and what can be done about it.
class ChannelStatus {
  const ChannelStatus(
    this.tone,
    this.text, {
    this.detail,
    this.rescan = false,
    this.reconnect = false,
    this.recheck = false,
  });
  final ChannelTone tone;
  final String text;
  final String? detail;

  /// The WhatsApp number must be linked again.
  final bool rescan;

  /// Meta must be connected again.
  final bool reconnect;

  /// The backend can ask the platform again.
  final bool recheck;
}

const _checkable = {'fb', 'ig', 'whatsapp'};

ChannelStatus _webStatus(WhatsappWebConnection web) {
  switch (web.state) {
    case 'ready':
      return const ChannelStatus(ChannelTone.ok, '已連線');
    case 'syncing':
      final percent = web.progress?.percent;
      return ChannelStatus(
        ChannelTone.busy,
        '同步聊天記錄中${percent == null ? '' : ' $percent%'}',
      );
    case 'disconnected':
      return const ChannelStatus(ChannelTone.busy, '連線中斷，正在重新連線');
    case 'qr':
    case 'starting':
    case 'authenticated':
      return const ChannelStatus(ChannelTone.busy, '等待連結');
    case 'logged_out':
      return ChannelStatus(
        ChannelTone.error,
        web.error ?? '已斷線，請重新連結',
        rescan: true,
      );
    case 'rejected':
      return ChannelStatus(
        ChannelTone.error,
        web.error ?? '連結的號碼不符',
        rescan: true,
      );
    default:
      return ChannelStatus(
        ChannelTone.error,
        web.error ?? '需重新連結',
        rescan: true,
      );
  }
}

ChannelStatus _metaStatus(ChannelConnection? connection) {
  final detail = connection?.message;
  return switch (connection?.state) {
    'ok' => ChannelStatus(
      detail == null ? ChannelTone.ok : ChannelTone.warn,
      '已連線',
      detail: detail,
      recheck: true,
    ),
    'auth_expired' => ChannelStatus(
      ChannelTone.error,
      '授權已失效',
      detail: detail,
      reconnect: true,
      recheck: true,
    ),
    'not_subscribed' => ChannelStatus(
      ChannelTone.error,
      '未收到訊息通知',
      detail: detail,
      reconnect: true,
      recheck: true,
    ),
    'error' => ChannelStatus(
      ChannelTone.error,
      '連線異常',
      detail: detail,
      recheck: true,
    ),
    'unknown' => ChannelStatus(
      ChannelTone.off,
      '尚未檢查',
      detail: detail,
      recheck: true,
    ),
    'disabled' => const ChannelStatus(ChannelTone.off, '已停用'),
    _ => const ChannelStatus(ChannelTone.off, '—', recheck: true),
  };
}

/// The same reading of a channel as the admin site's 連線狀態 column.
ChannelStatus channelStatus(SocialChannel channel) {
  if (!channel.enabled) return const ChannelStatus(ChannelTone.off, '已停用');
  final web = channel.whatsappWeb;
  if (web != null) return _webStatus(web);
  if (!_checkable.contains(channel.platform)) {
    return const ChannelStatus(ChannelTone.off, '無法檢查');
  }
  return _metaStatus(channel.connection);
}

/// What removing a channel does, for the confirmation.
String deleteDescription(SocialChannel channel) => [
  '刪除後會停止收發這個社群的訊息，並從社群列表和對話列表中移除。',
  if (channel.whatsappWeb != null) ...[
    '這支 WhatsApp 號碼也會從手機的「已連結的裝置」登出。',
    '之後重新掃碼連結同一支號碼，可以找回原本的對話。',
  ] else
    '之後重新串接同一個帳號，可以找回原本的對話。',
].join();

/// The admin site's channel management: list, filter, switch on or off,
/// connect, check, and remove.
class ChannelsPage extends StatefulWidget {
  const ChannelsPage({
    required this.graphQL,
    this.openUrl = _openExternally,
    this.refreshInterval = const Duration(seconds: 8),
    this.connectPollInterval = const Duration(milliseconds: 2500),
    super.key,
  });
  final GraphQLService graphQL;
  final UrlOpener openUrl;

  /// How often the list is read again while a number syncs or reconnects.
  final Duration refreshInterval;
  final Duration connectPollInterval;

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
  bool linking = false;
  final pending = <String>{};
  final checking = <String>{};
  Timer? _refresh;

  /// Deleting, checking and connecting are for admins, as on the admin site.
  bool get isAdmin => widget.graphQL.account?.isAdmin == true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _refresh?.cancel();
    super.dispose();
  }

  // Connecting happens in the browser, so look again on coming back from it.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !linking) _load();
  }

  Future<void> _load() async {
    try {
      final result = await widget.graphQL.fetchChannels(withConnection: true);
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
    _keepRefreshing();
  }

  // While a number is syncing or reconnecting, its status is read again every
  // few seconds.
  void _keepRefreshing() {
    final changing = channels.any(
      (channel) =>
          channel.enabled &&
          {'syncing', 'disconnected'}.contains(channel.whatsappWeb?.state),
    );
    if (changing && !linking && mounted) {
      _refresh ??= Timer.periodic(widget.refreshInterval, (_) => _load());
    } else {
      _refresh?.cancel();
      _refresh = null;
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
      // A channel switched back on shows its connection again.
      if (saved) unawaited(_load());
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

  Future<void> _linkWhatsapp([SocialChannel? channel]) async {
    setState(() => linking = true);
    _keepRefreshing();
    final result = await Navigator.of(context).push<WhatsappConnectResult>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => WhatsappConnectPage(
          graphQL: widget.graphQL,
          channel: channel,
          pollInterval: widget.connectPollInterval,
        ),
      ),
    );
    if (!mounted) return;
    setState(() => linking = false);
    if (result?.done == true) {
      _notify(result?.name != null ? '已連結「${result!.name}」' : '已重新連結');
    }
    if (result?.changed == true) {
      await _load();
    } else {
      _keepRefreshing();
    }
  }

  Future<void> _recheck(SocialChannel channel) async {
    setState(() => checking.add(channel.id));
    try {
      final checked = await widget.graphQL.checkChannelConnection(channel.id);
      if (!mounted) return;
      setState(() {
        channels = [
          for (final item in channels)
            item.id == channel.id
                ? item.copyWith(
                    phone: checked.phone,
                    connection: checked.connection,
                  )
                : item,
        ];
      });
    } catch (error) {
      if (mounted) _notify('無法檢查「${channel.name}」：$error');
    } finally {
      if (mounted) setState(() => checking.remove(channel.id));
    }
  }

  Future<void> _delete(SocialChannel channel) async {
    final confirmed = await confirmDelete(
      context,
      title: '確定要刪除「${channel.name}」嗎？',
      detail: deleteDescription(channel),
    );
    if (!confirmed || !mounted) return;
    setState(() => pending.add(channel.id));
    try {
      await widget.graphQL.deleteChannel(channel.id);
      if (!mounted) return;
      setState(() {
        channels = [
          for (final item in channels)
            if (item.id != channel.id) item,
        ];
      });
      _notify('已刪除「${channel.name}」');
      _keepRefreshing();
    } catch (error) {
      if (mounted) _notify('無法刪除「${channel.name}」：$error');
    } finally {
      if (mounted) setState(() => pending.remove(channel.id));
    }
  }

  Future<void> _showPicker() => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheetContext) => SafeArea(
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(
              title: Text('選擇一個社群平台'),
              subtitle: Text('選擇一個社群平台，開始您的品牌社群經營'),
            ),
            ListTile(
              leading: const Icon(Icons.facebook, color: primaryColor),
              title: const Text('Meta'),
              subtitle: const Text(
                'Facebook、Instagram、WhatsApp Business。會開啟瀏覽器完成授權，完成後回到這裡即可看到新頻道',
              ),
              onTap: () {
                Navigator.pop(sheetContext);
                _connectMeta();
              },
            ),
            ListTile(
              leading: const Icon(Icons.qr_code_2, color: primaryColor),
              title: const Text('WhatsApp（掃碼／電話號碼連結）'),
              subtitle: const Text('用配對碼或 QR 碼連結任何 WhatsApp 號碼'),
              onTap: () {
                Navigator.pop(sheetContext);
                _linkWhatsapp();
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
    floatingActionButton: isAdmin
        ? FloatingActionButton.extended(
            onPressed: connecting ? null : _showPicker,
            icon: const Icon(Icons.add),
            label: Text(connecting ? '串接中…' : '新增社群'),
          )
        : null,
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
        _ChannelCard(
          key: ValueKey(channel.id),
          channel: channel,
          admin: isAdmin,
          busy: pending.contains(channel.id),
          checking: checking.contains(channel.id),
          onToggle: (value) => _toggle(channel, value),
          onDelete: () => _delete(channel),
          onRecheck: () => _recheck(channel),
          onReconnect: connecting ? null : _connectMeta,
          onRescan: linking ? null : () => _linkWhatsapp(channel),
        ),
    ];
  }
}

class _ChannelCard extends StatelessWidget {
  const _ChannelCard({
    required this.channel,
    required this.admin,
    required this.busy,
    required this.checking,
    required this.onToggle,
    required this.onDelete,
    required this.onRecheck,
    required this.onReconnect,
    required this.onRescan,
    super.key,
  });
  final SocialChannel channel;
  final bool admin;
  final bool busy;
  final bool checking;
  final ValueChanged<bool> onToggle;
  final VoidCallback onDelete;
  final VoidCallback onRecheck;
  final VoidCallback? onReconnect;
  final VoidCallback? onRescan;

  static Color toneColor(ChannelTone tone) => switch (tone) {
    ChannelTone.ok => Colors.green,
    ChannelTone.warn => Colors.amber.shade700,
    ChannelTone.busy => Colors.blue,
    ChannelTone.error => Colors.red,
    ChannelTone.off => Colors.grey,
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final status = channelStatus(channel);
    final account = channel.phone ?? channel.whatsappWeb?.phone ?? channel.id;
    final checkedAt = channel.connection?.checkedAt;
    final small = theme.textTheme.bodySmall;
    final actions = admin
        ? [
            if (status.rescan)
              TextButton(onPressed: onRescan, child: const Text('重新連結')),
            if (status.reconnect && !checking)
              TextButton(onPressed: onReconnect, child: const Text('重新串接')),
            if (status.recheck)
              TextButton(
                onPressed: checking ? null : onRecheck,
                child: const Text('重新檢查'),
              ),
          ]
        : const <Widget>[];
    return Card(
      child: InkWell(
        onLongPress: admin && !busy ? onDelete : null,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 4, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(platformIcon(channel.platform), color: primaryColor),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          channel.name,
                          style: theme.textTheme.titleMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          '${platformLabel(channel.platform)} · $account',
                          style: small,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  Switch(
                    value: channel.enabled,
                    onChanged: admin && !busy ? onToggle : null,
                  ),
                  if (admin)
                    PopupMenuButton<String>(
                      tooltip: '更多操作',
                      enabled: !busy,
                      onSelected: (value) {
                        if (value == 'delete') onDelete();
                      },
                      itemBuilder: (_) => const [
                        PopupMenuItem(
                          value: 'delete',
                          child: ListTile(
                            leading: Icon(
                              Icons.delete_outline,
                              color: Colors.red,
                            ),
                            title: Text('刪除'),
                          ),
                        ),
                      ],
                    )
                  else
                    const SizedBox(width: 12),
                ],
              ),
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.only(left: 36, right: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: toneColor(status.tone),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            checking ? '檢查中…' : status.text,
                            style: theme.textTheme.bodyMedium,
                          ),
                        ),
                      ],
                    ),
                    if (status.detail != null && !checking)
                      Text(status.detail!, style: small),
                    if (checkedAt != null && channel.whatsappWeb == null)
                      Text('上次檢查：${formatDateTime(checkedAt)}', style: small),
                  ],
                ),
              ),
              if (actions.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(left: 24),
                  child: Wrap(children: actions),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
