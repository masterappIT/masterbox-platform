import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'services/graphql_service.dart';
import 'services/dynamic_island_service.dart';
import 'models/app_models.dart';
import 'call_page.dart';
import 'pages/channels_page.dart';
import 'pages/manage_page.dart';
import 'pages/users_page.dart';
import 'widgets/common.dart';

const authBlue = primaryColor;

void main() => runApp(const MasterBoxApp());

class MasterBoxApp extends StatefulWidget {
  const MasterBoxApp({this.graphQL, super.key});

  /// Tests pass a service with a stubbed connection.
  final GraphQLService? graphQL;

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
      home: AppRoot(onThemeModeChanged: setThemeMode, graphQL: widget.graphQL),
      onUnknownRoute: (settings) => MaterialPageRoute(
        builder: (_) =>
            AppRoot(onThemeModeChanged: setThemeMode, graphQL: widget.graphQL),
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
  const AppRoot({required this.onThemeModeChanged, this.graphQL, super.key});
  final ValueChanged<bool> onThemeModeChanged;
  final GraphQLService? graphQL;
  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  bool signedIn = false;
  bool restoring = false;
  late final GraphQLService graphQL = (widget.graphQL ?? GraphQLService())
    ..onTokensChanged = _saveSession
    ..onSessionExpired = handleLogout;

  @override
  void initState() {
    super.initState();
    restoreSession();
  }

  @override
  void dispose() {
    graphQL.stopRealtime();
    super.dispose();
  }

  Future<void> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final storedRole = prefs.getString('account_role');
    graphQL
      ..token = prefs.getString('auth_token')
      ..refreshToken = prefs.getString('refresh_token')
      ..accountId = prefs.getString('account_id')
      ..companyId = prefs.getString('company_id')
      ..account = CurrentAccount(
        id: prefs.getString('account_id'),
        email: prefs.getString('account_email'),
        role: storedRole,
        name: prefs.getString('account_name'),
        companyId: prefs.getString('company_id'),
      );
    // Sessions saved before roles were kept learn theirs from the refresh.
    if (graphQL.refreshToken?.isNotEmpty == true &&
        (!graphQL.isAuthenticated || storedRole == null)) {
      try {
        await graphQL.refresh();
      } catch (_) {
        // Offline: carry on with what was saved and retry on the next request.
      }
    }
    if (!mounted) return;
    setState(() {
      signedIn = graphQL.isAuthenticated;
      restoring = false;
    });
  }

  Future<void> _saveSession() async {
    final prefs = await SharedPreferences.getInstance();
    Future<void> save(String key, String? value) async {
      if (value?.isNotEmpty == true) await prefs.setString(key, value!);
    }

    await save('auth_token', graphQL.token);
    await save('refresh_token', graphQL.refreshToken);
    await save('account_id', graphQL.accountId);
    await save('company_id', graphQL.companyId);
    await save('account_email', graphQL.account?.email);
    await save('account_role', graphQL.account?.role);
    await save('account_name', graphQL.account?.name);
  }

  Future<void> _startSession(AuthTokens tokens) async {
    graphQL
      ..token = tokens.token
      ..refreshToken = tokens.refreshToken
      ..accountId = tokens.accountId
      ..companyId = tokens.companyId
      ..account = tokens.account;
    await _saveSession();
    if (!mounted) return;
    setState(() => signedIn = true);
  }

  Future<void> handleLogin(String email, String password) async {
    final tokens = await graphQL.authenticate(email: email, password: password);
    if (!mounted) return;
    await _startSession(tokens);
  }

  Future<void> handleRegister(CompanyRegistration input) async {
    final tokens = await graphQL.registerCompany(input);
    if (!mounted) return;
    await _startSession(tokens);
  }

  Future<void> handleLogout() async {
    graphQL.clearSession();
    final prefs = await SharedPreferences.getInstance();
    for (final key in const [
      'auth_token',
      'refresh_token',
      'account_id',
      'company_id',
      'account_email',
      'account_role',
      'account_name',
    ]) {
      await prefs.remove(key);
    }
    if (mounted) setState(() => signedIn = false);
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
            onRegister: handleRegister,
            onLogin: (email, password, developmentMode) async {
              if (kDebugMode && developmentMode) {
                try {
                  await handleLogin(
                    email.trim().isEmpty
                        ? 'demo@masterbox.local'
                        : email.trim(),
                    password,
                  );
                } catch (_) {
                  if (!mounted) return;
                  graphQL
                    ..token = developmentToken
                    ..account = const CurrentAccount(
                      id: null,
                      email: null,
                      role: 'admin',
                    );
                  setState(() => signedIn = true);
                }
              } else {
                await handleLogin(email, password);
              }
            },
          );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({required this.onLogin, this.onRegister, super.key});
  final Future<void> Function(
    String email,
    String password,
    bool developmentMode,
  )
  onLogin;
  final Future<void> Function(CompanyRegistration input)? onRegister;
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage>
    with SingleTickerProviderStateMixin {
  bool developmentMode = kDebugMode;
  bool showLoginForm = true;
  bool forgotPassword = false;
  bool registering = false;
  bool loading = false;
  String? errorMessage;
  Map<String, String> fieldErrors = const {};
  final email = TextEditingController();
  final password = TextEditingController();
  final chineseName = TextEditingController();
  final englishName = TextEditingController();
  final mobile = TextEditingController();
  String? country;
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
    chineseName.dispose();
    englishName.dispose();
    mobile.dispose();
    super.dispose();
  }

