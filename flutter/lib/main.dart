import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'services/graphql_service.dart';
import 'services/dynamic_island_service.dart';
import 'services/push_service.dart';
import 'models/app_models.dart';
import 'pages/channels_page.dart';
import 'pages/conversation_page.dart';
import 'pages/inbox_page.dart';
import 'pages/manage_page.dart';
import 'pages/users_page.dart';
import 'widgets/common.dart';

const authBlue = primaryColor;

void main() => runApp(const MasterBoxApp());

class MasterBoxApp extends StatefulWidget {
  const MasterBoxApp({this.graphQL, this.pushClient, super.key});

  /// Tests pass a service with a stubbed connection.
  final GraphQLService? graphQL;

  /// Tests pass a stand-in for the phone's push service.
  final PushClient? pushClient;

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
      home: AppRoot(
        onThemeModeChanged: setThemeMode,
        graphQL: widget.graphQL,
        pushClient: widget.pushClient,
      ),
      onUnknownRoute: (settings) => MaterialPageRoute(
        builder: (_) => AppRoot(
          onThemeModeChanged: setThemeMode,
          graphQL: widget.graphQL,
          pushClient: widget.pushClient,
        ),
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
  const AppRoot({
    required this.onThemeModeChanged,
    this.graphQL,
    this.pushClient,
    super.key,
  });
  final ValueChanged<bool> onThemeModeChanged;
  final GraphQLService? graphQL;
  final PushClient? pushClient;
  @override
  State<AppRoot> createState() => _AppRootState();
}

/// The settings switch for push notifications on this phone.
const pushPreferenceKey = 'push_notifications';

class _AppRootState extends State<AppRoot> {
  bool signedIn = false;
  bool restoring = false;
  bool _signingOut = false;
  late final GraphQLService graphQL = (widget.graphQL ?? GraphQLService())
    ..onTokensChanged = _saveSession
    ..onSessionExpired = handleLogout;
  late final PushService push = PushService(
    graphQL: graphQL,
    client: widget.pushClient,
  );

  @override
  void initState() {
    super.initState();
    restoreSession();
  }

  @override
  void dispose() {
    graphQL.stopRealtime();
    push.dispose();
    super.dispose();
  }

  /// Registers this phone for the signed-in account, unless switched off.
  Future<void> _startPush() async {
    final prefs = await SharedPreferences.getInstance();
    await push.start(enabled: prefs.getBool(pushPreferenceKey) ?? true);
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
    if (signedIn) unawaited(_startPush());
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
    unawaited(_startPush());
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
    // An expired session also lands here, and so would the request that
    // removes this phone's token if it fails the same way.
    if (_signingOut) return;
    _signingOut = true;
    try {
      // While still signed in, so the server forgets this phone.
      await push.signOut();
    } finally {
      _signingOut = false;
    }
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
            push: push,
            onThemeModeChanged: widget.onThemeModeChanged,
            onLogout: handleLogout,
          )
        : LoginPage(onRegister: handleRegister, onLogin: handleLogin);
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({required this.onLogin, this.onRegister, super.key});
  final Future<void> Function(String email, String password) onLogin;
  final Future<void> Function(CompanyRegistration input)? onRegister;
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage>
    with SingleTickerProviderStateMixin {
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
    return email.text.isNotEmpty && password.text.isNotEmpty;
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
        await widget.onLogin(email.text.trim(), password.text);
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
                                              : (registering ? '立即註冊' : '登入'),
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
    required this.push,
    required this.onThemeModeChanged,
    required this.onLogout,
    super.key,
  });
  final GraphQLService graphQL;
  final PushService push;
  final ValueChanged<bool> onThemeModeChanged;
  final VoidCallback onLogout;
  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int index = 0;

  StreamSubscription<ChatMessage>? _newMessages;
  StreamSubscription<String>? _tappedNotifications;
  final _announced = <String>{};

