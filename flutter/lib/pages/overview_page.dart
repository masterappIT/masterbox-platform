import 'package:flutter/material.dart';

import '../models/app_models.dart';
import '../services/graphql_service.dart';
import '../widgets/common.dart';

const _recentConversations = 10;
const _recentWindow = Duration(days: 7);

class _OverviewData {
  const _OverviewData(this.channels, this.rooms);
  final List<SocialChannel> channels;
  final List<ChatConversation> rooms;
}

/// The admin site's home page: channels, customers and recent conversations.
class OverviewPage extends StatefulWidget {
  const OverviewPage({
    required this.graphQL,
    required this.onOpenConversation,
    super.key,
  });
  final GraphQLService graphQL;
  final ValueChanged<ChatConversation> onOpenConversation;

  @override
  State<OverviewPage> createState() => _OverviewPageState();
}

class _OverviewPageState extends State<OverviewPage> {
  late Future<_OverviewData> data = _load();
  String listTab = 'channels';

  Future<_OverviewData> _load() async {
    final channels = await widget.graphQL.fetchChannels();
    final rooms = await widget.graphQL.fetchConversations();
    // chatRooms returns the whole company, so keep to the channels this account can use.
    return _OverviewData(
      channels,
      rooms
          .where((room) => channels.any((item) => item.id == room.channelId))
          .toList(),
    );
  }

  void _reload() {
    setState(() {
      data = _load();
    });
  }

  static int _customerCount(Iterable<ChatConversation> rooms) =>
      rooms.map((room) => room.customer?.id).whereType<String>().toSet().length;

  static bool _isRecent(ChatConversation room) =>
      room.updatedAt != null &&
      DateTime.now().difference(room.updatedAt!) < _recentWindow;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('首頁總覽'),
      actions: [
        IconButton(
          onPressed: _reload,
          tooltip: '更新資料',
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: FutureBuilder<_OverviewData>(
      future: data,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(
            child: ErrorRetry(message: '${snapshot.error}', onRetry: _reload),
          );
        }
        final result = snapshot.data!;
        if (result.channels.isEmpty) {
          return const EmptyState(
            icon: Icons.hub_outlined,
            message: '還沒有可用的社群平台',
            detail: '連接 Facebook、Instagram 等社群平台後，客戶傳來的訊息就會出現在這裡。',
          );
        }
        return _content(result);
      },
    ),
  );

  Widget _content(_OverviewData result) {
    final rooms = result.rooms;
    final platforms = result.channels.map((item) => item.platform).toSet();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            _StatCard(
              title: '已連接社群',
              value: result.channels.length,
              detail:
                  '${result.channels.where((item) => item.enabled).length} 個已啟用',
            ),
            const SizedBox(width: 8),
            _StatCard(
              title: '客戶數',
              value: _customerCount(rooms),
              detail: '來自所有對話',
            ),
            const SizedBox(width: 8),
            _StatCard(
              title: '對話總數',
              value: rooms.length,
              detail: '近 7 天有更新：${rooms.where(_isRecent).length}',
            ),
          ],
        ),
        const SizedBox(height: 18),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'channels', label: Text('社群列表')),
            ButtonSegment(value: 'members', label: Text('成員列表')),
            ButtonSegment(value: 'bots', label: Text('BOT列表')),
          ],
          selected: {listTab},
          onSelectionChanged: (value) => setState(() => listTab = value.first),
        ),
        const SizedBox(height: 12),
        if (listTab == 'channels') ...[
          _PlatformCard(
            title: '來自全部',
            icon: Icons.all_inbox_outlined,
            channelCount: result.channels.length,
            rooms: rooms,
          ),
          for (final platform in platforms)
            _PlatformCard(
              title: '來自${platformLabel(platform)}',
              icon: platformIcon(platform),
              channelCount: result.channels
                  .where((item) => item.platform == platform)
                  .length,
              rooms: rooms.where((room) => room.platform == platform).toList(),
            ),
        ],
        if (listTab == 'members') _MemberList(graphQL: widget.graphQL),
        if (listTab == 'bots')
          const EmptyState(
            icon: Icons.smart_toy_outlined,
            message: '對話BOT 尚未開放',
            detail: '功能開放後，這裡會顯示已建立的 BOT',
          ),
        const SizedBox(height: 18),
        const SectionTitle(title: '對話中'),
        if (rooms.isEmpty)
          const EmptyState(
            icon: Icons.chat_bubble_outline,
            message: '目前還沒有對話',
            detail: '客戶傳訊息到這個社群平台後，對話就會出現在這裡。',
          )
        else
          for (final room in rooms.take(_recentConversations))
            ConversationTile(
              name: room.title,
              preview: result.channels
                  .firstWhere((item) => item.id == room.channelId)
                  .name,
              time: formatRelativeTime(room.updatedAt),
              avatarUrl: room.customer?.avatarUrl,
              platform: room.platform,
              onTap: () => widget.onOpenConversation(room),
            ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.title,
    required this.value,
    required this.detail,
  });
  final String title, detail;
  final int value;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(
              '$value',
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 2),
            Text(
              detail,
              style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
            ),
          ],
        ),
      ),
    ),
  );
}

class _PlatformCard extends StatelessWidget {
  const _PlatformCard({
    required this.title,
    required this.icon,
    required this.channelCount,
    required this.rooms,
  });
  final String title;
  final IconData icon;
  final int channelCount;
  final List<ChatConversation> rooms;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: primaryColor, size: 20),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
              const Spacer(),
              Text(
                '目前累計',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _metric('已連接社群', channelCount),
              _metric('客戶數', _OverviewPageState._customerCount(rooms)),
              _metric('對話總數', rooms.length),
              _metric(
                '近 7 天有更新',
                rooms.where(_OverviewPageState._isRecent).length,
              ),
            ],
          ),
        ],
      ),
    ),
  );

  Widget _metric(String label, int value) => Expanded(
    child: Column(
      children: [
        Text(
          '$value',
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
        ),
      ],
    ),
  );
}

class _MemberList extends StatefulWidget {
  const _MemberList({required this.graphQL});
  final GraphQLService graphQL;

  @override
  State<_MemberList> createState() => _MemberListState();
}

class _MemberListState extends State<_MemberList> {
  late final Future<List<TeamAccount>> members = widget.graphQL
      .fetchTeamAccounts();

  @override
  Widget build(BuildContext context) => FutureBuilder<List<TeamAccount>>(
    future: members,
    builder: (context, snapshot) {
      if (snapshot.connectionState == ConnectionState.waiting) {
        return const Center(child: CircularProgressIndicator());
      }
      if (snapshot.hasError) {
        return const EmptyState(
          icon: Icons.lock_outline,
          message: '只有管理者可以查看成員列表',
        );
      }
      final accounts = snapshot.data ?? const <TeamAccount>[];
      if (accounts.isEmpty) {
        return const EmptyState(icon: Icons.people_outline, message: '還沒有成員');
      }
      return Card(
        child: Column(
          children: [
            for (final account in accounts)
              ListTile(
                leading: PersonAvatar(
                  name: account.displayName,
                  imageUrl: account.avatarUrl,
                ),
                title: Text(account.displayName),
                subtitle: Text('${account.roleName} · ${account.email}'),
                trailing: Text(
                  account.enabled ? '已啟用' : '已停用',
                  style: TextStyle(
                    color: account.enabled ? Colors.green : Colors.grey,
                  ),
                ),
              ),
          ],
        ),
      );
    },
  );
}
