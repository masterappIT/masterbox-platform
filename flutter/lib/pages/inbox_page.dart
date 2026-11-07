import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/app_models.dart';
import '../models/chat_source.dart';
import '../services/graphql_service.dart';
import '../theme/chat_colors.dart';
import '../widgets/chat/chat_parts.dart';
import '../widgets/common.dart';
import 'conversation_page.dart';

/// 即時訊息: the conversation list, a page at a time, as the admin inbox has
/// it. The server only lists the channels this account works in, counts each
/// account's unread messages, searches names and message text, filters by
/// source or channel, and keeps it live (Figma App/1 訊息列表).
class ChatPage extends StatefulWidget {
  const ChatPage({
    required this.graphQL,
    this.onOpenConversation,
    this.onManageChannels,
    super.key,
  });
  final GraphQLService graphQL;

  /// Opens a conversation; the list refreshes that conversation when it returns.
  final Future<void> Function(ChatConversation room)? onOpenConversation;
  final VoidCallback? onManageChannels;
  @override
  State<ChatPage> createState() => _ChatPageState();
}

enum _Status { loading, ready, failed }

class _ChatPageState extends State<ChatPage> {
  static const _pageSize = 30;

  final searchController = TextEditingController();
  final searchFocus = FocusNode();
  final _scroll = ScrollController();

  var filter = const ConversationFilter();
  List<ChatConversation> rooms = const [];
  String? _nextCursor;
  bool _hasMore = false;
  _Status _status = _Status.loading;
  String? _error;
  bool _loadingMore = false;
  bool _loadMoreFailed = false;
  int _request = 0;
  List<SocialChannel>? channels;
  String? _connectionMessage;