  bool get _isAdmin => widget.graphQL.account?.isAdmin == true;

  @override
  void initState() {
    super.initState();
    _newMessages = widget.graphQL.messageEvents.listen(_announce);
    _tappedNotifications = widget.push.openRoomRequests.listen(
      (id) => _openRoom(id: id),
    );
    // The notification that launched the app, tapped before this was showing.
    final launched = widget.push.takePendingRoom();
    if (launched != null) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _openRoom(id: launched),
      );
    }
    widget.graphQL.startRealtime();
  }

  @override
  void dispose() {
    _newMessages?.cancel();
    _tappedNotifications?.cancel();
    super.dispose();
  }

  /// The settings page's in-app notification switch, for new messages while
  /// the app is open; push notifications cover the time it isn't.
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
          onPressed: () => _openRoom(
            chatRoomId: message.roomId,
            channelId: message.channelId,
          ),
        ),
      ),
    );
  }

  /// Opens a conversation by its id (from a notification) or by the room and
  /// channel a message carries. The server only answers for conversations in
  /// this account's channels.
  Future<void> _openRoom({
    String? id,
    String? chatRoomId,
    String? channelId,
  }) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final room = await widget.graphQL.fetchConversation(
        id: id,
        chatRoomId: id == null ? chatRoomId : null,
        channelId: id == null ? channelId : null,
      );
      if (!mounted) return;
      if (room == null) {
        messenger.showSnackBar(
          const SnackBar(content: Text('找不到這個對話，或你已沒有這個頻道的權限')),
        );
        return;
      }
      // Already open: nothing to do.
      if (widget.graphQL.openRoomId == room.messageRoomId) return;
      setState(() => index = 1);
      await _openConversation(room);
    } catch (_) {
      if (mounted) {
        messenger.showSnackBar(const SnackBar(content: Text('目前無法開啟對話，請稍後再試')));
      }
    }
  }

  Future<void> _openConversation(ChatConversation conversation) async {
    // A conversation opened from a notification replaces the one on screen.
    Navigator.of(context).popUntil((route) => route.isFirst);
    await Navigator.of(context).push(
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
        push: widget.push,
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

class SettingsPage extends StatefulWidget {
  const SettingsPage({
    required this.graphQL,
    required this.onThemeModeChanged,
    required this.onLogout,
    this.push,
    super.key,
  });
  final GraphQLService graphQL;
  final PushService? push;
  final ValueChanged<bool> onThemeModeChanged;
  final VoidCallback onLogout;
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool notifications = true;
  bool pushEnabled = true;
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
        pushEnabled = prefs.getBool(pushPreferenceKey) ?? true;
        darkMode = prefs.getBool('dark_mode') ?? false;
      });
    });
  }

  String get _accountSummary {
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

  /// Push can only be switched where the phone, the build and the server
  /// allow it; otherwise the switch says why.
  Widget _pushSwitch(PushService push) => ValueListenableBuilder<PushState>(
    valueListenable: push.state,
    builder: (context, state, _) {
      final available = switch (state) {
        PushState.unsupportedPlatform ||
        PushState.notConfigured ||
        PushState.serverNotConfigured => false,
        _ => true,
      };
      return SwitchListTile(
        title: const Text('手機推播通知'),
        subtitle: Text(pushStateLabel(state)),
        value: available && pushEnabled,
        onChanged: available && state != PushState.checking
            ? (v) {
                setState(() => pushEnabled = v);
                _save(pushPreferenceKey, v);
                push.setEnabled(v);
              }
            : null,
      );
    },
  );

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
                title: const Text('App 內訊息提示'),
                subtitle: const Text('App 開啟時，收到新訊息會跳出提示'),
                value: notifications,
                onChanged: (v) {
                  setState(() => notifications = v);
                  _save('notifications', v);
                },
              ),
              if (widget.push != null) _pushSwitch(widget.push!),
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
