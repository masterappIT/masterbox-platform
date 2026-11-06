import 'dart:async';

import 'package:flutter/material.dart';

import '../models/app_models.dart';
import '../services/graphql_service.dart';
import '../widgets/common.dart';
import 'conversation_page.dart';

/// The conversation list, a page at a time, as the admin inbox has it: the
/// server only lists the channels this account works in, counts each account's
/// unread messages, searches names and message text, and keeps it live.
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
  static const _assignments = {
    'all': '全部',
    'mine': '我負責的',
    'unassigned': '未指派',
  };

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
      _changeFilter(
        ConversationFilter(
          search: value,
          channelId: filter.channelId,
          unreadOnly: filter.unreadOnly,
          assignment: filter.assignment,
        ),
      );
    });
  }

  void _clearSearch() {
    searchController.clear();
    _searchDebounce?.cancel();
    _changeFilter(
      ConversationFilter(
        channelId: filter.channelId,
        unreadOnly: filter.unreadOnly,
        assignment: filter.assignment,
      ),
    );
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

  Widget _chips() {
    final known = channels;
    final myFilter = filter;
    ConversationFilter copy({
      String? channelId,
      bool clearChannel = false,
      bool? unreadOnly,
      String? assignment,
    }) => ConversationFilter(
      search: myFilter.search,
      channelId: clearChannel ? null : (channelId ?? myFilter.channelId),
      unreadOnly: unreadOnly ?? myFilter.unreadOnly,
      assignment: assignment ?? myFilter.assignment,
    );
    return Column(
      children: [
        if (known != null && known.isNotEmpty)
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: const Text('全部頻道'),
                    selected: myFilter.channelId == null,
                    onSelected: (_) => _changeFilter(copy(clearChannel: true)),
                  ),
                ),
                for (final channel in known)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      avatar: Icon(platformIcon(channel.platform), size: 16),
                      label: Text(channel.name),
                      selected: myFilter.channelId == channel.id,
                      onSelected: (_) =>
                          _changeFilter(copy(channelId: channel.id)),
                    ),
                  ),
              ],
            ),
          ),
        SizedBox(
          height: 48,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (final entry in _assignments.entries)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(entry.value),
                    selected: myFilter.assignment == entry.key,
                    onSelected: (_) =>
                        _changeFilter(copy(assignment: entry.key)),
                  ),
                ),
              FilterChip(
                label: const Text('只看未讀'),
                selected: myFilter.unreadOnly,
                onSelected: (value) => _changeFilter(copy(unreadOnly: value)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _noRooms() {
    final known = channels;
    if (known != null && known.isEmpty) {
      return EmptyState(
        icon: Icons.hub_outlined,
        message: '還沒有可用的社群平台',
        detail: widget.onManageChannels != null
            ? '連接 Facebook、Instagram 等社群平台後，客戶傳來的訊息就會出現在這裡。'
            : '請聯絡公司管理員連接社群平台，並開放給你的帳號使用。',
        actionLabel: widget.onManageChannels != null ? '前往社群平台管理' : null,
        onAction: widget.onManageChannels,
      );
    }
    final narrowed =
        filter.search.trim().isNotEmpty ||
        filter.unreadOnly ||
        filter.assignment != 'all' ||
        filter.channelId != null;
    if (narrowed) {
      return const EmptyState(
        icon: Icons.chat_bubble_outline,
        message: '找不到聊天室',
        detail: '沒有符合條件的對話',
      );
    }
    return const EmptyState(
      icon: Icons.chat_bubble_outline,
      message: '目前還沒有對話',
      detail: '客戶傳訊息到這個社群平台後，對話就會出現在這裡。',
    );
  }

  String? _detail(ChatConversation room) {
    final parts = [
      if (room.channelName?.isNotEmpty == true) room.channelName!,
      if (room.assignee != null)
        room.assignee!.id == widget.graphQL.accountId
            ? '我負責'
            : '負責人：${room.assignee!.name}',
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  Widget _tile(ChatConversation room) => ConversationTile(
    name: room.title,
    preview: room.lastMessage.isNotEmpty
        ? room.lastMessage
        : (room.channelName ?? platformLabel(room.platform)),
    time: formatRelativeTime(room.lastMessageAt ?? room.updatedAt),
    avatarUrl: room.customer?.avatarUrl,
    platform: room.platform,
    unreadCount: room.unreadCount,
    detail: _detail(room),
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
    final header = <Widget>[
      TextField(
        controller: searchController,
        focusNode: searchFocus,
        onChanged: _onSearchChanged,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: '搜尋聊天室',
          helperText: '客戶名稱、帳號或訊息內容',
          prefixIcon: const Icon(Icons.search),
          suffixIcon: IconButton(
            onPressed: _clearSearch,
            tooltip: '清除搜尋',
            icon: const Icon(Icons.clear),
          ),
        ),
      ),
      const SizedBox(height: 8),
      _chips(),
      const SizedBox(height: 8),
      if (_connectionMessage != null)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            _connectionMessage!,
            style: const TextStyle(color: Colors.orange),
          ),
        ),
    ];
    final Widget? state = switch (_status) {
      _Status.loading => const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: CircularProgressIndicator(),
        ),
      ),
      _Status.failed => ErrorRetry(
        message: _error ?? '目前無法讀取對話',
        onRetry: _load,
      ),
      _Status.ready when rooms.isEmpty => _noRooms(),
      _ => null,
    };
    return PageFrame(
      title: 'Chat',
      subtitle: '所有聊天室',
      action: IconButton(
        onPressed: searchFocus.requestFocus,
        tooltip: '搜尋聊天室',
        icon: const Icon(Icons.search, color: Colors.white),
      ),
      child: RefreshIndicator(
        onRefresh: _refreshAll,
        child: ListView.builder(
          controller: _scroll,
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          itemCount: header.length + (state != null ? 1 : rooms.length + 1),
          itemBuilder: (context, index) {
            if (index < header.length) return header[index];
            if (state != null) return state;
            final at = index - header.length;
            return at < rooms.length ? _tile(rooms[at]) : _listEnd();
          },
        ),
      ),
    );
  }
}