  void _setMode({bool forgot = false, bool register = false}) => setState(() {
    forgotPassword = forgot;
    registering = register;
    errorMessage = null;
    fieldErrors = const {};
  });

  Map<String, String> _registrationErrors() {
    final address = email.text.trim();
    final phone = mobile.text.trim();
    return {
      if (chineseName.text.trim().isEmpty) 'chinese_name': '請輸入中文名稱',
      if (englishName.text.trim().isEmpty) 'english_name': '請輸入英文名稱',
      if (address.isEmpty)
        'email': '請輸入電子信箱'
      else if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(address))
        'email': '電子信箱格式不正確',
      if (password.text.isEmpty) 'password': '請輸入密碼',
      if (country == null) 'country': '請選擇所在地區',
      if (phone.isEmpty)
        'mobile': '請輸入電話號碼'
      else if (phone.length < 5)
        'mobile': '電話號碼格式不正確',
    };
  }

  bool get _canSubmit {
    if (loading || forgotPassword) return false;
    if (registering) return true;
    return developmentMode ||
        (email.text.isNotEmpty && password.text.isNotEmpty);
  }

  Future<void> _submit() async {
    if (registering) {
      final found = _registrationErrors();
      setState(() => fieldErrors = found);
      if (found.isNotEmpty) return;
    }
    setState(() {
      loading = true;
      errorMessage = null;
    });
    try {
      if (registering) {
        await widget.onRegister?.call(
          CompanyRegistration(
            chineseName: chineseName.text.trim(),
            englishName: englishName.text.trim(),
            email: email.text.trim(),
            password: password.text,
            country: country!,
            mobile: mobile.text.trim(),
          ),
        );
      } else {
        await widget.onLogin(email.text.trim(), password.text, developmentMode);
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => errorMessage = error.toString().replaceFirst('Bad state: ', ''),
        );
      }
    }
    if (mounted) setState(() => loading = false);
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
                                    forgotPassword
                                        ? '重設密碼'
                                        : (registering
                                              ? '免費試用註冊'
                                              : '登入 MasterBox'),
                                    style: const TextStyle(
                                      fontSize: 22,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 18),
                                  if (forgotPassword)
                                    const Text(
                                      '目前無法自行重設密碼，請聯絡公司管理員協助重設。',
                                      textAlign: TextAlign.center,
                                    ),
                                  if (registering) ...[
                                    TextField(
                                      controller: chineseName,
                                      decoration: InputDecoration(
                                        labelText: '中文名稱',
                                        prefixIcon: const Icon(
                                          Icons.business_outlined,
                                        ),
                                        errorText: fieldErrors['chinese_name'],
                                      ),
                                    ),
                                    const SizedBox(height: 14),
                                    TextField(
                                      controller: englishName,
                                      decoration: InputDecoration(
                                        labelText: '英文名稱',
                                        prefixIcon: const Icon(
                                          Icons.business_outlined,
                                        ),
                                        errorText: fieldErrors['english_name'],
                                      ),
                                    ),
                                    const SizedBox(height: 14),
                                  ],
                                  if (!forgotPassword)
                                    TextField(
                                      controller: email,
                                      onChanged: (_) => setState(() {}),
                                      decoration: InputDecoration(
                                        labelText: 'Email',
                                        prefixIcon: const Icon(
                                          Icons.email_outlined,
                                        ),
                                        errorText: fieldErrors['email'],
                                      ),
                                    ),
                                  if (!forgotPassword) ...[
                                    const SizedBox(height: 14),
                                    TextField(
                                      controller: password,
                                      onChanged: (_) => setState(() {}),
                                      obscureText: true,
                                      decoration: InputDecoration(
                                        labelText: '密碼',
                                        prefixIcon: const Icon(
                                          Icons.lock_outline,
                                        ),
                                        errorText: fieldErrors['password'],
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    if (registering) ...[
                                      DropdownButtonFormField<String>(
                                        isExpanded: true,
                                        initialValue: country,
                                        decoration: InputDecoration(
                                          labelText: '所在地區',
                                          prefixIcon: const Icon(Icons.public),
                                          errorText: fieldErrors['country'],
                                        ),
                                        items: const [
                                          DropdownMenuItem(
                                            value: 'Taiwan',
                                            child: Text('Taiwan'),
                                          ),
                                          DropdownMenuItem(
                                            value: 'Hong Kong',
                                            child: Text('Hong Kong'),
                                          ),
                                        ],
                                        onChanged: (value) =>
                                            setState(() => country = value),
                                      ),
                                      const SizedBox(height: 14),
                                      TextField(
                                        controller: mobile,
                                        keyboardType: TextInputType.phone,
                                        decoration: InputDecoration(
                                          labelText: '電話號碼',
                                          prefixIcon: const Icon(
                                            Icons.phone_outlined,
                                          ),
                                          errorText: fieldErrors['mobile'],
                                        ),
                                      ),
                                    ],
                                    if (kDebugMode && !registering)
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
                                  if (!forgotPassword)
                                    SizedBox(
                                      width: double.infinity,
                                      child: FilledButton.icon(
                                        onPressed: _canSubmit ? _submit : null,
                                        icon: loading
                                            ? const SizedBox(
                                                width: 18,
                                                height: 18,
                                                child:
                                                    CircularProgressIndicator(
                                                      strokeWidth: 2,
                                                    ),
                                              )
                                            : const Icon(Icons.login),
                                        label: Text(
                                          loading
                                              ? (registering ? '註冊中…' : '登入中…')
                                              : (registering
                                                    ? '立即註冊'
                                                    : (developmentMode
                                                          ? '以開發模式進入'
                                                          : '登入')),
                                        ),
                                      ),
                                    ),
                                  const SizedBox(height: 8),
                                  if (!forgotPassword && !registering)
                                    TextButton(
                                      onPressed: () => _setMode(forgot: true),
                                      child: const Text('忘記密碼？'),
                                    ),
                                  if (widget.onRegister != null && !registering)
                                    TextButton(
                                      onPressed: () => _setMode(register: true),
                                      child: const Text('免費試用註冊'),
                                    ),
                                  if (forgotPassword || registering)
                                    TextButton(
                                      onPressed: () => _setMode(),
                                      child: const Text('返回登入'),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      const SizedBox(height: 18),
                      if (kDebugMode)
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

  StreamSubscription<ChatMessage>? _newMessages;
  final _announced = <String>{};

  bool get _isAdmin => widget.graphQL.account?.isAdmin == true;

  @override
  void initState() {
    super.initState();
    _newMessages = widget.graphQL.messageEvents.listen(_announce);
    widget.graphQL.startRealtime();
  }

  @override
  void dispose() {
    _newMessages?.cancel();
    super.dispose();
  }

  /// The settings page's notification switch. Works while the app is open;
  /// there is no push service behind it yet.
  Future<void> _announce(ChatMessage message) async {
    if (message.isMine || message.roomId == widget.graphQL.openRoomId) return;
    // A message is sent again whenever it changes, such as being read.
    if (!_announced.add(message.id)) return;
    final prefs = await SharedPreferences.getInstance();
    if (!mounted || prefs.getBool('notifications') == false) return;
    final text = message.text.isEmpty ? '傳來一則附件' : message.text;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '新訊息：$text',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        action: SnackBarAction(
          label: '查看',
          onPressed: () => _openRoom(message.roomId),
        ),
      ),
    );
  }

  Future<void> _openRoom(String? roomId) async {
    try {
      final rooms = await widget.graphQL.fetchConversations();
      final room = rooms.where((item) => item.messageRoomId == roomId);
      if (mounted && room.isNotEmpty) _openConversation(room.first);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('目前無法開啟對話，請稍後再試')));
      }
    }
  }

  void _openConversation(ChatConversation conversation) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ConversationPage(
          graphQL: widget.graphQL,
          conversation: conversation,
        ),
      ),
    );
  }

  void _openChannels() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ChannelsPage(graphQL: widget.graphQL),
      ),
    );
  }

  void _addUser() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => UserFormPage(graphQL: widget.graphQL),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = _isAdmin;
    final pages = <Widget>[
      ClientPage(
        graphQL: widget.graphQL,
        onOpenConversation: _openConversation,
        onManageChannels: isAdmin ? _openChannels : null,
        onInvite: isAdmin ? _addUser : null,
      ),
      ChatPage(
        graphQL: widget.graphQL,
        onOpenConversation: _openConversation,
        onManageChannels: isAdmin ? _openChannels : null,
      ),
      if (isAdmin)
        ManagePage(
          graphQL: widget.graphQL,
          onOpenConversation: _openConversation,
          onOpenCustomers: () => setState(() => index = 0),
        ),
      SettingsPage(
        graphQL: widget.graphQL,
        onThemeModeChanged: widget.onThemeModeChanged,
        onLogout: widget.onLogout,
      ),
    ];
    return Scaffold(
      body: pages[index.clamp(0, pages.length - 1)],
      bottomNavigationBar: _BottomBar(
        selectedIndex: index,
        showManage: isAdmin,
        onSelected: (value) => setState(() => index = value),
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.selectedIndex,
    required this.onSelected,
    this.showManage = false,
  });
  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final bool showManage;

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
        padding: const EdgeInsets.fromLTRB(8, 10, 8, 8),
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
            if (showManage)
              _BottomBarItem(
                index: 2,
                icon: Icons.dashboard_outlined,
                selectedIcon: Icons.dashboard,
                label: 'Manage',
                selectedIndex: selectedIndex,
                onSelected: onSelected,
              ),
            _BottomBarItem(
              index: showManage ? 3 : 2,
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
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => onSelected(index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 7),
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
      ),
    );
  }
}

