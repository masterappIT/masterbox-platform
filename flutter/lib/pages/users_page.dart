import 'dart:convert';

import 'package:flutter/material.dart';

import '../models/app_models.dart';
import '../services/graphql_service.dart';
import '../widgets/common.dart';
import 'templates_page.dart' show confirmDelete;

const _minPasswordLength = 6;

class UsersPage extends StatefulWidget {
  const UsersPage({required this.graphQL, super.key});
  final GraphQLService graphQL;

  @override
  State<UsersPage> createState() => _UsersPageState();
}

class _UsersPageState extends State<UsersPage> {
  List<TeamAccount> accounts = const [];
  bool loading = true;
  bool loadFailed = false;
  String search = '';
  final pending = <String>{};

  String? get _selfId => widget.graphQL.accountId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await widget.graphQL.fetchTeamAccounts();
      if (!mounted) return;
      setState(() {
        accounts = result;
        loadFailed = false;
        loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        accounts = const [];
        loadFailed = true;
        loading = false;
      });
    }
  }

  void _notify(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));

  Future<void> _toggle(TeamAccount account, bool enabled) async {
    setState(() => pending.add(account.id));
    try {
      final saved = await widget.graphQL.updateAccount(account.id, {
        'enabled': enabled,
      });
      if (!mounted) return;
      setState(() {
        accounts = [
          for (final item in accounts)
            item.id == account.id
                ? item.copyWith(enabled: saved.enabled)
                : item,
        ];
      });
      _notify('已${saved.enabled ? '啟用' : '停用'}「${account.displayName}」');
    } catch (error) {
      if (mounted) {
        _notify('無法${enabled ? '啟用' : '停用'}「${account.displayName}」：$error');
      }
    } finally {
      if (mounted) setState(() => pending.remove(account.id));
    }
  }

  Future<void> _delete(TeamAccount account) async {
    final confirmed = await confirmDelete(
      context,
      title: '確定要刪除「${account.displayName}」嗎？',
      detail: '刪除後對方將無法登入，且無法復原。',
    );
    if (!confirmed || !mounted) return;
    try {
      await widget.graphQL.deleteAccount(account.id);
      if (!mounted) return;
      _notify('已刪除「${account.displayName}」');
      await _load();
    } catch (error) {
      if (mounted) _notify('刪除失敗：$error');
    }
  }

  Future<void> _edit([TeamAccount? account]) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => UserFormPage(graphQL: widget.graphQL, account: account),
      ),
    );
    if (saved == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final query = search.trim().toLowerCase();
    final visible = accounts
        .where(
          (account) =>
              query.isEmpty ||
              [
                account.name,
                account.email,
                account.roleName,
              ].any((value) => value.toLowerCase().contains(query)),
        )
        .toList();
    return Scaffold(
      appBar: AppBar(title: const Text('使用者管理')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(),
        icon: const Icon(Icons.person_add_alt),
        label: const Text('新增使用者'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          children: [
            TextField(
              onChanged: (value) => setState(() => search = value),
              decoration: const InputDecoration(
                hintText: '依名稱或信箱搜尋',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: 16),
            if (loading)
              const Center(child: CircularProgressIndicator())
            else if (loadFailed)
              ErrorRetry(message: '目前無法讀取使用者，請稍後再試', onRetry: _load)
            else if (visible.isEmpty)
              EmptyState(
                icon: Icons.people_outline,
                message: query.isEmpty ? '無任何一筆資料，趕快新增一筆資料吧' : '找不到符合的使用者',
              )
            else
              for (final account in visible) _row(account),
          ],
        ),
      ),
    );
  }

  Widget _row(TeamAccount account) {
    final isSelf = account.id == _selfId;
    return Card(
      child: ListTile(
        onTap: () => _edit(account),
        contentPadding: const EdgeInsets.only(left: 16, right: 4),
        leading: PersonAvatar(
          name: account.displayName,
          imageUrl: account.avatarUrl,
        ),
        title: Text(
          '${account.displayName}${isSelf ? '（你）' : ''}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          '${account.roleName} · ${account.email}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Switch(
              value: account.enabled,
              onChanged: isSelf || pending.contains(account.id)
                  ? null
                  : (value) => _toggle(account, value),
            ),
            IconButton(
              onPressed: isSelf ? null : () => _delete(account),
              tooltip: isSelf ? '不能刪除自己的帳號' : '刪除使用者',
              icon: const Icon(Icons.delete_outline),
            ),
          ],
        ),
      ),
    );
  }
}

