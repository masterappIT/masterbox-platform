import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'services/graphql_service.dart';
import 'services/dynamic_island_service.dart';
import 'models/app_models.dart';
import 'call_page.dart';

const primaryColor = Color(0xFFFFAB37);
const authBlue = primaryColor;

void main() => runApp(const MasterBoxApp());

class MasterBoxApp extends StatefulWidget {
  const MasterBoxApp({super.key});

  @override
  State<MasterBoxApp> createState() => _MasterBoxAppState();
}

class _MasterBoxAppState extends State<MasterBoxApp> {
  ThemeMode themeMode = ThemeMode.light;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((prefs) {
      if (!mounted) return;
      setState(
        () => themeMode = prefs.getBool('dark_mode') == true
            ? ThemeMode.dark
            : ThemeMode.light,
      );
    });
  }

  Future<void> setThemeMode(bool dark) async {
    setState(() => themeMode = dark ? ThemeMode.dark : ThemeMode.light);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('dark_mode', dark);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MasterBox',
      debugShowCheckedModeBanner: false,
      themeMode: themeMode,
      theme: _masterBoxTheme(Brightness.light),
      darkTheme: _masterBoxTheme(Brightness.dark),
      home: AppRoot(onThemeModeChanged: setThemeMode),
      onUnknownRoute: (settings) => MaterialPageRoute(
        builder: (_) => AppRoot(onThemeModeChanged: setThemeMode),
      ),
    );
  }
}

ThemeData _masterBoxTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: primaryColor,
    brightness: brightness,
  );
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: isDark
        ? const Color(0xff121212)
        : const Color(0xfff6f7f9),
    visualDensity: VisualDensity.standard,
    cardTheme: CardThemeData(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 10),
      color: scheme.surface,
      surfaceTintColor: Colors.transparent,
      shadowColor: Colors.black.withValues(alpha: 0.08),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(16)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark ? scheme.surfaceContainerHighest : Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      border: const OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(14)),
        borderSide: BorderSide.none,
      ),
      enabledBorder: const OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(14)),
        borderSide: BorderSide.none,
      ),
      focusedBorder: const OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(14)),
        borderSide: BorderSide(color: primaryColor, width: 1.5),
      ),
      labelStyle: TextStyle(color: scheme.onSurfaceVariant),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 52),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(10)),
        ),
      ),
    ),
    listTileTheme: const ListTileThemeData(
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      minVerticalPadding: 10,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(14)),
      ),
    ),
    dividerTheme: DividerThemeData(
      color: scheme.outlineVariant.withValues(alpha: 0.45),
      space: 1,
    ),
  );
}

class AppRoot extends StatefulWidget {
  const AppRoot({required this.onThemeModeChanged, super.key});
  final ValueChanged<bool> onThemeModeChanged;
  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  bool signedIn = false;
  String? authToken;
  String? refreshToken;
  String? accountId;
  String? companyId;
  bool restoring = false;
  GraphQLService get graphQL => GraphQLService(
    token: authToken,
    refreshToken: refreshToken,
    accountId: accountId,
    companyId: companyId,
  );

  @override
  void initState() {
    super.initState();
    restoreSession();
  }