/// What the Client page's channel switcher has picked.
class _CustomerFilter {
  const _CustomerFilter({required this.label, this.platform, this.channelId});
  final String label;
  final String? platform;
  final String? channelId;

  bool matches(Customer customer) =>
      (platform == null || customer.platform == platform) &&
      (channelId == null || customer.channelId == channelId);
}

const _allChannelsFilter = _CustomerFilter(label: '全部頻道');
const _platformFilters = [
  _allChannelsFilter,
  _CustomerFilter(label: 'Facebook', platform: 'fb'),
  _CustomerFilter(label: 'Instagram', platform: 'ig'),
  _CustomerFilter(label: 'LINE', platform: 'line'),
  _CustomerFilter(label: 'WhatsApp', platform: 'whatsapp'),
];

class ClientPage extends StatefulWidget {
  const ClientPage({
    required this.graphQL,
    this.onOpenConversation,
    this.onManageChannels,
    this.onInvite,
    super.key,
  });
  final GraphQLService graphQL;
  final ValueChanged<ChatConversation>? onOpenConversation;
  final VoidCallback? onManageChannels;
  final VoidCallback? onInvite;
  @override
  State<ClientPage> createState() => _ClientPageState();
}

class _ClientPageState extends State<ClientPage> {
  String selectedChannel = '尚未指派社群';
  _CustomerFilter filter = _allChannelsFilter;
  List<SocialChannel> channels = const [];
  List<Customer> customers = const [];
  bool customersLoading = true;
  String customerQuery = '';
  late Future<List<ClientUser>> users;
  String? _connectionMessage;

