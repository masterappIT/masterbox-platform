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
import '../models/reply_window.dart';
import '../services/graphql_service.dart';
import '../widgets/common.dart';
import 'whatsapp_template_page.dart';

/// Platforms whose conversations can be answered from MasterBox.
const _replyPlatforms = ['fb', 'ig', 'whatsapp'];

/// One conversation: its newest messages first, older ones as the agent
/// scrolls up (without the view jumping), new ones live, and whatever was sent
/// while the connection was down caught up on afterwards, each message once.
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

  bool get _canReplyHere => _replyPlatforms.contains(room.platform);
  bool get _isWhatsapp => room.platform == 'whatsapp';

  /// Rooms of a social platform follow Meta's rules; the rest only the app's.
  bool get _isPlatformRoom => room.platform != null && room.platform != 'app';

  ReplyWindow? get _window => _isPlatformRoom
      ? replyWindowOf(
          platform: room.platform,
          lastCustomerMessageAt: room.lastCustomerMessageAt,
          humanAgentAvailable: room.humanAgentAvailable,
        )
      : null;

  bool get _canWrite => _window?.canSendFreeform ?? true;

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
        disappearingSeconds: _isPlatformRoom ? 0 : _disappearingSeconds,
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
      if (_isWhatsapp) _openTemplates();
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

  Future<void> _showAttachmentOptions() async {
    // Say so straight away rather than letting the agent pick a file that can't go.
    final supported = checkAttachment(room.platform, mime: 'application/pdf');
    if (!supported.ok && supported.reason!.contains('尚未支援')) {
      setState(() => _pickError = supported.reason);
      return;
    }
    Future<void> pickMedia(Future<XFile?> Function() pick) async {
      final navigator = Navigator.of(context);
      final file = await pick();
      navigator.pop();
      if (file == null) return;
      await _attach(
        name: file.name,
        mime: file.mimeType,
        read: file.readAsBytes,
      );
    }

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.attach_file),
              title: const Text('新增附件'),
              subtitle: Text(
                '會傳給客戶。${platformLabel(room.platform)} 的限制會在選擇後檢查',
              ),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('選擇圖片'),
              // Re-encoded as JPEG, which every platform takes, and kept small.
              onTap: () => pickMedia(
                () => imagePicker.pickImage(
                  source: ImageSource.gallery,
                  imageQuality: 85,
                  maxWidth: 2560,
                  maxHeight: 2560,
                ),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.video_library_outlined),
              title: const Text('選擇影片'),
              onTap: () => pickMedia(
                () => imagePicker.pickVideo(source: ImageSource.gallery),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.insert_drive_file_outlined),
              title: const Text('選擇檔案'),
              onTap: () async {
                final navigator = Navigator.of(context);
                final result = await FilePicker.platform.pickFiles(
                  type: FileType.custom,
                  allowedExtensions: allowedExtensions,
                  withData: true,
                );
                navigator.pop();
                final file = result?.files.singleOrNull;
                if (file == null) return;
                await _attach(
                  name: file.name,
                  read: () async =>
                      file.bytes ?? await XFile(file.path!).readAsBytes(),
                );
              },
            ),
          ],
        ),
      ),
    );
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

  // ---- Settings, customer, calls ----

  String get _disappearingKey => 'room_disappearing_${room.messageRoomId}';

  // The backend applies this per message, so the choice is kept on the device.
  Future<void> _loadDisappearing() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getInt(_disappearingKey);
    if (saved != null && mounted) {
      setState(() => _disappearingSeconds = saved);
    }
  }

  void _showCustomerInfo() {
    final customer = room.customer;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              PersonAvatar(
                name: room.title,
                imageUrl: customer?.avatarUrl,
                radius: 36,
              ),
              const SizedBox(height: 10),
              Text(
                room.title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              ListTile(
                leading: Icon(platformIcon(room.platform), color: primaryColor),
                title: const Text('社群平台'),
                subtitle: Text(platformLabel(room.platform)),
              ),
              if (room.channelName?.isNotEmpty == true)
                ListTile(
                  leading: const Icon(Icons.hub_outlined, color: primaryColor),
                  title: const Text('頻道'),
                  subtitle: Text(room.channelName!),
                ),
              if (customer != null)
                ListTile(
                  leading: const Icon(
                    Icons.badge_outlined,
                    color: primaryColor,
                  ),
                  title: const Text('帳號ID'),
                  subtitle: Text(customer.id),
                ),
              ListTile(
                leading: const Icon(
                  Icons.support_agent_outlined,
                  color: primaryColor,
                ),
                title: const Text('負責人'),
                subtitle: Text(room.assignee?.name ?? '未指派'),
              ),
              if (room.tags.isNotEmpty)
                ListTile(
                  leading: const Icon(Icons.sell_outlined, color: primaryColor),
                  title: const Text('標籤'),
                  subtitle: Text(room.tags.join('、')),
                ),
              ListTile(
                leading: const Icon(Icons.schedule, color: primaryColor),
                title: const Text('最後互動時間'),
                subtitle: Text(
                  formatDateTime(room.lastMessageAt ?? room.updatedAt),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Customers on a social platform have no way to join, so say so first.
  Future<bool> _confirmInternalCall() async {
    final platform = room.platform;
    if (platform == null) return true;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('這是 MasterBox 內部通話'),
        content: Text('客戶無法從 ${platformLabel(platform)} 加入，也不會收到來電。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('繼續'),
          ),
        ],
      ),
    );
    return confirmed == true;
  }

  Future<void> _startCall(String kind) async {
    if (!await _confirmInternalCall()) return;
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

  Future<void> _showChatSettings() async {
    var seconds = _disappearingSeconds;
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
                DropdownButtonFormField<int>(
                  initialValue: disappearingOptions.contains(seconds)
                      ? seconds
                      : 0,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: '消失訊息',
                    helperText: _isPlatformRoom
                        ? '傳給客戶的訊息會留在 ${platformLabel(room.platform)}，'
                              '無法設定消失訊息。'
                        : '訊息顯示後開始倒數，時間到就不再顯示。',
                    helperMaxLines: 3,
                  ),
                  items: disappearingOptions
                      .map(
                        (item) => DropdownMenuItem(
                          value: item,
                          child: Text(
                            item == 0 ? '關閉' : '${disappearingLabel(item)}後刪除',
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _isPlatformRoom
                      ? null
                      : (value) =>
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
    if (saved == true && mounted) {
      setState(() => _disappearingSeconds = seconds);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_disappearingKey, seconds);
    }
  }

  // ---- Drawing ----

  Widget _attachmentView(MessageAttachment attachment) {
    final url = attachment.safeUrl;
    final fallback = Text(
      '[${attachment.label}'
      '${attachment.filename == null ? '' : '：${attachment.filename}'}]'
      '${attachment.caption == null ? '' : ' ${attachment.caption}'}',
    );
    if (url == null) return fallback;
    if (attachment.isImage) {
      return GestureDetector(
        onTap: () => _openAttachment(url),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(6),
          // Stickers keep their own size, so a small one stays sharp.
          child: ConstrainedBox(
            constraints: attachment.isSticker
                ? const BoxConstraints(maxWidth: 120, maxHeight: 120)
                : const BoxConstraints(),
            child: Image.network(
              url,
              width: attachment.isSticker ? null : 220,
              fit: attachment.isSticker ? BoxFit.contain : BoxFit.cover,
              webHtmlElementStrategy: WebHtmlElementStrategy.fallback,
              // Meta's attachment links expire.
              errorBuilder: (_, _, _) => fallback,
            ),
          ),
        ),
      );
    }
    return TextButton.icon(
      onPressed: () => _openAttachment(url),
      icon: Icon(switch (attachment.type) {
        'video' => Icons.play_circle_outline,
        'audio' => Icons.audiotrack,
        _ => Icons.insert_drive_file_outlined,
      }),
      label: Text(
        attachment.filename ?? '查看${attachment.label}',
        overflow: TextOverflow.ellipsis,
      ),
    );
  }

  Widget _pendingView(PendingAttachment file, {bool compact = false}) {
    final thumb = file.kind == 'image'
        ? ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: Image.memory(
              Uint8List.fromList(file.bytes),
              width: compact ? 120 : 48,
              height: compact ? null : 48,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => const Icon(Icons.image_outlined),
            ),
          )
        : Icon(switch (file.kind) {
            'video' => Icons.movie_outlined,
            'audio' => Icons.audiotrack,
            _ => Icons.insert_drive_file_outlined,
          });
    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          thumb,
          Text(
            '${file.name}（${formatFileSize(file.size)}）',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      );
    }
    return Card(
      child: ListTile(
        leading: thumb,
        title: Text(file.name, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text('${formatFileSize(file.size)}・送出時上傳並傳給客戶'),
        trailing: IconButton(
          tooltip: '移除附件',
          icon: const Icon(Icons.close),
          onPressed: () => setState(() => pendingFile = null),
        ),
      ),
    );
  }

  Widget _bubble(ChatMessage message) {
    final theme = Theme.of(context);
    return Align(
      alignment: message.isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: message.failed ? () => _deliver(message) : null,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.8,
          ),
          child: Card(
            color: message.failed
                ? Colors.red.withValues(alpha: 0.15)
                : (message.isMine
                      ? primaryColor.withValues(alpha: 0.2)
                      : theme.colorScheme.surfaceContainerHighest),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (message.pending != null)
                    _pendingView(message.pending!, compact: true),
                  if (message.text.isNotEmpty ||
                      (message.attachments.isEmpty && message.pending == null))
                    Text(message.text.isEmpty ? '附件' : message.text),
                  for (final attachment in message.attachments)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: _attachmentView(attachment),
                    ),
                  if (message.sending)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SizedBox(
                            width: 12,
                            height: 12,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            message.pending != null &&
                                    message.pending!.uploaded == null
                                ? '上傳中…'
                                : '傳送中…',
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  if (message.deliveryError != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        '未送達：${message.deliveryError}',
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    ),
                  if (message.failed && message.sendError != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        message.sendError!.startsWith('附件已送出')
                            ? message.sendError!
                            : '訊息未送出：${message.sendError}',
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    ),
                  if (!message.sending && !message.failed)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        formatTime(message.sentAt),
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                  if (message.failed && message.templateRequired && _isWhatsapp)
                    TextButton(
                      onPressed: _openTemplates,
                      child: const Text('使用範本發送'),
                    )
                  else if (message.failed)
                    TextButton(
                      onPressed: () => _deliver(message),
                      child: const Text('重試'),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _messages() {
    if (_loading && _older.isEmpty && _newer.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_loadError != null && _older.isEmpty && _newer.isEmpty) {
      return ErrorRetry(message: _loadError!, onRetry: _loadNewest);
    }
    if (_older.isEmpty && _newer.isEmpty) {
      return const EmptyState(icon: Icons.forum_outlined, message: '尚無訊息');
    }
    final top = _hasOlder
        ? Padding(
            padding: const EdgeInsets.all(8),
            child: Center(
              child: _loadOlderFailed
                  ? TextButton.icon(
                      onPressed: _loadOlder,
                      icon: const Icon(Icons.refresh),
                      label: const Text('較舊的訊息載入失敗，點此重試'),
                    )
                  : TextButton(
                      onPressed: _loadingOlder ? null : _loadOlder,
                      child: Text(_loadingOlder ? '載入較舊的訊息…' : '載入較舊的訊息'),
                    ),
            ),
          )
        : const SizedBox(height: 8);
    return Stack(
      children: [
        CustomScrollView(
          controller: _scroll,
          center: _centerKey,
          // Messages there when it opened end at the bottom; older ones go up,
          // newer ones down, so neither moves what the agent is reading.
          anchor: 1,
          slivers: [
            SliverToBoxAdapter(child: top),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverList.builder(
                itemCount: _older.length,
                // Before the centre, items are laid out upwards: newest first.
                itemBuilder: (_, i) => _bubble(_older[_older.length - 1 - i]),
              ),
            ),
            SliverPadding(
              key: _centerKey,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              sliver: SliverList.builder(
                itemCount: _newer.length,
                itemBuilder: (_, i) => _bubble(_newer[i]),
              ),
            ),
          ],
        ),
        if (_unseenBelow > 0)
          Positioned(
            bottom: 12,
            left: 0,
            right: 0,
            child: Center(
              child: FilledButton.tonalIcon(
                onPressed: _jumpToLatest,
                icon: const Icon(Icons.arrow_downward),
                label: Text('$_unseenBelow 則新訊息'),
              ),
            ),
          ),
      ],
    );
  }

  Widget _notice(ReplyWindow window) {
    final notice = replyNotice(window, room.platform);
    final (
      Color background,
      Color foreground,
      IconData icon,
    ) = switch (notice.tone) {
      NoticeTone.info => (
        Colors.green.withValues(alpha: 0.12),
        Colors.green.shade800,
        Icons.schedule,
      ),
      NoticeTone.warning => (
        Colors.orange.withValues(alpha: 0.14),
        Colors.orange.shade900,
        Icons.warning_amber_rounded,
      ),
      NoticeTone.blocked => (
        Colors.red.withValues(alpha: 0.12),
        Colors.red.shade800,
        Icons.block,
      ),
    };
    return Semantics(
      liveRegion: notice.tone != NoticeTone.info,
      child: Container(
        width: double.infinity,
        color: background,
        padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
        child: Row(
          children: [
            Icon(icon, size: 18, color: foreground),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(notice.text, style: TextStyle(color: foreground)),
                  if (notice.detail != null)
                    Text(
                      notice.detail!,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                ],
              ),
            ),
            if (window.templateRequired && _isWhatsapp)
              TextButton(
                onPressed: _openTemplates,
                child: const Text('使用範本發送'),
              ),
          ],
        ),
      ),
    );
  }

  Widget _composer() {
    final canWrite = _canWrite;
    final window = _window;
    final hint = canWrite
        ? '輸入訊息，或輸入 / 插入快速回覆'
        : window?.state == ReplyState.unsupported
        ? '目前無法回覆這個平台的訊息'
        : '已超過回覆期限，請改用 WhatsApp 範本';
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_pickError != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 0, 8, 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _pickError!,
                        style: const TextStyle(color: Colors.red, fontSize: 13),
                      ),
                    ),
                    IconButton(
                      tooltip: '關閉',
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () => setState(() => _pickError = null),
                    ),
                  ],
                ),
              ),
            if (pendingFile != null) _pendingView(pendingFile!),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                IconButton(
                  onPressed: canWrite && (_canReplyHere || !_isPlatformRoom)
                      ? _showAttachmentOptions
                      : null,
                  tooltip: '新增附件',
                  icon: const Icon(Icons.attach_file),
                ),
                IconButton(
                  onPressed: canWrite ? _openQuickReplies : null,
                  tooltip: '插入快速回覆',
                  icon: const Icon(Icons.short_text),
                ),
                if (_isWhatsapp)
                  IconButton(
                    onPressed: _openTemplates,
                    tooltip: '使用 WhatsApp 範本發送',
                    icon: const Icon(Icons.description_outlined),
                  ),
                Expanded(
                  child: Focus(
                    onKeyEvent: _onKey,
                    child: TextField(
                      controller: controller,
                      focusNode: _inputFocus,
                      enabled: canWrite,
                      minLines: 1,
                      maxLines: 5,
                      keyboardType: TextInputType.multiline,
                      textInputAction: TextInputAction.newline,
                      onChanged: _onTextChanged,
                      decoration: InputDecoration(
                        hintText: hint,
                        hintMaxLines: 2,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                IconButton.filled(
                  key: const ValueKey('send-message'),
                  tooltip: !canWrite && _isWhatsapp ? '使用範本' : '發送',
                  onPressed: canWrite || _isWhatsapp ? _send : null,
                  icon: const Icon(Icons.send),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final window = _window;
    final subtitle = [
      if (room.channelName?.isNotEmpty == true) room.channelName!,
      if (room.assignee != null)
        room.assignee!.id == widget.graphQL.accountId
            ? '我負責'
            : '負責人：${room.assignee!.name}',
    ].join(' · ');
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(room.title, maxLines: 1, overflow: TextOverflow.ellipsis),
            if (subtitle.isNotEmpty)
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
          ],
        ),
        actions: [
          if (room.platform != null)
            IconButton(
              onPressed: _showCustomerInfo,
              tooltip: '客戶資訊',
              icon: const Icon(Icons.person_outline),
            ),
          IconButton(
            onPressed: () => _startCall('voice'),
            tooltip: '語音通話',
            icon: const Icon(Icons.call),
          ),
          IconButton(
            onPressed: () => _startCall('video'),
            tooltip: '視訊通話',
            icon: const Icon(Icons.videocam),
          ),
          IconButton(
            onPressed: _showChatSettings,
            tooltip: '聊天室設定',
            icon: const Icon(Icons.security),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_disappearingSeconds > 0 && !_isPlatformRoom)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: Text(
                '消失訊息：${disappearingLabel(_disappearingSeconds)}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          if (_connectionMessage != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  _connectionMessage!,
                  style: const TextStyle(color: Colors.orange),
                ),
              ),
            ),
          Expanded(child: _messages()),
          if (window != null) _notice(window),
          _composer(),
        ],
      ),
    );
  }
}

/// Picks one of the company's templates to put into the reply. Opens from the
/// button or by typing / in an empty box. The conversation's platform comes
/// first. Returns the text to insert, or null.
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
