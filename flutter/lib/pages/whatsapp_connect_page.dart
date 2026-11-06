import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/app_models.dart';
import '../services/graphql_service.dart';
import '../widgets/common.dart';

/// What happened in [WhatsappConnectPage], for the channel list.
class WhatsappConnectResult {
  const WhatsappConnectResult({
    this.changed = false,
    this.done = false,
    this.name,
  });

  /// A phone connected, so the list should be read again.
  final bool changed;

  /// The admin finished: named the new channel, or a number connected again.
  final bool done;

  /// The new channel's name.
  final String? name;
}

/// Connects a WhatsApp number through whatsapp-gateway: a new channel, or
/// connecting [channel] again. On a phone the number itself is linked with a
/// pairing code; the QR code is for linking another phone.
/// Steps: code → copying chats → naming the channel and choosing its agents.
class WhatsappConnectPage extends StatefulWidget {
  const WhatsappConnectPage({
    required this.graphQL,
    this.channel,
    this.pollInterval = const Duration(milliseconds: 2500),
    super.key,
  });
  final GraphQLService graphQL;

  /// Connecting this channel again; null connects a new number.
  final SocialChannel? channel;

  /// WhatsApp offers a new QR code about every 20 seconds; asking more often
  /// keeps the shown one current.
  final Duration pollInterval;

  @override
  State<WhatsappConnectPage> createState() => _WhatsappConnectPageState();
}