  Future<void> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final storedRefreshToken = prefs.getString('refresh_token');
    final storedToken = prefs.getString('auth_token');
    final service = GraphQLService(
      token: storedToken,
      refreshToken: storedRefreshToken,
      accountId: prefs.getString('account_id'),
      companyId: prefs.getString('company_id'),
    );
    if (storedToken?.isNotEmpty != true &&
        storedRefreshToken?.isNotEmpty == true &&
        await service.refresh()) {
      await prefs.setString('auth_token', service.token!);
    }
    if (!mounted) return;
    setState(() {
      authToken = service.token;
      refreshToken = service.refreshToken;
      accountId = service.accountId;
      companyId = service.companyId;
      signedIn = authToken?.isNotEmpty == true;
      restoring = false;
    });
  }

  Future<void> handleLogin(String email, String password) async {
    final tokens = await graphQL.authenticate(email: email, password: password);
    if (!mounted) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', tokens.token);
    if (tokens.refreshToken?.isNotEmpty == true) {
      await prefs.setString('refresh_token', tokens.refreshToken!);
    }
    if (tokens.accountId?.isNotEmpty == true) {
      await prefs.setString('account_id', tokens.accountId!);
    }
    if (tokens.companyId?.isNotEmpty == true) {
      await prefs.setString('company_id', tokens.companyId!);
    }
    if (!mounted) return;
    setState(() {
      authToken = tokens.token;
      refreshToken = tokens.refreshToken;
      accountId = tokens.accountId;
      companyId = tokens.companyId;
      signedIn = true;
    });
  }

  Future<void> handleLogout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('refresh_token');
    if (mounted) {
      setState(() {
        signedIn = false;
        authToken = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (restoring) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return signedIn
        ? MainShell(
            graphQL: graphQL,
            onThemeModeChanged: widget.onThemeModeChanged,
            onLogout: handleLogout,
          )
        : LoginPage(
            onLogin: (email, password, developmentMode) async {
              if (developmentMode) {
                try {
                  await handleLogin(
                    email.trim().isEmpty ? 'demo@masterbox.local' : email.trim(),
                    password.isEmpty ? 'MasterBox123!' : password,
                  );
                } catch (_) {
                  if (!mounted) return;
                  setState(() {
                    authToken = 'development-token';
                    signedIn = true;
                  });
                }
              } else {
                await handleLogin(email, password);
              }
            },
          );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({required this.onLogin, super.key});
  final Future<void> Function(
    String email,
    String password,
    bool developmentMode,
  )
  onLogin;
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage>
    with SingleTickerProviderStateMixin {
  bool developmentMode = true;
  bool showLoginForm = true;
  bool forgotPassword = false;
  bool loading = false;
  String? errorMessage;
  final email = TextEditingController();
  final password = TextEditingController();
  late final AnimationController intro;

  @override
  void initState() {
    super.initState();
    intro = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..forward();
    intro.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) {
        setState(() => showLoginForm = true);
      }
    });
  }

  @override
  void dispose() {
    intro.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: primaryColor,
    body: Stack(
      fit: StackFit.expand,
      children: [
        Image.asset('assets/login.png', fit: BoxFit.cover),
        Container(color: primaryColor.withValues(alpha: 0.9)),
        SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(28),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: FadeTransition(
                  opacity: CurvedAnimation(
                    parent: intro,
                    curve: Curves.easeOut,
                  ),
                  child: Column(
                    children: [
                      Image.asset(
                        'assets/logo.png',
                        width: 250,
                        fit: BoxFit.contain,
                      ),
                      const SizedBox(height: 28),
                      if (!showLoginForm)
                        const SizedBox(
                          height: 4,
                          width: 160,
                          child: LinearProgressIndicator(
                            color: Colors.white,
                            backgroundColor: Colors.white30,
                          ),
                        )
                      else
                        Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(18),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.72),
                                blurRadius: 28,
                                spreadRadius: 4,
                                offset: const Offset(0, 14),
                              ),
                            ],
                          ),
                          child: Card(
                            elevation: 0,
                            margin: EdgeInsets.zero,
                            surfaceTintColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(22),
                              child: Column(
                                children: [
                                  Text(
                                    forgotPassword ? '重設密碼' : '登入 MasterBox',
                                    style: const TextStyle(
                                      fontSize: 22,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 18),
                                  TextField(
                                    controller: email,
                                    onChanged: (_) => setState(() {}),
                                    decoration: const InputDecoration(
                                      labelText: 'Email',
                                      prefixIcon: Icon(Icons.email_outlined),
                                    ),
                                  ),
                                  if (!forgotPassword) ...[
                                    const SizedBox(height: 14),
                                    TextField(
                                      controller: password,
                                      onChanged: (_) => setState(() {}),
                                      obscureText: true,
                                      decoration: const InputDecoration(
                                        labelText: '密碼',
                                        prefixIcon: Icon(Icons.lock_outline),
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    SwitchListTile(
                                      contentPadding: EdgeInsets.zero,
                                      title: const Text('開發免登入'),
                                      subtitle: const Text('本機開發時略過帳號驗證'),
                                      value: developmentMode,
                                      onChanged: (value) => setState(
                                        () => developmentMode = value,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 12),
                                  if (errorMessage != null) ...[
                                    Align(
                                      alignment: Alignment.centerLeft,
                                      child: Text(
                                        errorMessage!,
                                        style: const TextStyle(
                                          color: Colors.red,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                  ],
                                  SizedBox(
                                    width: double.infinity,
                                    child: FilledButton.icon(
                                      onPressed: loading
                                          ? null
                                          : (forgotPassword
                                                ? (email.text.isNotEmpty
                                                      ? () => setState(
                                                          () => forgotPassword =
                                                              false,
                                                        )
                                                      : null)
                                                : ((developmentMode ||
                                                          (email
                                                                  .text
                                                                  .isNotEmpty &&
                                                              password
                                                                  .text
                                                                  .isNotEmpty))
                                                      ? () async {
                                                          setState(() {
                                                            loading = true;
                                                            errorMessage = null;
                                                          });
                                                          try {
                                                            await widget.onLogin(
                                                              email.text.trim(),
                                                              password.text,
                                                              developmentMode,
                                                            );
                                                          } catch (error) {
                                                            if (mounted) {
                                                              setState(
                                                                () => errorMessage = error
                                                                    .toString()
                                                                    .replaceFirst(
                                                                      'Bad state: ',
                                                                      '',
                                                                    ),
                                                              );
                                                            }
                                                          }
                                                          if (mounted) {
                                                            setState(
                                                              () => loading =
                                                                  false,
                                                            );
                                                          }
                                                        }
                                                      : null)),
                                      icon: loading
                                          ? const SizedBox(
                                              width: 18,
                                              height: 18,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                              ),
                                            )
                                          : Icon(
                                              forgotPassword
                                                  ? Icons.mail_outline
                                                  : Icons.login,
                                            ),
                                      label: Text(
                                        loading
                                            ? '登入中…'
                                            : (forgotPassword
                                                  ? '寄送重設連結'
                                                  : (developmentMode
                                                        ? '以開發模式進入'
                                                        : '登入')),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  TextButton(
                                    onPressed: () => setState(
                                      () => forgotPassword = !forgotPassword,
                                    ),
                                    child: Text(
                                      forgotPassword ? '返回登入' : '忘記密碼？',
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      const SizedBox(height: 18),
                      const Text(
                        'API 連線尚未設定時仍可使用示範資料',
                        style: TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

class MainShell extends StatefulWidget {
  const MainShell({
    required this.graphQL,
    required this.onThemeModeChanged,
    required this.onLogout,
    super.key,
  });
  final GraphQLService graphQL;
  final ValueChanged<bool> onThemeModeChanged;
  final VoidCallback onLogout;
  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int index = 0;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: index == 2
        ? SettingsPage(
            onThemeModeChanged: widget.onThemeModeChanged,
            onLogout: widget.onLogout,
          )
        : (index == 1
              ? ChatPage(graphQL: widget.graphQL)
              : ClientPage(graphQL: widget.graphQL)),
    bottomNavigationBar: _BottomBar(
      selectedIndex: index,
      onSelected: (value) => setState(() => index = value),
    ),
  );
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.selectedIndex, required this.onSelected});
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surface,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.2),
          blurRadius: 20,
          spreadRadius: 1,
          offset: const Offset(0, -6),
        ),
      ],
    ),
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 10, 18, 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _BottomBarItem(
              index: 0,
              icon: Icons.people_outline,
              selectedIcon: Icons.people,
              label: 'Client',
              selectedIndex: selectedIndex,
              onSelected: onSelected,
            ),
            _BottomBarItem(
              index: 1,
              icon: Icons.chat_bubble_outline,
              selectedIcon: Icons.chat_bubble,
              label: 'Chat',
              selectedIndex: selectedIndex,
              onSelected: onSelected,
            ),
            _BottomBarItem(
              index: 2,
              icon: Icons.settings_outlined,
              selectedIcon: Icons.settings,
              label: 'Setting',
              selectedIndex: selectedIndex,
              onSelected: onSelected,
            ),
          ],
        ),
      ),
    ),
  );
}

class _BottomBarItem extends StatelessWidget {
  const _BottomBarItem({
    required this.index,
    required this.icon,
    required this.selectedIcon,
    required this.label,
    required this.selectedIndex,
    required this.onSelected,
  });
  final int index;
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final selected = selectedIndex == index;
    final color = selected
        ? primaryColor
        : Theme.of(context).colorScheme.onSurfaceVariant;
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () => onSelected(index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 7),
        decoration: BoxDecoration(
          color: selected
              ? primaryColor.withValues(alpha: 0.14)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(selected ? selectedIcon : icon, color: color, size: 23),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ClientPage extends StatefulWidget {
  const ClientPage({required this.graphQL, super.key});
  final GraphQLService graphQL;
  @override
  State<ClientPage> createState() => _ClientPageState();
}

class _ClientPageState extends State<ClientPage> {
  String selectedChannel = '尚未指派社群';
  late Future<List<ClientUser>> users;
  String? _connectionMessage;

  @override
  void initState() {
    super.initState();
    users = _loadUsers();
  }

  Future<List<ClientUser>> _loadUsers() async {
    try {
      return await widget.graphQL.fetchUsers();
    } catch (_) {
      if (mounted) {
        setState(() => _connectionMessage = '客戶資料暫時無法載入');
      }
      return const [];
    }
  }

  @override
  Widget build(BuildContext context) => _PageFrame(
    title: 'Client',
    subtitle: '社群客戶',
    action: IconButton(
      onPressed: () => showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (context) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const ListTile(title: Text('切換頻道'), subtitle: Text('選擇要查看的社群頻道')),
              for (final channel in [
                '全部頻道',
                'Facebook',
                'Instagram',
                'LINE',
                'WhatsApp',
              ])
                ListTile(
                  title: Text(channel),
                  leading: Icon(
                    channel == selectedChannel
                        ? Icons.radio_button_checked
                        : Icons.radio_button_off,
                  ),
                  onTap: () {
                    Navigator.pop(context);
                  },
                ),
            ],
          ),
        ),
      ),
      icon: const Icon(Icons.tune, color: Colors.white),
    ),
    child: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const _SectionTitle(title: '頻道', action: '管理'),
        _ChannelTile(
          icon: Icons.forum_outlined,
          title: selectedChannel,
          count: 0,
        ),
        if (_connectionMessage != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              _connectionMessage!,
              style: const TextStyle(color: Colors.orange),
            ),
          ),
        const _SectionTitle(title: '用戶', action: '邀請'),
        FutureBuilder<List<ClientUser>>(
          future: users,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final loadedUsers = snapshot.data ?? const <ClientUser>[];
            if (loadedUsers.isEmpty) {
              return const _EmptyState(
                icon: Icons.people_outline,
                message: '查無任何用戶',
                detail: '連接頻道後，用戶會顯示在這裡',
              );
            }
            return Column(
              children: loadedUsers
                  .map(
                    (user) => ListTile(
                      leading: CircleAvatar(
                        child: Text(user.name.isEmpty ? '?' : user.name[0]),
                      ),
                      title: Text(user.name),
                      subtitle: Text(user.id),
                    ),
                  )
                  .toList(),
            );
          },
        ),
      ],
    ),
  );
}

class ChatPage extends StatefulWidget {
  const ChatPage({required this.graphQL, super.key});
  final GraphQLService graphQL;
  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final searchController = TextEditingController();
  String query = '';
  late Future<List<ChatConversation>> conversations;
  Timer? _pollTimer;
  bool _pollInFlight = false;
  int _pollFailures = 0;
  String? _connectionMessage;

  @override
  void initState() {
    super.initState();
    conversations = _loadInitialConversations();
    _pollTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => _refreshConversations(),
    );
  }

  Future<List<ChatConversation>> _loadInitialConversations() async {
    try {
      final result = await widget.graphQL.fetchConversations();
      if (result.isNotEmpty) return result;
    } catch (_) {
      // The demo room keeps the offline development flow usable.
    }
    return const [
      ChatConversation(
        id: 'demo',
        title: '示範聊天室',
        lastMessage: '歡迎使用 MasterBox',
      ),
    ];
  }

  Future<void> _refreshConversations() async {
    if (_pollInFlight) return;
    _pollInFlight = true;
    try {
      final latest = await widget.graphQL.fetchConversations();
      _pollFailures = 0;
      if (mounted) {
        setState(() {
          conversations = Future.value(latest);
          _connectionMessage = null;
        });
      }
    } catch (error) {
      _pollFailures++;
      if (mounted) {
        setState(() => _connectionMessage = '連線暫時中斷，將自動重試（第 $_pollFailures 次）');
      }
    } finally {
      _pollInFlight = false;
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _PageFrame(
      title: 'Chat',
      subtitle: '所有聊天室',
      action: IconButton(
        onPressed: () => searchController.clear(),
        icon: const Icon(Icons.search, color: Colors.white),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: searchController,
            onChanged: (value) => setState(() => query = value),
            decoration: InputDecoration(
              hintText: '搜尋聊天室',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                onPressed: () {
                  searchController.clear();
                  setState(() => query = '');
                },
                icon: const Icon(Icons.clear),
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (_connectionMessage != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                _connectionMessage!,
                style: const TextStyle(color: Colors.orange),
              ),
            ),
          FutureBuilder<List<ChatConversation>>(
            future: conversations,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: CircularProgressIndicator(),
                  ),
                );
              }
              if (snapshot.hasError) {
                return _ErrorRetry(
                  message: '${snapshot.error}',
                  onRetry: _refreshConversations,
                );
              }
              final rooms = (snapshot.data ?? [])
                  .where(
                    (room) => room.title.toLowerCase().contains(
                      query.trim().toLowerCase(),
                    ),
                  )
                  .toList();
              if (rooms.isEmpty && query.trim().isEmpty) {
                return _ConversationTile(
                  name: '示範聊天室',
                  preview: '歡迎使用 MasterBox',
                  time: '剛剛',
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ConversationPage(
                        graphQL: widget.graphQL,
                        conversation: const ChatConversation(
                          id: 'demo',
                          title: '示範聊天室',
                          lastMessage: '歡迎使用 MasterBox',
                        ),
                      ),
                    ),
                  ),
                );
              }
              if (rooms.isEmpty) {
                return const _EmptyState(
                  icon: Icons.chat_bubble_outline,
                  message: '找不到聊天室',
                  detail: '目前沒有可顯示的對話',
                );
              }
              return Column(
                children: rooms
                    .map(
                      (room) => _ConversationTile(
                        name: room.title,
                        preview: room.lastMessage,
                        time: '',
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ConversationPage(
                              graphQL: widget.graphQL,
                              conversation: room,
                            ),
                          ),
                        ),
                      ),
                    )
                    .toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({
    required this.onThemeModeChanged,
    required this.onLogout,
    super.key,
  });
  final ValueChanged<bool> onThemeModeChanged;
  final VoidCallback onLogout;
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool notifications = true;
  bool darkMode = false;
  String language = '繁體中文';

  @override
  void initState() {
    super.initState();
    darkMode =
        WidgetsBinding.instance.platformDispatcher.platformBrightness ==
        Brightness.dark;
    SharedPreferences.getInstance().then((prefs) {
      if (!mounted) return;
      setState(() {
        notifications = prefs.getBool('notifications') ?? true;
        darkMode = prefs.getBool('dark_mode') ?? darkMode;
        language = prefs.getString('language') ?? '繁體中文';
      });
    });
  }

  Future<void> _save(String key, Object value) async {
    final prefs = await SharedPreferences.getInstance();
    if (value is bool) await prefs.setBool(key, value);
    if (value is String) await prefs.setString(key, value);
  }

  @override
  Widget build(BuildContext context) => _PageFrame(
    title: '設定',
    subtitle: 'MasterBox',
    child: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const _SectionTitle(title: '偏好設定'),
        Card(
          child: Column(
            children: [
              SwitchListTile(
                title: const Text('訊息通知'),
                subtitle: const Text('收到新訊息時通知我'),
                value: notifications,
                onChanged: (v) {
                  setState(() => notifications = v);
                  _save('notifications', v);
                },
              ),
              SwitchListTile(
                title: const Text('深色模式'),
                value: darkMode,
                onChanged: (v) {
                  setState(() => darkMode = v);
                  widget.onThemeModeChanged(v);
                  _save('dark_mode', v);
                },
              ),
              ListTile(
                leading: const Icon(Icons.language),
                title: const Text('語言'),
                trailing: DropdownButton<String>(
                  value: language,
                  underline: const SizedBox.shrink(),
                  items: const [
                    DropdownMenuItem(value: '繁體中文', child: Text('繁體中文')),
                    DropdownMenuItem(value: 'English', child: Text('English')),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      setState(() => language = value);
                      _save('language', value);
                    }
                  },
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const _SectionTitle(title: '靈動島預覽'),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.dynamic_feed, color: primaryColor),
                title: const Text('啟動 Live Activity'),
                subtitle: const Text('先啟動通知，再選擇下方 5 種 Figma 狀態'),
                onTap: () async {
                  try {
                    await DynamicIslandService.start(
                      conversationId: 'demo-conversation',
                      title: 'MasterBox 對話',
                      detail: '正在處理新訊息',
                    );
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Live Activity 已啟動')),
                      );
                    }
                  } on PlatformException catch (error) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('啟動失敗：${error.message}')),
                      );
                    }
                  }
                },
              ),
              ...[
                (stage: 1, title: '訊息通知', detail: '收到新的客服訊息'),
                (stage: 2, title: '訊息通知／點一下開啟', detail: '點一下查看新的訊息'),
                (stage: 3, title: '指派通知', detail: '有新的任務指派給你'),
                (stage: 4, title: '指派通知／點一下開啟', detail: '點一下查看指派內容'),
                (stage: 5, title: '訂閱過期通知', detail: '訂閱已過期，請立即續約'),
              ].map(
                (state) => ListTile(
                  leading: Icon(
                    state.stage == 5
                        ? Icons.warning_amber_rounded
                        : state.stage.isEven
                        ? Icons.open_in_new
                        : Icons.notifications_none,
                    color: state.stage == 5 ? Colors.redAccent : primaryColor,
                  ),
                  title: Text(state.title),
                  subtitle: Text(state.detail),
                  onTap: () async {
                    await DynamicIslandService.update(
                      title: state.title,
                      detail: state.detail,
                      progress: 0,
                      stage: state.stage,
                    );
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('已切換至：${state.title}')),
                      );
                    }
                  },
                ),
              ),
              ListTile(
                leading: const Icon(Icons.stop_circle_outlined),
                title: const Text('結束示範'),
                onTap: () async {
                  await DynamicIslandService.end();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Live Activity 已結束')),
                    );
                  }
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const _SectionTitle(title: '帳戶與連線'),
        Card(
          child: Column(
            children: [
              const ListTile(
                leading: Icon(Icons.person_outline),
                title: Text('帳戶'),
                subtitle: Text('開發模式'),
              ),
              const ListTile(
                leading: Icon(Icons.cloud_outlined),
                title: Text('API 連線'),
                subtitle: Text('尚未連接'),
              ),
              const ListTile(
                leading: Icon(Icons.info_outline),
                title: Text('關於 MasterBox'),
                trailing: Text('v1.0.0'),
              ),
              ListTile(
                leading: const Icon(Icons.logout),
                title: const Text('登出'),
                onTap: widget.onLogout,
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

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
  final controller = TextEditingController();
  final localMessages = <ChatMessage>[];
  final imagePicker = ImagePicker();
  PlatformFile? pendingFile;
  late Future<List<ChatMessage>> messages;
  Timer? _pollTimer;
  bool _pollInFlight = false;
  int _pollFailures = 0;
  String? _connectionMessage;

  late EncryptionMode _encryptionMode;
  late int _disappearingSeconds;

  @override
  void initState() {
    super.initState();
    _encryptionMode = widget.conversation.encryptionMode;
    _disappearingSeconds = widget.conversation.disappearingMessageSeconds;
    messages = widget.graphQL.fetchMessages(widget.conversation.id);
    _pollTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) => _refreshMessages(),
    );
  }

  Future<void> _refreshMessages() async {
    if (_pollInFlight) return;
    _pollInFlight = true;
    try {
      final latest = await widget.graphQL.fetchMessages(widget.conversation.id);
      _pollFailures = 0;
      if (mounted) {
        setState(() {
          messages = Future.value(latest);
          _connectionMessage = null;
        });
      }
    } catch (_) {
      _pollFailures++;
      if (mounted) {
        setState(() => _connectionMessage = '連線暫時中斷，將自動重試（第 $_pollFailures 次）');
      }
    } finally {
      _pollInFlight = false;
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    controller.dispose();
    super.dispose();
  }

  Future<void> _retry(ChatMessage message) async {
    final index = localMessages.indexWhere((item) => item.id == message.id);
    if (index < 0) return;
    if (mounted) {
      setState(
        () => localMessages[index] = message.copyWith(
          failed: false,
          sending: true,
        ),
      );
    }
    try {
      await widget.graphQL.sendMessage(
        conversationId: widget.conversation.id,
        contents: message.text,
        attachment: message.attachment,
      );
      if (mounted) {
        setState(
          () => localMessages[index] = message.copyWith(
            failed: false,
            sending: false,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => localMessages[index] = message.copyWith(
            failed: true,
            sending: false,
          ),
        );
      }
    }
  }

  Future<void> _showAttachmentOptions() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(
              leading: Icon(Icons.attach_file),
              title: Text('新增附件'),
              subtitle: Text('選擇後可在送出前預覽'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('選擇圖片'),
              onTap: () async {
                final navigator = Navigator.of(context);
                final image = await imagePicker.pickImage(
                  source: ImageSource.gallery,
                );
                if (image != null) {
                  final size = await image.length();
                  if (!mounted) return;
                  setState(
                    () => pendingFile = PlatformFile(
                      name: image.name,
                      path: image.path,
                      size: size,
                    ),
                  );
                  navigator.pop();
                }
              },
            ),
            ListTile(
              leading: const Icon(Icons.insert_drive_file_outlined),
              title: const Text('選擇檔案'),
              onTap: () async {
                final navigator = Navigator.of(context);
                final result = await FilePicker.platform.pickFiles(
                  withData: false,
                );
                if (result != null && result.files.isNotEmpty) {
                  if (!mounted) return;
                  setState(() => pendingFile = result.files.single);
                  navigator.pop();
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _startCall(String kind) async {
    try {
      final call = await widget.graphQL.startCall(
        conversationId: widget.conversation.id,
        kind: kind,
      );
      final token = await widget.graphQL.fetchLiveKitToken(callId: call.id);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) =>
              CallPage(graphQL: widget.graphQL, call: call, token: token),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
      }
    }
  }

  Future<void> _showChatSettings() async {
    var mode = _encryptionMode;
    var seconds = _disappearingSeconds;
    final saved = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<EncryptionMode>(
                  initialValue: mode,
                  decoration: const InputDecoration(labelText: '加密模式'),
                  items: EncryptionMode.values
                      .map(
                        (item) => DropdownMenuItem(
                          value: item,
                          child: Text(item.label),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setSheetState(() => mode = value ?? mode),
                ),
                DropdownButtonFormField<int>(
                  initialValue: seconds,
                  decoration: const InputDecoration(labelText: '消失訊息'),
                  items: const [0, 30, 300, 3600, 86400]
                      .map(
                        (item) => DropdownMenuItem(
                          value: item,
                          child: Text(item == 0 ? '關閉' : '$item 秒後刪除'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setSheetState(() => seconds = value ?? seconds),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () async {
                    setSheetState(() {});
                    try {
                      await widget.graphQL.updateConversationSettings(
                        conversationId: widget.conversation.id,
                        encryptionMode: mode,
                        disappearingMessageSeconds: seconds,
                      );
                      if (sheetContext.mounted) {
                        Navigator.pop(sheetContext, true);
                      }
                    } catch (error) {
                      if (sheetContext.mounted) {
                        ScaffoldMessenger.of(sheetContext)
                            .showSnackBar(SnackBar(content: Text('$error')));
                      }
                    }
                  },
                  child: const Text('儲存設定'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (saved == true && mounted) {
      setState(() {
        _encryptionMode = mode;
        _disappearingSeconds = seconds;
      });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.conversation.title),
      actions: [
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
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: Row(
            children: [
              Icon(
                _encryptionMode == EncryptionMode.endToEnd
                    ? Icons.lock
                    : Icons.shield_outlined,
                size: 16,
              ),
              const SizedBox(width: 8),
              Expanded(child: Text(_encryptionMode.label)),
              if (_disappearingSeconds > 0)
                Text(
                  '消失：${_disappearingSeconds}s',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
            ],
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
        Expanded(
          child: FutureBuilder<List<ChatMessage>>(
            future: messages,
            builder: (context, snapshot) {
              if (snapshot.hasError && localMessages.isEmpty) {
                return _ErrorRetry(
                  message: '${snapshot.error}',
                  onRetry: () {
                    setState(() {
                      messages = widget.graphQL.fetchMessages(
                        widget.conversation.id,
                      );
                    });
                  },
                );
              }
              final items = [
                ...(snapshot.data ?? const <ChatMessage>[]),
                ...localMessages,
              ];
              if (items.isEmpty) {
                return const _EmptyState(
                  icon: Icons.forum_outlined,
                  message: '尚無訊息',
                );
              }
              return ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                itemBuilder: (_, i) {
                  final message = items[i];
                  return Align(
                    alignment: message.isMine
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: GestureDetector(
                      onLongPress: message.failed
                          ? () => _retry(message)
                          : null,
                      child: Card(
                        color: message.failed
                            ? Colors.red.withValues(alpha: 0.15)
                            : (message.isMine
                                  ? primaryColor.withValues(alpha: 0.2)
                                  : Theme.of(context)
                                        .colorScheme
                                        .surfaceContainerHighest),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(message.text.isEmpty ? '附件' : message.text),
                              if (message.attachment != null)
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: Text(
                                    '附件：${message.attachment!['name']} (${message.attachment!['size']} bytes)',
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall,
                                  ),
                                ),
                              if (message.sending)
                                const Padding(
                                  padding: EdgeInsets.only(top: 4),
                                  child: SizedBox(
                                    width: 12,
                                    height: 12,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  ),
                                ),
                              if (message.failed)
                                TextButton(
                                  onPressed: () => _retry(message),
                                  child: const Text('重試'),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Column(
              children: [
                if (pendingFile != null)
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.attach_file),
                      title: Text(pendingFile!.name),
                      subtitle: Text('${pendingFile!.size} bytes · 尚未上傳'),
                      trailing: IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => setState(() => pendingFile = null),
                      ),
                    ),
                  ),
                Row(
                  children: [
                    IconButton(
                      onPressed: _showAttachmentOptions,
                      tooltip: '新增附件',
                      icon: const Icon(Icons.attach_file),
                    ),
                    Expanded(
                      child: TextField(
                        controller: controller,
                        decoration: const InputDecoration(hint: Text('輸入訊息…')),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      key: const ValueKey('send-message'),
                      onPressed: () {
                        final text = controller.text.trim();
                        final file = pendingFile;
                        if (text.isNotEmpty || file != null) {
                          final attachment = file == null
                              ? null
                              : <String, dynamic>{
                                  'name': file.name,
                                  'size': file.size,
                                  'path': file.path,
                                  'type': 'file',
                                };
                          final outgoing = ChatMessage(
                            id: 'local-${localMessages.length}',
                            text: text,
                            sentAt: DateTime.now(),
                            isMine: true,
                            sending: true,
                            attachment: attachment,
                          );
                          setState(() {
                            localMessages.add(outgoing);
                            controller.clear();
                            pendingFile = null;
                          });
                          _retry(outgoing);
                        }
                      },
                      icon: const Icon(Icons.send),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

class _ErrorRetry extends StatelessWidget {
  const _ErrorRetry({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.cloud_off, size: 40),
        const SizedBox(height: 8),
        Text(message, textAlign: TextAlign.center),
        TextButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh),
          label: const Text('重試'),
        ),
      ],
    ),
  );
}

class _PageFrame extends StatelessWidget {
  const _PageFrame({
    required this.title,
    required this.subtitle,
    required this.child,
    this.action,
  });
  final String title, subtitle;
  final Widget child;
  final Widget? action;
  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: const SystemUiOverlayStyle(
      statusBarColor: primaryColor,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
    ),
    child: Column(
      children: [
        Container(
          color: primaryColor,
          padding: EdgeInsets.fromLTRB(
            20,
            MediaQuery.paddingOf(context).top + 16,
            12,
            20,
          ),
          child: Row(
            children: [
              const CircleAvatar(
                backgroundColor: Colors.white,
                child: Icon(Icons.inventory_2_outlined, color: primaryColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(color: Colors.white70),
                    ),
                  ],
                ),
              ),
              ...?action == null ? null : <Widget>[action!],
            ],
          ),
        ),
        Expanded(child: child),
      ],
    ),
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.action});
  final String title;
  final String? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        const Spacer(),
        if (action != null)
          Text(
            action!,
            style: TextStyle(color: Theme.of(context).colorScheme.primary),
          ),
      ],
    ),
  );
}

class _ChannelTile extends StatelessWidget {
  const _ChannelTile({
    required this.icon,
    required this.title,
    required this.count,
  });
  final IconData icon;
  final String title;
  final int count;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 8),
    color: Theme.of(context).colorScheme.surface,
    child: ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: CircleAvatar(
        backgroundColor: primaryColor.withValues(alpha: 0.16),
        foregroundColor: primaryColor,
        child: Icon(icon, size: 20),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      trailing: Text(
        '$count',
        style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
      ),
    ),
  );
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({
    required this.name,
    required this.preview,
    required this.time,
    required this.onTap,
  });
  final String name, preview, time;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 8),
    color: Theme.of(context).colorScheme.surface,
    child: ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      leading: const CircleAvatar(
        backgroundColor: Color(0xFFFFEED7),
        foregroundColor: primaryColor,
        child: Icon(Icons.person_outline),
      ),
      title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text(preview, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      trailing: Text(
        time,
        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
      ),
    ),
  );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.icon, required this.message, this.detail});
  final IconData icon;
  final String message;
  final String? detail;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 52, color: Colors.grey.shade400),
          const SizedBox(height: 12),
          Text(
            message,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          if (detail != null) ...[
            const SizedBox(height: 6),
            Text(
              detail!,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600),
            ),
          ],
        ],
      ),
    ),
  );
}
