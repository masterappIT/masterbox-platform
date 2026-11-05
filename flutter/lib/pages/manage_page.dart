import 'package:flutter/material.dart';

import '../models/app_models.dart';
import '../services/graphql_service.dart';
import '../widgets/common.dart';
import 'channels_page.dart';
import 'company_page.dart';
import 'overview_page.dart';
import 'templates_page.dart';
import 'users_page.dart';

/// The admin site's management menu, for accounts with the admin role.
class ManagePage extends StatelessWidget {
  const ManagePage({
    required this.graphQL,
    required this.onOpenConversation,
    required this.onOpenCustomers,
    super.key,
  });
  final GraphQLService graphQL;
  final ValueChanged<ChatConversation> onOpenConversation;
  final VoidCallback onOpenCustomers;

  void _open(BuildContext context, Widget page) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));

  @override
  Widget build(BuildContext context) => PageFrame(
    title: '管理',
    subtitle: '公司與社群管理',
    child: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const SectionTitle(title: '營運'),
        Card(
          child: Column(
            children: [
              _ManageTile(
                icon: Icons.dashboard_outlined,
                title: '首頁總覽',
                subtitle: '社群、客戶與最近對話',
                onTap: () => _open(
                  context,
                  OverviewPage(
                    graphQL: graphQL,
                    onOpenConversation: onOpenConversation,
                  ),
                ),
              ),
              _ManageTile(
                icon: Icons.people_outline,
                title: '客戶管理',
                subtitle: '依平台與頻道查看客戶',
                onTap: onOpenCustomers,
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const SectionTitle(title: '設定'),
        Card(
          child: Column(
            children: [
              _ManageTile(
                icon: Icons.hub_outlined,
                title: '社群平台管理',
                subtitle: '連接、啟用或停用社群頻道',
                onTap: () => _open(context, ChannelsPage(graphQL: graphQL)),
              ),
              _ManageTile(
                icon: Icons.article_outlined,
                title: '訊息範本',
                subtitle: '新增、編輯與刪除範本',
                onTap: () => _open(context, TemplatesPage(graphQL: graphQL)),
              ),
              _ManageTile(
                icon: Icons.manage_accounts_outlined,
                title: '使用者管理',
                subtitle: '團隊成員與角色',
                onTap: () => _open(context, UsersPage(graphQL: graphQL)),
              ),
              _ManageTile(
                icon: Icons.business_outlined,
                title: '公司資料',
                subtitle: '基本資料、負責人與訂閱方案',
                onTap: () => _open(context, CompanyPage(graphQL: graphQL)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const SectionTitle(title: '尚未開放'),
        Card(
          child: Column(
            children: [
              _ManageTile(
                icon: Icons.campaign_outlined,
                title: '群發工具',
                subtitle: '尚未開放',
                onTap: () => _open(
                  context,
                  const PendingFeaturePage(
                    title: '群發工具',
                    message: '群發功能尚未開放',
                    detail: '目前無法儲存或發送群發訊息，開放後會顯示在這裡。',
                  ),
                ),
              ),
              _ManageTile(
                icon: Icons.smart_toy_outlined,
                title: '對話BOT',
                subtitle: '尚未開放',
                onTap: () => _open(
                  context,
                  const PendingFeaturePage(
                    title: '對話BOT',
                    message: '對話BOT 尚未開放',
                    detail: '目前無法建立或儲存機器人，功能開放後會顯示已建立的 BOT。',
                  ),
                ),
              ),
              _ManageTile(
                icon: Icons.insights_outlined,
                title: '數據分析',
                subtitle: '尚未開放',
                onTap: () => _open(
                  context,
                  const PendingFeaturePage(
                    title: '數據分析',
                    message: '數據分析尚未開放',
                    detail: '目前還沒有報表資料，開放後會顯示在這裡。',
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _ManageTile extends StatelessWidget {
  const _ManageTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
    leading: Icon(icon, color: primaryColor),
    title: Text(title),
    subtitle: Text(subtitle),
    trailing: const Icon(Icons.chevron_right),
    onTap: onTap,
  );
}

/// Features the admin site also can't save or send yet. This says so plainly
/// rather than showing a form that goes nowhere.
class PendingFeaturePage extends StatelessWidget {
  const PendingFeaturePage({
    required this.title,
    required this.message,
    required this.detail,
    super.key,
  });
  final String title, message, detail;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title)),
    body: EmptyState(
      icon: Icons.hourglass_empty,
      message: message,
      detail: detail,
    ),
  );
}