class _WhatsappConnectPageState extends State<WhatsappConnectPage>
    with WidgetsBindingObserver {
  WhatsappWebConnection? connection;
  String? error;
  String? channelId;
  Timer? _timer;
  bool _asking = false;
  bool _named = false;
  bool _closing = false;

  late final phoneController = TextEditingController(
    text: _digits(
      widget.channel?.whatsappWeb?.phone ?? widget.channel?.phone ?? '',
    ),
  );
  String? pairingCode;
  bool requestingCode = false;

  late final nameController = TextEditingController(
    text: widget.channel?.name ?? '',
  );
  List<ChannelAgent> agents = const [];
  final chosenAgents = <String>{};
  bool saving = false;

  bool get reconnecting => widget.channel != null;

  static String _digits(String value) => value.replaceAll(RegExp(r'\D'), '');

  @override
  void initState() {
    super.initState();
    channelId = widget.channel?.id;
    WidgetsBinding.instance.addObserver(this);
    phoneController.addListener(() => setState(() {}));
    _start();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    phoneController.dispose();
    nameController.dispose();
    super.dispose();
  }

  // Typing the code happens in WhatsApp, so look at once on coming back.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _poll();
  }

  void _notify(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));

  Future<void> _start() async {
    _timer?.cancel();
    setState(() {
      error = null;
      connection = null;
      pairingCode = null;
    });
    try {
      final started = await widget.graphQL.connectWhatsappWeb(
        channelId: widget.channel?.id,
      );
      if (!mounted) return;
      channelId = started.channelId.isEmpty ? channelId : started.channelId;
      _show(started);
      _timer = Timer.periodic(widget.pollInterval, (_) => _poll());
    } catch (failure) {
      if (mounted) setState(() => error = '$failure');
    }
  }

  // Asks until the number is fully synced, or the attempt failed and needs a
  // new start.
  bool get _polling {
    final current = connection;
    return channelId != null &&
        current != null &&
        !current.failed &&
        current.state != 'ready';
  }

  Future<void> _poll() async {
    if (!_polling || _asking || _closing) return;
    _asking = true;
    try {
      final latest = await widget.graphQL.whatsappWebConnection(channelId!);
      if (mounted && !_closing) _show(latest);
    } catch (_) {
      // The next tick asks again.
    } finally {
      _asking = false;
    }
  }

  void _show(WhatsappWebConnection latest) {
    setState(() {
      // A code is only good for the attempt it was asked in.
      if (latest.state != 'qr' && latest.state != 'authenticated') {
        pairingCode = null;
      }
      connection = latest;
    });
    if (!_polling) _timer?.cancel();
    // Once a phone connects, suggest its WhatsApp name and load who could
    // work in the channel.
    if (!reconnecting && !_named && latest.connected) {
      _named = true;
      if (nameController.text.trim().isEmpty) {
        nameController.text = latest.name ?? latest.phone ?? '';
      }
      widget.graphQL
          .fetchChannelAgents()
          .then((value) {
            if (mounted) setState(() => agents = value);
          })
          .catchError((_) {});
    }
  }

  Future<void> _close() async {
    if (_closing) return;
    _closing = true;
    _timer?.cancel();
    final current = connection;
    // Leaving before any phone connected removes the new channel, so the list
    // doesn't fill with empty ones.
    if (!reconnecting &&
        channelId != null &&
        (current == null || current.waiting || current.failed)) {
      try {
        await widget.graphQL.cancelWhatsappWeb(channelId!);
      } catch (_) {
        // The backend drops abandoned attempts by itself.
      }
    }
    if (!mounted) return;
    Navigator.of(context).pop(
      WhatsappConnectResult(
        changed: channelId != null && current != null && !current.waiting,
      ),
    );
  }

  Future<void> _requestCode() async {
    final id = channelId;
    if (id == null) return;
    setState(() {
      requestingCode = true;
      pairingCode = null;
    });
    try {
      final code = await widget.graphQL.requestWhatsappWebPairingCode(
        id,
        _digits(phoneController.text),
      );
      if (mounted) setState(() => pairingCode = code);
    } catch (failure) {
      if (mounted) _notify('無法取得配對碼：$failure');
    } finally {
      if (mounted) setState(() => requestingCode = false);
    }
  }

  Future<void> _finish() async {
    if (reconnecting) {
      _timer?.cancel();
      Navigator.of(context)
          .pop(const WhatsappConnectResult(changed: true, done: true));
      return;
    }
    final name = nameController.text.trim();
    if (name.isEmpty) {
      _notify('請輸入社群名稱');
      return;
    }
    setState(() => saving = true);
    try {
      final saved = await widget.graphQL.updateWhatsappWebChannel(
        channelId!,
        name: name,
        agentIds: chosenAgents.toList(),
      );
      if (!mounted) return;
      _timer?.cancel();
      Navigator.of(context)
          .pop(WhatsappConnectResult(changed: true, done: true, name: saved));
    } catch (failure) {
      if (mounted) {
        setState(() => saving = false);
        _notify('無法儲存：$failure');
      }
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) _close();
    },
    child: Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: '取消',
          icon: const Icon(Icons.close),
          onPressed: _close,
        ),
        title: Text(
          reconnecting ? '重新連結「${widget.channel!.name}」' : '連結 WhatsApp',
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: _body(),
        ),
      ),
    ),
  );

  List<Widget> _body() {
    final current = connection;
    if (error != null) {
      return [
        _Centered(
          children: [
            Text(error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 12),
            FilledButton(onPressed: _start, child: const Text('再試一次')),
          ],
        ),
      ];
    }
    if (current == null || current.state == 'starting') {
      return const [
        _Centered(
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 12),
            Text('正在準備連結…'),
          ],
        ),
      ];
    }
    if (current.state == 'authenticated') {
      return const [
        _Centered(
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 12),
            Text('已確認，正在登入…'),
          ],
        ),
      ];
    }
    if (current.state == 'qr') return _waiting(current);
    if (current.failed) {
      return [
        _Centered(
          children: [
            Text(
              current.error ??
                  (current.state == 'qr_timeout' ? '配對碼與 QR 碼已過期' : '連結失敗'),
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.red),
            ),
            const SizedBox(height: 12),
            FilledButton(onPressed: _start, child: const Text('重新開始')),
          ],
        ),
      ];
    }
    return _connected(current);
  }

  List<Widget> _waiting(WhatsappWebConnection current) {
    final theme = Theme.of(context);
    final originalPhone = widget.channel?.whatsappWeb?.phone;
    final canAsk = !requestingCode && _digits(phoneController.text).length >= 8;
    return [
      Text('用電話號碼連結', style: theme.textTheme.titleMedium),
      const SizedBox(height: 4),
      const Text('在這支手機上就能完成，不用掃描。'),
      const SizedBox(height: 12),
      TextField(
        key: const Key('pairing-phone'),
        controller: phoneController,
        keyboardType: TextInputType.phone,
        enabled: originalPhone == null,
        decoration: const InputDecoration(
          labelText: '含國碼的電話號碼',
          hintText: '例：886912345678',
        ),
      ),
      const SizedBox(height: 12),
      FilledButton(
        onPressed: canAsk ? _requestCode : null,
        child: Text(requestingCode ? '取得中…' : '取得配對碼'),
      ),
      if (pairingCode != null) ...[
        const SizedBox(height: 16),
        _PairingCode(code: pairingCode!),
      ],
      const SizedBox(height: 16),
      const _Steps(
        steps: [
          '開啟 WhatsApp，點「設定」→「已連結的裝置」',
          '點「連結裝置」，再點畫面下方的「改用電話號碼連結」',
          '輸入上方的 8 碼配對碼',
        ],
      ),
      const SizedBox(height: 12),
      _Note(
        lines: [
          '手機需保持連網；超過 14 天未開啟 WhatsApp，連結會自動失效。',
          if (originalPhone != null) '只能連結原本的號碼 $originalPhone。',
          '群組對話不會同步。',
        ],
      ),
      const SizedBox(height: 8),
      Card(
        child: ExpansionTile(
          leading: const Icon(Icons.qr_code_2),
          title: const Text('用另一支手機掃描 QR 碼'),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            const _Steps(
              steps: [
                '在要連結的手機上開啟 WhatsApp',
                '點「設定」→「已連結的裝置」→「連結裝置」',
                '用那支手機掃描下方的 QR 碼',
              ],
            ),
            const SizedBox(height: 12),
            _QrImage(dataUrl: current.qr),
            const SizedBox(height: 8),
            Text(
              '等待掃描… QR 碼會自動更新',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      ),
    ];
  }

  List<Widget> _connected(WhatsappWebConnection current) {
    final theme = Theme.of(context);
    final ready = current.state == 'ready';
    final choosable = agents.where((agent) => !agent.isAdmin).toList();
    return [
      Card(
        child: ListTile(
          leading: const Icon(
            Icons.phone_in_talk_outlined,
            color: primaryColor,
          ),
          title: Text(current.name ?? 'WhatsApp'),
          subtitle: Text(current.phone ?? ''),
          trailing: Chip(label: Text(ready ? '已連結' : '同步中')),
        ),
      ),
      const SizedBox(height: 8),
      _Progress(connection: current),
      if (!reconnecting) ...[
        const SizedBox(height: 16),
        TextField(
          key: const Key('channel-name'),
          controller: nameController,
          maxLength: 100,
          decoration: const InputDecoration(labelText: '社群名稱'),
        ),
        if (choosable.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text('指定專員', style: theme.textTheme.titleSmall),
          for (final agent in choosable)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: chosenAgents.contains(agent.id),
              title: Text(agent.name),
              onChanged: (value) => setState(
                () => value == true
                    ? chosenAgents.add(agent.id)
                    : chosenAgents.remove(agent.id),
              ),
            ),
          Text('管理員可以看到所有頻道，不需要指定。', style: theme.textTheme.bodySmall),
        ],
      ],
      const SizedBox(height: 16),
      if (!ready)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            '聊天記錄會在背景繼續同步',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall,
          ),
        ),
      FilledButton(
        onPressed: saving ? null : _finish,
        child: Text(saving ? '儲存中…' : '完成'),
      ),
    ];
  }
}

