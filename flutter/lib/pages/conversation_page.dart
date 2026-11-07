import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../call_page.dart';
import '../models/app_models.dart';
import '../models/attachment_rules.dart';
import '../models/chat_source.dart';
import '../models/reply_window.dart';
import '../services/graphql_service.dart';
import '../theme/chat_colors.dart';
import '../widgets/chat/chat_add_ons.dart';
import '../widgets/chat/chat_composer.dart';
import '../widgets/chat/chat_header.dart';
import '../widgets/chat/chat_message_list.dart';
import '../widgets/chat/chat_parts.dart';
import '../widgets/chat/customer_info_sheet.dart';
import '../widgets/chat/quick_reply_sheet.dart';
import 'whatsapp_template_page.dart';

export '../widgets/chat/quick_reply_sheet.dart' show showQuickReplies;

/// One conversation, the chat room every source shares: its newest messages
/// first, older ones as the agent scrolls up (without the view jumping), new
/// ones live, and whatever was sent while the connection was down caught up on
/// afterwards, each message once.
///
/// The basic parts (header, message list, input, quick replies) are the same
/// for every source. What a source adds — files, templates, the 24-hour
/// notice, calls, disappearing messages — shows only when its capabilities
/// list it (widgets/chat/chat_add_ons.dart); nothing here checks a platform's
/// name.
class ConversationPage extends StatefulWidget {
  const ConversationPage({
    required this.graphQL,
    required this.conversation,
    super.key,
  });
  final GraphQLService graphQL;
  final ChatConversation conversation;
  @override
  State<ConversationPage> createState() => _ConversationPageState();
}

class _ConversationPageState extends State<ConversationPage> {
  static const _pageSize = 30;
  static const _catchUpPages = 10;

  final controller = TextEditingController();
  final _inputFocus = FocusNode();
  final imagePicker = ImagePicker();
  final _scroll = ScrollController();
  final _centerKey = UniqueKey();

  late ChatConversation room = widget.conversation;

  /// Messages there when the conversation opened, and older pages above them.
  /// They grow upwards, so loading older ones leaves the view where it was.
  final _older = <ChatMessage>[];

  /// Messages since, including replies still being sent. They grow downwards.
  final _newer = <ChatMessage>[];

  bool _loading = true;
  String? _loadError;
  bool _hasOlder = false;
  bool _loadingOlder = false;
  bool _loadOlderFailed = false;
  bool _catchingUp = false;
  bool _followLatest = true;
  int _unseenBelow = 0;
  String? _connectionMessage;

  PendingAttachment? pendingFile;
  String? _pickError;
  late int _disappearingSeconds;
  int _localCounter = 0;

  Timer? _clock;
  Timer? _fallbackPoll;
  AppLifecycleListener? _lifecycle;
  bool _resumed = true;
  final _subscriptions = <StreamSubscription<Object?>>[];

  ChatAddOns get _addOns => ChatAddOns(room.capabilities);

  /// Rooms of a social platform are the customers' conversations, which the
  /// server keeps unread counts for.
  bool get _isPlatformRoom => room.platform != null && room.platform != 'app';

  /// Only for sources with the reply_window capability.
  ReplyWindow? get _window => _addOns.replyWindow
      ? replyWindowOf(
          capabilities: room.capabilities,
          lastCustomerMessageAt: room.lastCustomerMessageAt,
          humanAgentAvailable: room.humanAgentAvailable,
        )
      : null;

  bool get _canWrite =>
      !room.repliesUnsupported && (_window?.canSendFreeform ?? true);

  bool get _templatesOnly =>
      _addOns.templates && (_window?.templateRequired ?? false);