class UserFormPage extends StatefulWidget {
  const UserFormPage({required this.graphQL, this.account, super.key});
  final GraphQLService graphQL;

  /// Null when adding someone.
  final TeamAccount? account;

  @override
  State<UserFormPage> createState() => _UserFormPageState();
}

class _UserFormPageState extends State<UserFormPage> {
  late final email = TextEditingController(text: widget.account?.email);
  late final name = TextEditingController(text: widget.account?.name);
  final password = TextEditingController();
  late String role = widget.account?.role.isNotEmpty == true
      ? widget.account!.role
      : 'admin';
  Map<String, String> errors = const {};
  bool saving = false;

  bool get _isEditing => widget.account != null;
  bool get _isSelf => widget.account?.id == widget.graphQL.accountId;

  @override
  void dispose() {
    email.dispose();
    name.dispose();
    password.dispose();
    super.dispose();
  }

  Map<String, String> _validate() => {
    if (!RegExp(r'^\S+@\S+\.\S+$').hasMatch(email.text.trim()))
      'email': '請輸入有效的電子信箱',
    if (name.text.trim().isEmpty) 'name': '請輸入使用者名稱',
    if (!_isEditing && password.text.length < _minPasswordLength)
      'password': '密碼至少需要 $_minPasswordLength 個字元',
  };

  Future<void> _save() async {
    if (saving) return;
    final found = _validate();
    setState(() => errors = found);
    if (found.isNotEmpty) return;
    setState(() => saving = true);
    final navigator = Navigator.of(context);
    final info = {...?widget.account?.info, 'name': name.text.trim()};
    try {
      if (_isEditing) {
        await widget.graphQL.updateAccount(widget.account!.id, {
          'email': email.text.trim(),
          'role': role,
          'user_info': jsonEncode(info),
        });
      } else {
        await widget.graphQL.createAccount(
          email: email.text.trim(),
          password: password.text,
          role: role,
          info: info,
        );
      }
      navigator.pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() => saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('無法儲存使用者：$error')));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(_isEditing ? '編輯使用者' : '新增使用者'),
      actions: [
        TextButton(
          onPressed: saving ? null : _save,
          child: Text(saving ? '儲存中…' : '儲存'),
        ),
      ],
    ),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: email,
          keyboardType: TextInputType.emailAddress,
          decoration: InputDecoration(
            labelText: '電子信箱',
            hintText: '使用者的電子信箱（登入帳號）',
            errorText: errors['email'],
          ),
        ),
        if (!_isEditing) ...[
          const SizedBox(height: 14),
          TextField(
            controller: password,
            obscureText: true,
            decoration: InputDecoration(
              labelText: '密碼',
              hintText: '至少 $_minPasswordLength 個字元',
              errorText: errors['password'],
            ),
          ),
        ],
        const SizedBox(height: 14),
        TextField(
          controller: name,
          decoration: InputDecoration(
            labelText: '使用者名稱',
            helperText: '此名稱將顯示給 MasterBox 的其他成員，與您互動的客戶不會看到此名稱',
            helperMaxLines: 2,
            errorText: errors['name'],
          ),
        ),
        const SizedBox(height: 14),
        DropdownButtonFormField<String>(
          initialValue: accountRoleNames.containsKey(role) ? role : null,
          decoration: InputDecoration(
            labelText: '角色',
            helperText: _isSelf ? '不能變更自己的角色' : null,
          ),
          items: [
            for (final entry in accountRoleNames.entries)
              DropdownMenuItem(value: entry.key, child: Text(entry.value)),
          ],
          onChanged: _isSelf
              ? null
              : (value) => setState(() => role = value ?? role),
        ),
      ],
    ),
  );
}