class _Centered extends StatelessWidget {
  const _Centered({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 48),
    child: Column(children: children),
  );
}

class _Steps extends StatelessWidget {
  const _Steps({required this.steps});
  final List<String> steps;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      for (final (index, step) in steps.indexed)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 11,
                backgroundColor: primaryColor,
                child: Text(
                  '${index + 1}',
                  style: const TextStyle(fontSize: 12, color: Colors.white),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(child: Text(step)),
            ],
          ),
        ),
    ],
  );
}

class _Note extends StatelessWidget {
  const _Note({required this.lines});
  final List<String> lines;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: primaryColor.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('請注意', style: TextStyle(fontWeight: FontWeight.bold)),
        for (final line in lines) Text(line),
      ],
    ),
  );
}

/// The code to type on the phone, shown as WhatsApp does: ABCD-EFGH.
class _PairingCode extends StatelessWidget {
  const _PairingCode({required this.code});
  final String code;

  String get shown {
    final plain = code.replaceAll('-', '');
    return plain.length == 8
        ? '${plain.substring(0, 4)}-${plain.substring(4)}'
        : code;
  }

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          const Text('配對碼'),
          const SizedBox(height: 4),
          SelectableText(
            shown,
            style: Theme.of(context).textTheme.headlineMedium
                ?.copyWith(fontWeight: FontWeight.bold, letterSpacing: 4),
          ),
          TextButton.icon(
            icon: const Icon(Icons.copy, size: 18),
            label: const Text('複製'),
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              await Clipboard.setData(
                ClipboardData(text: code.replaceAll('-', '')),
              );
              messenger.showSnackBar(const SnackBar(content: Text('已複製配對碼')));
            },
          ),
        ],
      ),
    ),
  );
}

class _QrImage extends StatelessWidget {
  const _QrImage({required this.dataUrl});
  final String? dataUrl;

  @override
  Widget build(BuildContext context) {
    final bytes = () {
      final value = dataUrl;
      if (value == null) return null;
      try {
        return UriData.parse(value).contentAsBytes();
      } on FormatException {
        try {
          return base64Decode(value);
        } on FormatException {
          return null;
        }
      }
    }();
    return Center(
      child: SizedBox.square(
        dimension: 240,
        child: bytes == null
            ? const Center(child: CircularProgressIndicator())
            : Image.memory(
                bytes,
                gaplessPlayback: true,
                semanticLabel: 'WhatsApp 連結用 QR 碼',
                errorBuilder: (_, _, _) =>
                    const Center(child: Text('無法顯示 QR 碼')),
              ),
      ),
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.connection});
  final WhatsappWebConnection connection;

  @override
  Widget build(BuildContext context) {
    final progress = connection.progress ?? const WhatsappWebProgress();
    final done = connection.state == 'ready';
    final percent = progress.percent ?? 0;
    Widget step(String label, bool finished, {String? note, Widget? extra}) =>
        ListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          leading: Icon(
            finished ? Icons.check_circle : Icons.radio_button_unchecked,
            color: finished ? Colors.green : null,
          ),
          title: Text(label),
          subtitle: extra,
          trailing: note == null ? null : Text(note),
        );
    return Column(
      children: [
        step('連結裝置', true),
        step(
          '讀取聊天列表',
          done || progress.chatsTotal > 0,
          note: progress.chatsTotal > 0 ? '${progress.chatsTotal} 個對話' : null,
        ),
        step(
          '同步聊天記錄（最近一年）',
          done,
          note: done ? null : '$percent%',
          extra: done ? null : LinearProgressIndicator(value: percent / 100),
        ),
        step('開始接收新訊息', done, note: done ? null : '等待中'),
      ],
    );
  }
}