  @override
  void initState() {
    super.initState();
    _disappearingSeconds = widget.conversation.disappearingMessageSeconds;
    widget.graphQL.openRoomId = room.messageRoomId;
    _loadNewest();
    _loadDisappearing();
    _subscriptions
      ..add(
        widget.graphQL.messageEvents
            .where((message) => room.holds(message))
            .listen(_onLiveMessage),
      )
      ..add(
        widget.graphQL.roomEvents
            .where((updated) => updated.id == room.id)
            .listen((updated) => setState(() => room = updated)),
      )
      ..add(widget.graphQL.reconnects.listen((_) => _catchUp()));
    _lifecycle = AppLifecycleListener(
      onResume: () {
        _resumed = true;
        _catchUp();
      },
      onHide: () => _resumed = false,
    );
    _fallbackPoll = Timer.periodic(const Duration(seconds: 15), (_) {
      if (!widget.graphQL.isLive) _catchUp();
    });
    _scheduleClock();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
    _lifecycle?.dispose();
    _clock?.cancel();
    _fallbackPoll?.cancel();
    if (widget.graphQL.openRoomId == room.messageRoomId) {
      widget.graphQL.openRoomId = null;
    }
    _scroll.dispose();
    _inputFocus.dispose();
    controller.dispose();
    super.dispose();
  }

  /// The reply notice counts down, so it is redrawn now and then.
  void _scheduleClock() {
    _clock?.cancel();
    final window = _window;
    if (window == null) return;
    _clock = Timer(noticeRefreshInterval(window), () {
      if (!mounted) return;
      setState(() {});
      _scheduleClock();
    });
  }

  // ---- Loading ----

  static int _byTimeThenId(ChatMessage a, ChatMessage b) {
    final time = a.sentAt.compareTo(b.sentAt);
    return time != 0 ? time : a.id.compareTo(b.id);
  }

  ChatMessage? get _newestStored =>
      [..._older, ..._newer].where((m) => !m.isLocal).lastOrNull;