  Timer? _searchDebounce;
  Timer? _fallbackPoll;
  AppLifecycleListener? _lifecycle;
  final _subscriptions = <StreamSubscription<Object?>>[];
  final _pendingRooms = <String>{};
  // Messages already counted, so a repeat (such as a delivery error) or the
  // socket's copy of a reply sent here doesn't count twice.
  final _seenMessages = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
    _loadChannels();
    _subscriptions
      ..add(widget.graphQL.messageEvents.listen(_onMessage))
      ..add(widget.graphQL.roomEvents.listen(_onRoomUpdated))
      ..add(widget.graphQL.reconnects.listen((_) => _refreshTop()));
    _lifecycle = AppLifecycleListener(onResume: _refreshTop);
    // While the live connection is down, the list still catches up now and then.
    _fallbackPoll = Timer.periodic(const Duration(seconds: 30), (_) {
      if (!widget.graphQL.isLive) _refreshTop();
    });
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 400) _loadMore();
    });
  }

  @override
  void dispose() {
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
    _lifecycle?.dispose();
    _fallbackPoll?.cancel();
    _searchDebounce?.cancel();
    _scroll.dispose();
    searchFocus.dispose();
    searchController.dispose();
    super.dispose();
  }

  Future<void> _loadChannels() async {
    try {
      final result = await widget.graphQL.fetchChannels();
      if (mounted) setState(() => channels = result);
    } catch (_) {
      // The conversations' own error says the connection is down.
    }
  }

  /// The first page for the current filter. A newer request replaces the list;
  /// an older one finishing late is ignored.
  Future<void> _load() async {
    final request = ++_request;
    final asked = filter;
    setState(() {
      _status = rooms.isEmpty ? _Status.loading : _status;
      _loadMoreFailed = false;
    });
    try {
      final page = await widget.graphQL.fetchConversationPage(
        filter: asked,
        first: _pageSize,
      );
      if (!mounted || request != _request) return;
      setState(() {
        rooms = page.rooms;
        _nextCursor = page.nextCursor;
        _hasMore = page.hasMore;
        _status = _Status.ready;
        _error = null;
        _connectionMessage = null;
      });
    } catch (error) {
      if (!mounted || request != _request) return;
      setState(() {
        _error = '$error';
        if (rooms.isEmpty || asked != filter) {
          _status = _Status.failed;
        } else {
          _connectionMessage = '連線暫時中斷，將自動重試';
        }
      });
    }
  }

  Future<void> _loadMore() async {
    if (!_hasMore || _nextCursor == null || _loadingMore) return;
    if (_status != _Status.ready) return;
    final asked = filter;
    setState(() {
      _loadingMore = true;
      _loadMoreFailed = false;
    });
    try {
      final page = await widget.graphQL.fetchConversationPage(
        filter: asked,
        after: _nextCursor,
        first: _pageSize,
      );
      if (!mounted || asked != filter) return;
      // A conversation that moved up while paging may already be listed.
      final known = rooms.map((room) => room.id).toSet();
      setState(() {
        rooms = [...rooms, ...page.rooms.where((r) => !known.contains(r.id))];
        _nextCursor = page.nextCursor;
        _hasMore = page.hasMore;
      });
    } catch (_) {
      if (mounted) setState(() => _loadMoreFailed = true);
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  /// The top of the list again, after a reconnect or coming back to the app.
  /// Conversations further down had no news, or they would be up here.
  Future<void> _refreshTop() async {
    if (_status != _Status.ready) return _load();
    final asked = filter;
    try {
      final page = await widget.graphQL.fetchConversationPage(
        filter: asked,
        first: _pageSize,
      );
      if (!mounted || asked != filter) return;
      final fresh = page.rooms.map((room) => room.id).toSet();
      final last = page.rooms.lastOrNull;
      final older = last == null
          ? const <ChatConversation>[]
          : rooms
                .where(
                  (room) =>
                      !fresh.contains(room.id) && _byActivity(room, last) > 0,
                )
                .toList();
      setState(() {
        rooms = [...page.rooms, ...older];
        if (older.isEmpty) {
          _nextCursor = page.nextCursor;
          _hasMore = page.hasMore;
        }
        _connectionMessage = null;
      });
    } catch (_) {
      if (mounted) {
        setState(() => _connectionMessage = '連線暫時中斷，將自動重試');
      }
    }
  }

  /// Newest activity first, the order the server pages in.
  static int _byActivity(ChatConversation a, ChatConversation b) {
    final time = (b.updatedAt ?? DateTime(0)).compareTo(
      a.updatedAt ?? DateTime(0),
    );
    return time != 0 ? time : b.id.compareTo(a.id);
  }

  /// Puts a conversation where it belongs by its activity, unless that is
  /// beyond the pages loaded so far, where it shows up on scrolling there.
  List<ChatConversation> _place(
    List<ChatConversation> list,
    ChatConversation room,
  ) {
    final others = list.where((item) => item.id != room.id).toList();
    final last = others.lastOrNull;
    if (_hasMore && last != null && _byActivity(room, last) > 0) return others;
    return [...others, room]..sort(_byActivity);
  }

  bool _remember(String id) {
    if (!_seenMessages.add(id)) return false;
    if (_seenMessages.length > 1000) _seenMessages.remove(_seenMessages.first);
    return true;
  }

  void _onMessage(ChatMessage message) {
    if (message.id.isEmpty) return;
    final index = rooms.indexWhere((room) => room.holds(message));
    if (index < 0) {
      _fetchUnknownRoom(message);
      return;
    }
    // A known message coming back is news about it, not new activity.
    if (!_remember(message.id)) return;
    final room = rooms[index];
    final isOpen = widget.graphQL.openRoomId == room.messageRoomId;
    final updated = room.copyWith(
      lastMessage: message.preview ?? message.text,
      lastMessageAt: message.sentAt,
      lastMessageInbound: message.inbound,
      updatedAt: message.sentAt,
      lastCustomerMessageAt: message.inbound ? message.sentAt : null,
      unreadCount: room.unreadCount + (message.inbound && !isOpen ? 1 : 0),
    );
    setState(() => rooms = [updated, ...rooms.where((r) => r.id != room.id)]);
  }

  /// A customer's first message makes a conversation the list hasn't loaded.
  Future<void> _fetchUnknownRoom(ChatMessage message) async {
    final roomKey = message.roomId;
    if (_status != _Status.ready || roomKey == null) return;
    final key = '${message.channelId}-$roomKey';
    if (!_pendingRooms.add(key)) return;
    try {
      final room = await widget.graphQL.fetchConversation(
        chatRoomId: roomKey,
        channelId: message.channelId,
      );
      _remember(message.id);
      if (room == null || !mounted) return;
      if (!filter.admits(room, myId: widget.graphQL.accountId)) return;
      setState(() => rooms = _place(rooms, room));
    } catch (_) {
      // It shows up with the next refresh.
    } finally {
      _pendingRooms.remove(key);
    }
  }

  /// A conversation as the server has it now, after an assignment or a tag
  /// change, here or by a colleague.
  void _onRoomUpdated(ChatConversation room) {
    if (_status != _Status.ready) return;
    final myId = widget.graphQL.accountId;
    final known = rooms.any((item) => item.id == room.id);
    final assignmentFits = ConversationFilter(assignment: filter.assignment)
        .admits(room, myId: myId);
    setState(() {
      if (known) {
        rooms = assignmentFits
            ? [for (final item in rooms) item.id == room.id ? room : item]
            : rooms.where((item) => item.id != room.id).toList();
      } else if (filter.admits(room, myId: myId)) {
        rooms = _place(rooms, room);
      }
    });
  }

  void _changeFilter(ConversationFilter next) {
    if (next == filter) return;
    setState(() {
      filter = next;
      rooms = const [];
      _status = _Status.loading;
    });
    _load();
  }

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      _changeFilter(filter.copyWith(search: value));
    });
  }

  void _clearSearch() {
    searchController.clear();
    _searchDebounce?.cancel();
    _changeFilter(filter.copyWith(search: ''));
  }

  Future<void> _refreshAll() async {
    await Future.wait([_load(), _loadChannels()]);
  }

  Future<void> _open(ChatConversation room) async {
    // Opening it reads it, as the conversation page tells the server.
    setState(() {
      rooms = [
        for (final item in rooms)
          item.id == room.id ? item.copyWith(unreadCount: 0) : item,
      ];
    });
    final open = widget.onOpenConversation;
    if (open != null) {
      await open(room);
    } else {
      await Navigator.push(
        context,
        MaterialPageRoute<void>(
          builder: (_) =>
              ConversationPage(graphQL: widget.graphQL, conversation: room),
        ),
      );
    }
    if (!mounted) return;
    try {
      final fresh = await widget.graphQL.fetchConversation(id: room.id);
      if (fresh != null && mounted) {
        setState(() {
          rooms = [
            for (final item in rooms) item.id == fresh.id ? fresh : item,
          ];
        });
      }
    } catch (_) {
      // The list stays as it was.
    }
  }

  /// What the source button says: everything, a source, or a channel.
  String get _sourceButtonLabel {
    final channelId = filter.channelId;
    if (channelId != null) {
      return channels?.where((c) => c.id == channelId).firstOrNull?.name ??
          '頻道';
    }
    final source = filter.source;
    return source == null ? '全部來源' : sourceLabel(source);
  }

  /// Picks a source, or one channel: Facebook, Instagram, WhatsApp 官方 and
  /// WhatsApp 掃碼 apart, each channel with its phone number under the name.
  Future<void> _pickSource() async {
    final picked = await showModalBottomSheet<ConversationFilter>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      backgroundColor: context.chat.surfaceCard,
      builder: (sheetContext) =>
          SourcePickerSheet(filter: filter, channels: channels ?? const []),
    );
    if (picked != null) _changeFilter(picked);
  }

  Widget _filters() {
    final colors = context.chat;
    final current = filter;
    void toggleAssignment(String value) => _changeFilter(
      current.copyWith(assignment: current.assignment == value ? 'all' : value),
    );
    return Container(
      color: colors.surfaceNav,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: searchController,
                  focusNode: searchFocus,
                  onChanged: _onSearchChanged,
                  textInputAction: TextInputAction.search,
                  style: TextStyle(fontSize: 15, color: colors.textPrimary),
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: '搜尋客戶名稱、帳號或訊息',
                    hintStyle: TextStyle(color: colors.textTertiary),
                    prefixIcon: Icon(Icons.search, color: colors.textTertiary),
                    suffixIcon: searchController.text.isEmpty
                        ? null
                        : IconButton(
                            onPressed: _clearSearch,
                            tooltip: '清除搜尋',
                            icon: Icon(Icons.clear, color: colors.textTertiary),
                          ),
                    filled: true,
                    fillColor: colors.surfacePage,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Material(
                color: current.source != null || current.channelId != null
                    ? colors.brandPrimarySoft
                    : colors.surfacePage,
                borderRadius: BorderRadius.circular(10),
                child: InkWell(
                  key: const ValueKey('source-filter'),
                  borderRadius: BorderRadius.circular(10),
                  onTap: _pickSource,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 10,
                    ),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 120),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.filter_alt_outlined,
                            size: 18,
                            color: colors.textPrimary,
                          ),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              _sourceButtonLabel,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 14,
                                color: colors.textPrimary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: [
              QuickFilterChip(
                label: '未讀',
                selected: current.unreadOnly,
                onTap: () => _changeFilter(
                  current.copyWith(unreadOnly: !current.unreadOnly),
                ),
              ),
              QuickFilterChip(
                label: '我的',
                selected: current.assignment == 'mine',
                onTap: () => toggleAssignment('mine'),
              ),
              QuickFilterChip(
                label: '未指派',
                selected: current.assignment == 'unassigned',
                onTap: () => toggleAssignment('unassigned'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _noRooms() {
    final known = channels;
    if (known != null && known.isEmpty) {
      return ChatEmptyState(
        icon: Icons.link_rounded,
        title: '還沒有連接頻道',
        detail: widget.onManageChannels != null
            ? '連接 Facebook、Instagram 或 WhatsApp 後，客戶傳來的訊息就會出現在這裡。'
            : '請聯絡公司管理員連接頻道，並開放給你的帳號使用。',
        actionLabel: widget.onManageChannels != null ? '前往社群平台管理' : null,
        onAction: widget.onManageChannels,
      );
    }
    if (filter.narrowed) {
      return ChatEmptyState(
        icon: Icons.search_off_rounded,
        title: '找不到符合的對話',
        detail: '換個關鍵字，或清除篩選條件。',
        actionLabel: '清除篩選',
        onAction: () {
          searchController.clear();
          _changeFilter(const ConversationFilter());
        },
      );
    }
    return const ChatEmptyState(
      icon: Icons.chat_bubble_outline_rounded,
      title: '目前還沒有對話',
      detail: '客戶傳訊息到你的頻道後，對話就會出現在這裡。',
    );
  }

  Widget _tile(ChatConversation room) => ConversationRow(
    room: room,
    myId: widget.graphQL.accountId,
    onTap: () => _open(room),
  );

  Widget _listEnd() {
    if (_loadingMore) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_loadMoreFailed) {
      return Center(
        child: TextButton.icon(
          onPressed: _loadMore,
          icon: const Icon(Icons.refresh),
          label: const Text('載入失敗，點此重試'),
        ),
      );
    }
    if (_hasMore) {
      // A short page doesn't fill the screen to scroll, so the end asks itself.
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadMore());
      return const SizedBox(height: 48);
    }
    return const SizedBox(height: 16);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    final Widget? state = switch (_status) {
      _Status.loading => const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: CircularProgressIndicator(),
        ),
      ),
      _Status.failed => ChatEmptyState(
        icon: Icons.cloud_off_outlined,
        tone: EmptyTone.alert,
        title: '對話載入失敗',
        detail: _error ?? '目前無法讀取對話',
        actionLabel: '重試',
        onAction: _load,
      ),
      _Status.ready when rooms.isEmpty => _noRooms(),
      _ => null,
    };
    final dark = Theme.of(context).brightness == Brightness.dark;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: ColoredBox(
        color: colors.surfaceCard,
        child: Column(
          children: [
            Container(
              color: colors.surfaceNav,
              padding: EdgeInsets.fromLTRB(
                16,
                MediaQuery.paddingOf(context).top + 12,
                16,
                12,
              ),
              child: Row(
                children: [
                  Text(
                    '即時訊息',
                    style: TextStyle(
                      fontSize: 26,
                      height: 1.3,
                      fontWeight: FontWeight.w700,
                      color: colors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
            _filters(),
            Divider(height: 1, color: colors.borderDefault),
            if (_connectionMessage != null)
              NoticeBar(kind: NoticeKind.connection, text: _connectionMessage!),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refreshAll,
                child: ListView.builder(
                  controller: _scroll,
                  physics: const AlwaysScrollableScrollPhysics(),
                  itemCount: state != null ? 1 : rooms.length + 1,
                  itemBuilder: (context, index) {
                    if (state != null) return state;
                    return index < rooms.length
                        ? _tile(rooms[index])
                        : _listEnd();
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One conversation in the list: the customer, the last message and when,
/// the unread count, where it comes from and who handles it.
class ConversationRow extends StatelessWidget {
  const ConversationRow({
    required this.room,
    required this.onTap,
    this.myId,
    super.key,
  });
  final ChatConversation room;
  final VoidCallback onTap;
  final String? myId;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    final unread = room.unreadCount > 0;
    final assignee = room.assignee;
    final preview = room.lastMessage.isNotEmpty ? room.lastMessage : '尚無訊息';
    final small = TextStyle(fontSize: 12, color: colors.textTertiary);
    return Material(
      color: colors.surfaceCard,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: colors.borderDefault)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ChatAvatar(name: room.title, imageUrl: room.customer?.avatarUrl),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            room.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 16,
                              height: 1.4,
                              fontWeight: FontWeight.w700,
                              color: colors.textPrimary,
                            ),
                          ),
                        ),
                        Text(
                          formatRelativeTime(
                            room.lastMessageAt ?? room.updatedAt,
                          ),
                          style: TextStyle(
                            fontSize: 12,
                            color: unread
                                ? colors.brandPrimaryDark
                                : colors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            preview,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 14,
                              height: 1.4,
                              color: unread
                                  ? colors.textPrimary
                                  : colors.textSecondary,
                            ),
                          ),
                        ),
                        if (unread) ...[
                          const SizedBox(width: 8),
                          ChatUnreadBadge(count: room.unreadCount),
                        ],
                      ],
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (room.source != null) SourceTag(source: room.source),
                        if (room.channelName?.isNotEmpty == true)
                          Text(room.channelName!, style: small),
                        if (assignee != null)
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.person_outline_rounded,
                                size: 13,
                                color: colors.textTertiary,
                              ),
                              const SizedBox(width: 2),
                              Text(
                                assignee.id == myId ? '我負責' : assignee.name,
                                style: small,
                              ),
                            ],
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The source and channel picker: all, one source, or one channel. Channels
/// show their phone number under the name rather than an internal id.
class SourcePickerSheet extends StatelessWidget {
  const SourcePickerSheet({
    required this.filter,
    required this.channels,
    super.key,
  });
  final ConversationFilter filter;
  final List<SocialChannel> channels;

  @override
  Widget build(BuildContext context) {
    final colors = context.chat;
    Widget heading(String text) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: colors.textSecondary,
        ),
      ),
    );
    Widget dot(String? source) => Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        color: colors.sourceColor(source),
        shape: BoxShape.circle,
      ),
    );
    Widget check(bool selected) => selected
        ? Icon(Icons.check_rounded, color: colors.brandPrimaryDark)
        : const SizedBox(width: 24);
    final all = filter.source == null && filter.channelId == null;
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.75,
        ),
        child: ListView(
          shrinkWrap: true,
          children: [
            heading('來源'),
            ListTile(
              title: const Text('全部來源'),
              trailing: check(all),
              onTap: () => Navigator.pop(
                context,
                filter.copyWith(clearSource: true, clearChannel: true),
              ),
            ),
            for (final source in filterableSources)
              ListTile(
                leading: dot(source),
                title: Text(sourceLabel(source)),
                trailing: check(
                  filter.channelId == null && filter.source == source,
                ),
                onTap: () => Navigator.pop(
                  context,
                  filter.copyWith(source: source, clearChannel: true),
                ),
              ),
            if (channels.isNotEmpty) heading('頻道'),
            for (final channel in channels)
              ListTile(
                leading: dot(channel.source),
                title: Text(channel.name),
                subtitle: Text(
                  [sourceLabel(channel.source), ?channel.detail].join(' · '),
                  style: TextStyle(color: colors.textTertiary),
                ),
                trailing: check(filter.channelId == channel.id),
                onTap: () => Navigator.pop(
                  context,
                  filter.copyWith(channelId: channel.id, clearSource: true),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