  bool get _canListUsers => widget.graphQL.account?.isAdmin == true;

  @override
  void initState() {
    super.initState();
    users = _loadUsers();
    _loadCustomers();
  }

  Future<List<ClientUser>> _loadUsers() async {
    // Only admins may list the team; the backend refuses everyone else.
    if (!_canListUsers) return const [];
    try {
      return await widget.graphQL.fetchUsers();
    } catch (_) {
      if (mounted) {
        setState(() => _connectionMessage = '客戶資料暫時無法載入');
      }
      return const [];
    }
  }

  Future<void> _loadCustomers() async {
    try {
      final loadedChannels = await widget.graphQL.fetchChannels();
      final rooms = await widget.graphQL.fetchConversations();
      if (!mounted) return;
      setState(() {
        channels = loadedChannels;
        customers = customersFromRooms(rooms, loadedChannels);
        customersLoading = false;
        _connectionMessage = null;
        if (loadedChannels.isNotEmpty) selectedChannel = filter.label;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        customersLoading = false;
        _connectionMessage = '客戶資料暫時無法載入';
      });
    }
  }

  Future<void> _reload() async {
    setState(() {
      users = _loadUsers();
    });
    await _loadCustomers();
  }

  void _pick(_CustomerFilter value) => setState(() {
    filter = value;
    selectedChannel = value.label;
  });

  List<Customer> get _visibleCustomers {
    final query = customerQuery.trim().toLowerCase();
    return customers
        .where(
          (customer) =>
              filter.matches(customer) &&
              (query.isEmpty ||
                  customer.name.toLowerCase().contains(query) ||
                  customer.id.toLowerCase().contains(query)),
        )
        .toList();
  }