  Future<void> _loadNewest() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final page = await widget.graphQL.fetchMessagePage(
        room,
        first: _pageSize,
      );
      if (!mounted) return;
      setState(() {
        final newest = page.messages.lastOrNull;
        // Live messages that came in meanwhile, and replies still being sent, stay.
        final live = _newer
            .where(
              (m) =>
                  m.isLocal ||
                  newest == null ||
                  _byTimeThenId(m, newest) > 0 &&
                      !page.messages.any((p) => p.id == m.id),
            )
            .toList();
        _older
          ..clear()
          ..addAll(page.messages);
        _newer
          ..clear()
          ..addAll(live);
        _hasOlder = page.hasOlder;
        _loading = false;
        _connectionMessage = null;
      });
      _markRead();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = '$error';
      });
    }
  }

  Future<void> _loadOlder() async {
    final oldest = _older.firstOrNull;
    if (!_hasOlder || _loadingOlder || oldest?.cursor == null) return;
    setState(() {
      _loadingOlder = true;
      _loadOlderFailed = false;
    });
    try {
      final page = await widget.graphQL.fetchMessagePage(
        room,
        before: oldest!.cursor,
        first: _pageSize,
      );
      if (!mounted) return;
      final known = {..._older, ..._newer}.map((m) => m.id).toSet();
      setState(() {
        _older.insertAll(
          0,
          page.messages.where((message) => !known.contains(message.id)),
        );
        _hasOlder = page.hasOlder;
      });
    } catch (_) {
      if (mounted) setState(() => _loadOlderFailed = true);
    } finally {
      if (mounted) setState(() => _loadingOlder = false);
    }
  }

  /// After the connection comes back: what was sent meanwhile, each message
  /// once. Too much missed, and the conversation starts again from its newest.
  Future<void> _catchUp() async {
    if (_catchingUp || _loading) return;
    var newest = _newestStored;
    if (newest?.cursor == null) {
      if (_older.isEmpty && _newer.every((m) => m.isLocal)) _loadNewest();
      return;
    }
    _catchingUp = true;
    try {
      for (var page = 0; page < _catchUpPages; page++) {
        final result = await widget.graphQL.fetchMessagePage(
          room,
          after: newest!.cursor,
          first: 100,
        );
        if (!mounted) return;
        result.messages.forEach(_merge);
        if (_connectionMessage != null) {
          setState(() => _connectionMessage = null);
        }
        if (!result.hasNewer) {
          if (result.messages.isNotEmpty) _markRead();
          return;
        }
        newest = result.messages.last;
      }
      _loadNewest();
    } catch (_) {
      if (mounted) {
        setState(() => _connectionMessage = '連線暫時中斷，將自動重試');
      }
    } finally {
      _catchingUp = false;
    }
  }

  /// Adds a message, or replaces the copy shown: a later copy (such as one
  /// with a delivery error) wins.
  void _merge(ChatMessage message) {
    if (message.id.isEmpty) return;
    for (final list in [_older, _newer]) {
      final index = list.indexWhere((item) => item.id == message.id);
      if (index >= 0) {
        setState(() => list[index] = message);
        return;
      }
    }
    final lastOlder = _older.lastOrNull;
    setState(() {
      if (lastOlder != null && _byTimeThenId(message, lastOlder) < 0) {
        _older
          ..add(message)
          ..sort(_byTimeThenId);
        return;
      }
      // Stored messages go before the replies still being sent.
      final firstLocal = _newer.indexWhere((m) => m.isLocal);
      final stored = firstLocal < 0 ? _newer : _newer.sublist(0, firstLocal);
      var at = stored.indexWhere((m) => _byTimeThenId(message, m) < 0);
      if (at < 0) at = stored.length;
      _newer.insert(at, message);
      if (!_followLatest) _unseenBelow++;
    });
    _keepLatestInView();
  }

  void _onLiveMessage(ChatMessage message) {
    final isNew = ![..._older, ..._newer].any((item) => item.id == message.id);
    _merge(message);
    if (!isNew) return;
    if (message.inbound) {
      setState(() {
        room = room.copyWith(lastCustomerMessageAt: message.sentAt);
      });
      _scheduleClock();
      _markRead(messageId: message.id);
    }
  }

  bool get _onScreen =>
      _resumed && mounted && (ModalRoute.of(context)?.isCurrent ?? true);

  /// What the agent has in front of them is read, for their own unread counts.
  void _markRead({String? messageId}) {
    if (!_onScreen || !_isPlatformRoom) return;
    unawaited(
      widget.graphQL
          .markConversationRead(room.id, messageId: messageId)
          .then<void>((_) {})
          .catchError((Object _) {}),
    );
  }

  // ---- Scrolling ----

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final position = _scroll.position;
    final atBottom = position.pixels >= position.maxScrollExtent - 48;
    if (atBottom != _followLatest || (atBottom && _unseenBelow > 0)) {
      setState(() {
        _followLatest = atBottom;
        if (atBottom) _unseenBelow = 0;
      });
    }
    if (position.pixels <= position.minScrollExtent + 300) _loadOlder();
  }

  /// New messages below keep the newest in view while the agent is there.
  void _keepLatestInView({bool force = false}) {
    if (!force && !_followLatest) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  void _jumpToLatest() {
    setState(() {
      _followLatest = true;
      _unseenBelow = 0;
    });
    _keepLatestInView(force: true);
  }

  // ---- Sending ----

  void _replaceLocal(String id, ChatMessage? updated) {
    final index = _newer.indexWhere((item) => item.id == id);
    if (index < 0) return;
    if (updated == null) {
      _newer.removeAt(index);
    } else {
      _newer[index] = updated;
    }
  }

  Future<void> _deliver(ChatMessage message) async {
    var current = message.copyWith(failed: false, sending: true);
    setState(() => _replaceLocal(message.id, current));
    try {
      var file = current.pending;
      if (file != null && file.uploaded == null) {
        final uploaded = await widget.graphQL.uploadAttachment(
          file,
          platform: room.platform,
        );
        file = file.withUpload(uploaded);
        current = current.copyWith(pending: file);
        if (mounted) setState(() => _replaceLocal(message.id, current));
      }
      final sent = await widget.graphQL.sendMessage(
        conversation: room,
        contents: current.text,
        attachment: file?.uploaded,
        disappearingSeconds: _addOns.disappearing ? _disappearingSeconds : 0,
      );
      if (!mounted) return;
      setState(() => _replaceLocal(message.id, null));
      if (sent != null) {
        _merge(sent);
        widget.graphQL.announceSent(sent);
      }
      _keepLatestInView(force: true);
    } on GraphQLException catch (error) {
      if (!mounted) return;
      setState(
        () => _replaceLocal(
          message.id,
          current.copyWith(
            failed: true,
            sending: false,
            sendError: error.message,
            // The file went out on its own, so only the text is left to send.
            clearPending: error.sentAttachment,
            templateRequired: error.templateRequired,
          ),
        ),
      );
      if (error.sentAttachment) _catchUp();
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _replaceLocal(
          message.id,
          current.copyWith(failed: true, sending: false, sendError: '$error'),
        ),
      );
    }
  }

  void _send() {
    final text = controller.text.trim();
    final file = pendingFile;
    if (text.isEmpty && file == null) return;
    if (!_canWrite) {
      if (_templatesOnly) _openTemplates();
      return;
    }
    final outgoing = ChatMessage(
      id: 'local-${_localCounter++}',
      text: text,
      sentAt: DateTime.now(),
      isMine: true,
      sending: true,
      pending: file,
      roomId: room.messageRoomId,
      channelId: room.channelId,
    );
    setState(() {
      _newer.add(outgoing);
      controller.clear();
      pendingFile = null;
      _pickError = null;
    });
    _keepLatestInView(force: true);
    _deliver(outgoing);
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    // Enter sends and Shift+Enter starts a new line on a hardware keyboard, as on
    // the admin site; while choosing characters, Enter confirms them instead.
    if (event is! KeyDownEvent ||
        event.logicalKey != LogicalKeyboardKey.enter ||
        HardwareKeyboard.instance.isShiftPressed ||
        controller.value.composing.isValid) {
      return KeyEventResult.ignored;
    }
    _send();
    return KeyEventResult.handled;
  }

  void _onTextChanged(String value) {
    // A / in an empty box is the shortcut for quick replies.
    if (value == '/' && _canWrite) {
      controller.clear();
      _openQuickReplies();
    }
  }

  void _insertText(String text) {
    final value = controller.value;
    final selection = value.selection.isValid
        ? value.selection
        : TextSelection.collapsed(offset: value.text.length);
    final updated = value.text.replaceRange(
      selection.start,
      selection.end,
      text,
    );
    controller.value = TextEditingValue(
      text: updated,
      selection: TextSelection.collapsed(offset: selection.start + text.length),
    );
    _inputFocus.requestFocus();
  }

  Future<void> _openQuickReplies() async {
    final text = await showQuickReplies(
      context,
      graphQL: widget.graphQL,
      platform: room.platform,
    );
    if (text != null && mounted) _insertText(text);
  }

  Future<void> _openTemplates() async {
    if (!_addOns.templates) return;
    final sent = await Navigator.of(context).push<ChatMessage>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) =>
            WhatsappTemplatePage(graphQL: widget.graphQL, conversation: room),
      ),
    );
    if (sent == null || !mounted) return;
    setState(() {
      // A reply that needed a template is replaced by the template.
      _newer.removeWhere((m) => m.isLocal && m.failed && m.templateRequired);
    });
    _merge(sent);
    widget.graphQL.announceSent(sent);
    _keepLatestInView(force: true);
  }

  // ---- Attachments ----

  Future<void> _attach({
    required String name,
    required Future<Uint8List> Function() read,
    String? mime,
  }) async {
    final check = checkAttachment(room.platform, mime: mime, filename: name);
    if (!check.ok) {
      setState(() => _pickError = '無法附加「$name」：${check.reason}');
      return;
    }
    final bytes = await read();
    final sized = checkAttachment(
      room.platform,
      mime: check.mime,
      filename: name,
      size: bytes.length,
    );
    if (!mounted) return;
    if (!sized.ok) {
      setState(() => _pickError = '無法附加「$name」：${sized.reason}');
      return;
    }
    if (!room.capabilities.canSendKind(sized.kind!)) {
      setState(
        () => _pickError =
            '無法附加「$name」：${sourceLabel(room.source)} 不能傳送${kindLabel(sized.kind!)}',
      );
      return;
    }
    setState(() {
      _pickError = null;
      pendingFile = PendingAttachment(
        name: name,
        bytes: bytes,
        mime: sized.mime!,
        kind: sized.kind!,
      );
    });
  }

  Future<void> _pickMedia(Future<XFile?> Function() pick) async {
    final file = await pick();
    if (file == null) return;
    await _attach(name: file.name, mime: file.mimeType, read: file.readAsBytes);
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: allowedExtensions,
      withData: true,
    );
    final file = result?.files.singleOrNull;
    if (file == null) return;
    await _attach(
      name: file.name,
      read: () async => file.bytes ?? await XFile(file.path!).readAsBytes(),
    );
  }

  /// The ＋ panel: quick replies for every source, and what the source adds.
  List<SendOption> get _sendOptions {
    final addOns = _addOns;
    return [
      if (addOns.photos)
        SendOption(
          icon: Icons.image_outlined,
          label: '相片',
          addOn: true,
          // Re-encoded as JPEG, which every platform takes, and kept small.
          onTap: () => _pickMedia(
            () => imagePicker.pickImage(
              source: ImageSource.gallery,
              imageQuality: 85,
              maxWidth: 2560,
              maxHeight: 2560,
            ),
          ),
        ),
      if (addOns.videos)
        SendOption(
          icon: Icons.videocam_outlined,
          label: '影片',
          addOn: true,
          onTap: () => _pickMedia(
            () => imagePicker.pickVideo(source: ImageSource.gallery),
          ),
        ),
      if (addOns.files)
        SendOption(
          icon: Icons.attach_file_rounded,
          label: '檔案',
          addOn: true,
          onTap: _pickFile,
        ),
      SendOption(
        icon: Icons.bolt_outlined,
        label: '快速回覆',
        onTap: _openQuickReplies,
      ),
      if (addOns.templates)
        SendOption(
          icon: Icons.description_outlined,
          label: '範本',
          addOn: true,
          onTap: _openTemplates,
        ),
    ];
  }

  Future<void> _openAttachment(String url) async {
    final opened = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );
    if (!opened && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('無法開啟附件')));
    }
  }

  // ---- Add-ons: calls and the room's settings ----

  String get _disappearingKey => 'room_disappearing_${room.messageRoomId}';

  // The backend applies this per message, so the choice is kept on the device.
  Future<void> _loadDisappearing() async {
    if (!_addOns.disappearing) return;
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getInt(_disappearingKey);
    if (saved != null && mounted) {
      setState(() => _disappearingSeconds = saved);
    }
  }

  Future<void> _showChatSettings() async {
    final seconds = await showChatSettings(
      context,
      addOns: _addOns,
      disappearingSeconds: _disappearingSeconds,
    );
    if (seconds == null || !mounted) return;
    setState(() => _disappearingSeconds = seconds);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_disappearingKey, seconds);
  }

  Future<void> _startCall(String kind) async {
    CallSession? call;
    try {
      call = await widget.graphQL.startCall(
        conversationId: room.id,
        kind: kind,
      );
      final token = await widget.graphQL.fetchLiveKitToken(callId: call.id);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) =>
              CallPage(graphQL: widget.graphQL, call: call!, token: token),
        ),
      );
    } catch (error) {
      // A call that never connected shouldn't stay open on the server.
      if (call != null) {
        unawaited(widget.graphQL.reportCallEvent(call.id, 'call.ended'));
      }
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
      }
    }
  }

  List<Widget> get _headerActions {
    final addOns = _addOns;
    return [
      if (addOns.calls) ...[
        IconButton(
          onPressed: () => _startCall('voice'),
          tooltip: '語音通話',
          icon: const Icon(Icons.call_outlined),
        ),
        IconButton(
          onPressed: () => _startCall('video'),
          tooltip: '視訊通話',
          icon: const Icon(Icons.videocam_outlined),
        ),
      ],
      if (addOns.settings)
        IconButton(
          onPressed: _showChatSettings,
          tooltip: '聊天室設定',
          icon: const Icon(Icons.more_vert_rounded),
        ),
    ];
  }

  // ---- Drawing ----

  Widget _messages() {
    final colors = context.chat;
    if (_loading && _older.isEmpty && _newer.isEmpty) {
      return ColoredBox(
        color: colors.surfaceChat,
        child: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_older.isEmpty && _newer.isEmpty) {
      return ColoredBox(
        color: colors.surfaceChat,
        child: Center(
          child: SingleChildScrollView(
            child: _loadError != null
                ? ChatEmptyState(
                    icon: Icons.cloud_off_outlined,
                    tone: EmptyTone.alert,
                    title: '訊息載入失敗',
                    detail: _loadError,
                    actionLabel: '重試',
                    onAction: _loadNewest,
                  )
                : const ChatEmptyState(
                    icon: Icons.forum_outlined,
                    title: '尚無訊息',
                  ),
          ),
        ),
      );
    }
    final window = _window;
    final passed =
        window != null &&
        (window.state == ReplyState.closed ||
            window.state == ReplyState.humanAgent);
    return ChatMessageList(
      older: _older,
      newer: _newer,
      controller: _scroll,
      centerKey: _centerKey,
      onOpenAttachment: _openAttachment,
      onRetry: _deliver,
      onUseTemplate: _addOns.templates ? _openTemplates : null,
      hasOlder: _hasOlder,
      loadingOlder: _loadingOlder,
      loadOlderFailed: _loadOlderFailed,
      onLoadOlder: _loadOlder,
      unseenBelow: _unseenBelow,
      onJumpToLatest: _jumpToLatest,
      endEvent: passed ? '24 小時回覆期限已過' : null,
    );
  }

  /// What sits above the input: the connection, the reply window, and why
  /// replying here isn't possible at all.
  List<Widget> _notices() {
    final window = _window;
    return [
      if (_connectionMessage != null)
        NoticeBar(kind: NoticeKind.connection, text: _connectionMessage!),
      if (room.repliesUnsupported)
        NoticeBar(
          kind: NoticeKind.platformRule,
          text: '目前還不支援回覆 ${sourceLabel(room.source)} 的訊息',
        )
      else if (window != null && noticeWorthShowing(replyNotice(window)))
        ReplyWindowNotice(window: window, onTemplates: _openTemplates),
      if (_addOns.disappearing && _disappearingSeconds > 0)
        NoticeBar(
          kind: NoticeKind.permission,
          text: '消失訊息：${disappearingLabel(_disappearingSeconds)}',
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    final canWrite = _canWrite;
    final templatesOnly = _templatesOnly;
    return Scaffold(
      backgroundColor: colors.surfaceChat,
      appBar: ChatHeader(
        room: room,
        onCustomerInfo: room.platform != null
            ? () => showCustomerInfo(context, room)
            : null,
        actions: _headerActions,
      ),
      body: Column(
        children: [
          if (_isPlatformRoom)
            AssigneeStrip(room: room, myId: widget.graphQL.accountId),
          Expanded(child: _messages()),
          ..._notices(),
          ChatComposer(
            controller: controller,
            focusNode: _inputFocus,
            enabled: canWrite,
            templatesOnly: templatesOnly,
            onTemplates: _openTemplates,
            hint: templatesOnly
                ? '只能傳送範本'
                : room.repliesUnsupported
                ? '目前無法回覆這個來源的訊息'
                : '訊息',
            onChanged: _onTextChanged,
            onKeyEvent: _onKey,
            onSend: _send,
            onPlus: () => showSendOptions(context, options: _sendOptions),
            pendingFile: pendingFile,
            onRemovePending: () => setState(() => pendingFile = null),
            pickError: _pickError,
            onDismissError: () => setState(() => _pickError = null),
          ),
        ],
      ),
    );
  }
}