  void _showChannelSwitcher() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const ListTile(title: Text('切換頻道'), subtitle: Text('選擇要查看的社群頻道')),
              for (final option in [
                ..._platformFilters,
                for (final channel in channels)
                  _CustomerFilter(label: channel.name, channelId: channel.id),
              ])
                ListTile(
                  title: Text(option.label),
                  leading: Icon(
                    option.label == filter.label
                        ? Icons.radio_button_checked
                        : Icons.radio_button_off,
                  ),
                  onTap: () {
                    _pick(option);
                    Navigator.pop(context);
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visibleCustomers;
    return PageFrame(
      title: 'Client',
      subtitle: '社群客戶',
      action: IconButton(
        onPressed: _showChannelSwitcher,
        icon: const Icon(Icons.tune, color: Colors.white),
      ),
      child: RefreshIndicator(
        onRefresh: _reload,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            SectionTitle(
              title: '頻道',
              action: widget.onManageChannels == null ? null : '管理',
              onAction: widget.onManageChannels,
            ),
            ChannelTile(
              icon: Icons.forum_outlined,
              title: selectedChannel,
              count: visible.length,
            ),
            if (_connectionMessage != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  _connectionMessage!,
                  style: const TextStyle(color: Colors.orange),
                ),
              ),
            const SectionTitle(title: '客戶'),
            TextField(
              onChanged: (value) => setState(() => customerQuery = value),
              decoration: const InputDecoration(
                hintText: '依名稱或帳號ID搜尋',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            const SizedBox(height: 8),
            if (customersLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (visible.isEmpty)
              EmptyState(
                icon: Icons.person_search_outlined,
                message: customers.isEmpty ? '目前還沒有客戶' : '找不到符合條件的客戶',
                detail: customers.isEmpty ? '客戶傳訊息進來後，就會出現在這裡。' : null,
              )
            else
              for (final customer in visible)
                ConversationTile(
                  name: customer.displayName,
                  preview:
                      '${platformLabel(customer.platform)} · ${customer.channelName}',
                  time: formatRelativeTime(customer.lastInteraction),
                  avatarUrl: customer.avatarUrl,
                  platform: customer.platform,
                  onTap: () =>
                      widget.onOpenConversation?.call(customer.conversation),
                ),
            const SizedBox(height: 12),
            SectionTitle(
              title: '用戶',
              action: widget.onInvite == null ? null : '邀請',
              onAction: widget.onInvite,
            ),
            FutureBuilder<List<ClientUser>>(
              future: users,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                final loadedUsers = snapshot.data ?? const <ClientUser>[];
                if (loadedUsers.isEmpty) {
                  return EmptyState(
                    icon: Icons.people_outline,
                    message: '查無任何用戶',
                    detail: _canListUsers ? '新增使用者後，就會顯示在這裡' : '只有管理者可以查看成員列表',
                  );
                }
                return Column(
                  children: loadedUsers
                      .map(
                        (user) => ListTile(
                          leading: PersonAvatar(
                            name: user.name,
                            imageUrl: user.avatarUrl,
                          ),
                          title: Text(user.name),
                          subtitle: Text(user.email ?? user.id),
                        ),
                      )
                      .toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class ChatPage extends StatefulWidget {
  const ChatPage({
    required this.graphQL,
    this.onOpenConversation,
    this.onManageChannels,
    super.key,
  });
  final GraphQLService graphQL;
  final ValueChanged<ChatConversation>? onOpenConversation;
  final VoidCallback? onManageChannels;
  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  static const _demoRoom = ChatConversation(
    id: 'demo',
    title: '示範聊天室',
    lastMessage: '歡迎使用 MasterBox',
  );

  final searchController = TextEditingController();
  final searchFocus = FocusNode();

  String query = '';
  late Future<List<ChatConversation>> conversations;
  List<SocialChannel>? channels;
  String? selectedChannelId;
  Timer? _pollTimer;
  StreamSubscription<ChatMessage>? _messageEvents;
  bool _pollInFlight = false;
  int _pollFailures = 0;
  String? _connectionMessage;

  bool get _isDevelopment => widget.graphQL.isDevelopmentSession;

  @override
  void initState() {
    super.initState();
    conversations = _loadInitialConversations();
    _loadChannels();
    _pollTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => _refreshConversations(),
    );
    _messageEvents = widget.graphQL.messageEvents.listen(
      (_) => _refreshConversations(),
    );
  }

  Future<void> _loadChannels() async {
    try {
      final result = await widget.graphQL.fetchChannels();
      if (mounted) setState(() => channels = result);
    } catch (_) {
      // The conversations' own error says the connection is down.
    }
  }

  Future<List<ChatConversation>> _loadInitialConversations() async {
    if (!_isDevelopment) return widget.graphQL.fetchConversations();
    try {
      final result = await widget.graphQL.fetchConversations();
      if (result.isNotEmpty) return result;
    } catch (_) {
      // The demo room keeps the offline development flow usable.
    }
    return const [_demoRoom];
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

  Future<void> _refreshAll() async {
    await Future.wait([_refreshConversations(), _loadChannels()]);
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _messageEvents?.cancel();
    searchFocus.dispose();
    searchController.dispose();
    super.dispose();
  }

  void _clearSearch() {
    searchController.clear();
    setState(() => query = '');
  }

  void _open(ChatConversation room) {
    final open = widget.onOpenConversation;
    if (open != null) {
      open(room);
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) =>
            ConversationPage(graphQL: widget.graphQL, conversation: room),
      ),
    );
  }

  /// The company's rooms narrowed to the channels this account can use, as the
  /// admin inbox does. Until the channels are known, nothing is hidden.
  List<ChatConversation> _visibleRooms(List<ChatConversation> rooms) {
    final known = channels;
    final search = query.trim().toLowerCase();
    return rooms.where((room) {
      if (known != null &&
          room.platform != null &&
          !known.any((channel) => channel.id == room.channelId)) {
        return false;
      }
      if (selectedChannelId != null && room.channelId != selectedChannelId) {
        return false;
      }
      return room.title.toLowerCase().contains(search);
    }).toList();
  }

  Widget _channelFilter(List<SocialChannel> items) => SizedBox(
    height: 48,
    child: ListView(
      scrollDirection: Axis.horizontal,
      children: [
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: ChoiceChip(
            label: const Text('全部頻道'),
            selected: selectedChannelId == null,
            onSelected: (_) => setState(() => selectedChannelId = null),
          ),
        ),
        for (final channel in items)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              avatar: Icon(platformIcon(channel.platform), size: 16),
              label: Text(channel.name),
              selected: selectedChannelId == channel.id,
              onSelected: (_) => setState(() => selectedChannelId = channel.id),
            ),
          ),
      ],
    ),
  );

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
    return const EmptyState(
      icon: Icons.chat_bubble_outline,
      message: '目前還沒有對話',
      detail: '客戶傳訊息到這個社群平台後，對話就會出現在這裡。',
    );
  }

  @override
  Widget build(BuildContext context) {
    final known = channels;
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
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextField(
              controller: searchController,
              focusNode: searchFocus,
              onChanged: (value) => setState(() => query = value),
              decoration: InputDecoration(
                hintText: '搜尋聊天室',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  onPressed: _clearSearch,
                  icon: const Icon(Icons.clear),
                ),
              ),
            ),
            const SizedBox(height: 8),
            if (known != null && known.isNotEmpty) _channelFilter(known),
            const SizedBox(height: 8),
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
                // A refresh swaps the future; keep showing the list meanwhile.
                if (snapshot.connectionState == ConnectionState.waiting &&
                    !snapshot.hasData) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: CircularProgressIndicator(),
                    ),
                  );
                }
                if (snapshot.hasError) {
                  return ErrorRetry(
                    message: '${snapshot.error}',
                    onRetry: _refreshConversations,
                  );
                }
                final rooms = _visibleRooms(snapshot.data ?? const []);
                if (rooms.isEmpty && query.trim().isEmpty) {
                  if (!_isDevelopment) return _noRooms();
                  return ConversationTile(
                    name: _demoRoom.title,
                    preview: _demoRoom.lastMessage,
                    time: '剛剛',
                    onTap: () => _open(_demoRoom),
                  );
                }
                if (rooms.isEmpty) {
                  return const EmptyState(
                    icon: Icons.chat_bubble_outline,
                    message: '找不到聊天室',
                    detail: '目前沒有可顯示的對話',
                  );
                }
                return Column(
                  children: rooms
                      .map(
                        (room) => ConversationTile(
                          name: room.title,
                          preview: room.lastMessage.isNotEmpty
                              ? room.lastMessage
                              : (known
                                        ?.where(
                                          (channel) =>
                                              channel.id == room.channelId,
                                        )
                                        .firstOrNull
                                        ?.name ??
                                    platformLabel(room.platform)),
                          time: formatRelativeTime(room.updatedAt),
                          avatarUrl: room.customer?.avatarUrl,
                          platform: room.platform,
                          onTap: () => _open(room),
                        ),
                      )
                      .toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({
    required this.graphQL,
    required this.onThemeModeChanged,
    required this.onLogout,
    super.key,
  });
  final GraphQLService graphQL;
  final ValueChanged<bool> onThemeModeChanged;
  final VoidCallback onLogout;
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool notifications = true;
  bool darkMode = false;
  bool? apiReachable;

  /// Live Activities exist only on iPhones.
  bool get _liveActivitySupported =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;

  @override
  void initState() {
    super.initState();
    widget.graphQL.ping().then((reachable) {
      if (mounted) setState(() => apiReachable = reachable);
    });

    SharedPreferences.getInstance().then((prefs) {
      if (!mounted) return;
      setState(() {
        notifications = prefs.getBool('notifications') ?? true;
        darkMode = prefs.getBool('dark_mode') ?? false;
      });
    });
  }

  String get _accountSummary {
    if (widget.graphQL.isDevelopmentSession) return '開發模式';
    final account = widget.graphQL.account;
    if (account == null) return '';
    final role = accountRoleNames[account.role] ?? account.role;
    return [
      if (account.name?.isNotEmpty == true) account.name!,
      if (account.email?.isNotEmpty == true) account.email!,
      if (role?.isNotEmpty == true) role!,
    ].join(' · ');
  }

  Future<void> _save(String key, bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
  }

  Future<void> _runLiveActivity(
    Future<void> Function() action,
    String success,
  ) async {
    String result = success;
    try {
      await action();
    } on PlatformException catch (error) {
      result = '操作失敗：${error.message}';
    } on MissingPluginException {
      result = '這台裝置不支援 Live Activity';
    }
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(result)));
    }
  }

  Future<void> _confirmLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('確定要登出嗎？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('登出'),
          ),
        ],
      ),
    );
    if (confirmed == true) widget.onLogout();
  }

  @override
  Widget build(BuildContext context) => PageFrame(
    title: '設定',
    subtitle: 'MasterBox',
    child: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const SectionTitle(title: '偏好設定'),
        Card(
          child: Column(
            children: [
              SwitchListTile(
                title: const Text('訊息通知'),
                subtitle: const Text('App 開啟時，收到新訊息會跳出提示'),
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
                // The app's text is only in Traditional Chinese so far.
                trailing: DropdownButton<String>(
                  value: '繁體中文',
                  underline: const SizedBox.shrink(),
                  items: const [
                    DropdownMenuItem(value: '繁體中文', child: Text('繁體中文')),
                    DropdownMenuItem(
                      value: 'English',
                      enabled: false,
                      child: Text('English（尚未開放）'),
                    ),
                  ],
                  onChanged: (_) {},
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const SectionTitle(title: '靈動島預覽'),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.dynamic_feed, color: primaryColor),
                title: const Text('啟動 Live Activity'),
                subtitle: Text(
                  _liveActivitySupported
                      ? '先啟動通知，再選擇下方 5 種狀態'
                      : '只有 iPhone 支援 Live Activity',
                ),
                enabled: _liveActivitySupported,
                onTap: () => _runLiveActivity(
                  () => DynamicIslandService.start(
                    conversationId: 'demo-conversation',
                    title: 'MasterBox 對話',
                    detail: '正在處理新訊息',
                  ),
                  'Live Activity 已啟動',
                ),
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
                  enabled: _liveActivitySupported,
                  onTap: () => _runLiveActivity(
                    () => DynamicIslandService.update(
                      title: state.title,
                      detail: state.detail,
                      progress: 0,
                      stage: state.stage,
                    ),
                    '已切換至：${state.title}',
                  ),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.stop_circle_outlined),
                title: const Text('結束示範'),
                enabled: _liveActivitySupported,
                onTap: () => _runLiveActivity(
                  DynamicIslandService.end,
                  'Live Activity 已結束',
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const SectionTitle(title: '帳戶與連線'),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.person_outline),
                title: const Text('帳戶'),
                subtitle: Text(_accountSummary),
              ),
              ListTile(
                leading: const Icon(Icons.cloud_outlined),
                title: const Text('API 連線'),
                subtitle: Text(switch (apiReachable) {
                  null => '檢查中…',
                  true => '已連線',
                  false => '尚未連接',
                }),
              ),
              const ListTile(
                leading: Icon(Icons.info_outline),
                title: Text('關於 MasterBox'),
                trailing: Text('v1.0.0'),
              ),
              ListTile(
                leading: const Icon(Icons.logout),
                title: const Text('登出'),
                onTap: _confirmLogout,
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
  final _scroll = ScrollController();
  StreamSubscription<ChatMessage>? _messageEvents;
  int _shownMessages = 0;
  int _localCounter = 0;
  final _markedViewed = <String>{};

  @override
  void initState() {
    super.initState();
    _encryptionMode = widget.conversation.encryptionMode;
    _disappearingSeconds = widget.conversation.disappearingMessageSeconds;
    widget.graphQL.openRoomId = widget.conversation.messageRoomId;
    messages = _fetchMessages();
    _loadDisappearing();

    _pollTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) => _refreshMessages(),
    );
    _messageEvents = widget.graphQL.messageEvents
        .where((message) => message.roomId == widget.conversation.messageRoomId)
        .listen((_) => _refreshMessages());
  }

  Future<void> _refreshMessages() async {
    if (_pollInFlight) return;
    _pollInFlight = true;
    try {
      final latest = await _fetchMessages();
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
    _messageEvents?.cancel();
    if (widget.graphQL.openRoomId == widget.conversation.messageRoomId) {
      widget.graphQL.openRoomId = null;
    }
    _scroll.dispose();
    controller.dispose();
    super.dispose();
  }

  Future<void> _retry(ChatMessage message) async {
    void replace(ChatMessage updated) {
      final index = localMessages.indexWhere((item) => item.id == message.id);
      if (index >= 0) localMessages[index] = updated;
    }

    if (mounted) {
      setState(() => replace(message.copyWith(failed: false, sending: true)));
    }
    try {
      await widget.graphQL.sendMessage(
        conversation: widget.conversation,
        contents: message.text,
        attachment: message.attachment,
        disappearingSeconds: _disappearingSeconds,
      );
      // The server now has it, so the list below shows it from there.
      final latest = await _fetchMessages();
      if (mounted) {
        setState(() {
          localMessages.removeWhere((item) => item.id == message.id);
          messages = Future.value(latest);
        });
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => replace(
            message.copyWith(failed: true, sending: false, sendError: '$error'),
          ),
        );
      }
    }
  }

  void _send() {
    final text = controller.text.trim();
    final file = pendingFile;
    if (text.isEmpty && file == null) return;
    final attachment = file == null
        ? null
        : <String, dynamic>{
            'name': file.name,
            'size': file.size,

            'type': 'file',
          };
    final outgoing = ChatMessage(
      id: 'local-${_localCounter++}',
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

  Future<List<ChatMessage>> _fetchMessages() async {
    final latest = await widget.graphQL.fetchMessages(
      widget.conversation.messageRoomId,
    );
    for (final message in latest.where((item) => item.needsViewedMark)) {
      if (_markedViewed.add(message.id)) {
        unawaited(
          widget.graphQL.markMessageRead(message.id).catchError((Object _) {
            _markedViewed.remove(message.id);
          }),
        );
      }
    }
    return latest;
  }

  String get _disappearingKey =>
      'room_disappearing_${widget.conversation.messageRoomId}';

  // The backend applies this per message, so the choice is kept on the device.
  Future<void> _loadDisappearing() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getInt(_disappearingKey);
    if (saved != null && mounted) {
      setState(() => _disappearingSeconds = saved);
    }
  }

  /// Keeps the newest message in view, as the admin inbox does.
  void _scrollToEndIfNew(int count) {
    if (count == _shownMessages) return;
    _shownMessages = count;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
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

  void _showCustomerInfo() {
    final room = widget.conversation;
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
                leading: const Icon(Icons.schedule, color: primaryColor),
                title: const Text('最後互動時間'),
                subtitle: Text(formatDateTime(room.updatedAt)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _attachmentView(MessageAttachment attachment) {
    final url = attachment.safeUrl;
    final fallback = Text(
      '[${attachment.label}'
      '${attachment.filename == null ? '' : '：${attachment.filename}'}]'
      '${attachment.caption == null ? '' : ' ${attachment.caption}'}',
    );
    if (url == null) return fallback;
    if (attachment.isImage) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: Image.network(
          url,
          width: 220,
          fit: BoxFit.cover,
          webHtmlElementStrategy: WebHtmlElementStrategy.fallback,
          // Meta's attachment links expire.
          errorBuilder: (_, _, _) => fallback,
        ),
      );
    }
    return TextButton(
      onPressed: () => _openAttachment(url),
      child: Text('查看${attachment.label}'),
    );
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

  /// Customers on a social platform have no way to join, so say so first.
  Future<bool> _confirmInternalCall() async {
    final platform = widget.conversation.platform;
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
        conversationId: widget.conversation.id,
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
                    helperText: widget.conversation.platform == null
                        ? '訊息顯示後開始倒數，時間到就不再顯示。'
                        : '只套用於留在 MasterBox 的附件紀錄，顯示後開始倒數。'
                              '傳給客戶的訊息會留在 '
                              '${platformLabel(widget.conversation.platform)}，無法消失。',
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
                  onChanged: (value) =>
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

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.conversation.title),
      actions: [
        if (widget.conversation.platform != null)
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
                  '消失訊息：${disappearingLabel(_disappearingSeconds)}',
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
                return ErrorRetry(
                  message: '${snapshot.error}',
                  onRetry: () {
                    setState(() {
                      messages = widget.graphQL.fetchMessages(
                        widget.conversation.messageRoomId,
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
                return const EmptyState(
                  icon: Icons.forum_outlined,
                  message: '尚無訊息',
                );
              }
              _scrollToEndIfNew(items.length);
              return ListView.builder(
                controller: _scroll,
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
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.sizeOf(context).width * 0.8,
                        ),
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
                                if (message.text.isNotEmpty ||
                                    message.attachments.isEmpty)
                                  Text(
                                    message.text.isEmpty ? '附件' : message.text,
                                  ),
                                for (final attachment in message.attachments)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: _attachmentView(attachment),
                                  ),
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
                                if (message.deliveryError != null)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(
                                      '未送達：${message.deliveryError}',
                                      style: const TextStyle(
                                        color: Colors.red,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                if (message.failed && message.sendError != null)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(
                                      '訊息未送出：${message.sendError}',
                                      style: const TextStyle(
                                        color: Colors.red,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                if (!message.sending && !message.failed)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(
                                      formatTime(message.sentAt),
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall,
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
                      subtitle: Text(
                        '${pendingFile!.size} bytes\n'
                        '目前只會記錄檔名：檔案不會上傳，也不會傳給客戶',
                      ),
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
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _send(),
                        decoration: const InputDecoration(hint: Text('輸入訊息…')),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      key: const ValueKey('send-message'),
                      onPressed: _send,
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
