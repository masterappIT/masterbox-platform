import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'graphql_service.dart';

/// The Firebase project the app registers with, given at build time with
/// --dart-define so no project settings live in the (public) repository:
///
///   FIREBASE_PROJECT_ID, FIREBASE_MESSAGING_SENDER_ID,
///   FIREBASE_IOS_API_KEY, FIREBASE_IOS_APP_ID,
///   FIREBASE_ANDROID_API_KEY, FIREBASE_ANDROID_APP_ID
///
/// A build without them works as before, only without push.
class FirebaseSettings {
  const FirebaseSettings({
    this.projectId = const String.fromEnvironment('FIREBASE_PROJECT_ID'),
    this.senderId = const String.fromEnvironment(
      'FIREBASE_MESSAGING_SENDER_ID',
    ),
    this.iosApiKey = const String.fromEnvironment('FIREBASE_IOS_API_KEY'),
    this.iosAppId = const String.fromEnvironment('FIREBASE_IOS_APP_ID'),
    this.androidApiKey = const String.fromEnvironment(
      'FIREBASE_ANDROID_API_KEY',
    ),
    this.androidAppId = const String.fromEnvironment('FIREBASE_ANDROID_APP_ID'),
  });
  final String projectId;
  final String senderId;
  final String iosApiKey;
  final String iosAppId;
  final String androidApiKey;
  final String androidAppId;

  static const iosBundleId = 'com.masterbox.masterappinc';

  /// The options for this device's platform, or null when this build has none.
  FirebaseOptions? optionsFor(TargetPlatform platform) {
    if (projectId.isEmpty || senderId.isEmpty) return null;
    return switch (platform) {
      TargetPlatform.iOS when iosApiKey.isNotEmpty && iosAppId.isNotEmpty =>
        FirebaseOptions(
          apiKey: iosApiKey,
          appId: iosAppId,
          messagingSenderId: senderId,
          projectId: projectId,
          iosBundleId: iosBundleId,
        ),
      TargetPlatform.android
          when androidApiKey.isNotEmpty && androidAppId.isNotEmpty =>
        FirebaseOptions(
          apiKey: androidApiKey,
          appId: androidAppId,
          messagingSenderId: senderId,
          projectId: projectId,
        ),
      _ => null,
    };
  }
}

/// Where push stands on this phone, in words the settings page shows.
enum PushState {
  /// Being worked out.
  checking,

  /// Notifications arrive when a customer writes.
  on,

  /// The switch in settings is off.
  off,

  /// The web and desktop versions have no push; they prompt while open.
  unsupportedPlatform,

  /// This build of the app has no Firebase settings.
  notConfigured,

  /// The server has no Firebase service account.
  serverNotConfigured,

  /// The phone's settings don't allow MasterBox notifications.
  denied,

  /// Registering failed, such as without a connection; tried again later.
  failed,
}

String pushStateLabel(PushState state) => switch (state) {
  PushState.checking => '檢查中…',
  PushState.on => '客戶傳訊息時，手機會收到推播通知',
  PushState.off => '已關閉：只有 App 開啟時才會提示新訊息',
  PushState.unsupportedPlatform =>
    '網頁版和電腦版沒有推播，App 開啟時會提示新訊息；手機推播請使用 iOS 或 Android App',
  PushState.notConfigured => '這個版本的 App 尚未設定推播，App 開啟時仍會提示新訊息',
  PushState.serverNotConfigured => '伺服器尚未設定推播，App 開啟時仍會提示新訊息',
  PushState.denied => '手機不允許 MasterBox 通知，請到系統設定開啟通知',
  PushState.failed => '推播註冊失敗，稍後會自動重試',
};

/// What the app needs from the phone's push service; tests pass their own.
abstract class PushClient {
  /// False on platforms or builds without push.
  bool get available;
  Future<void> initialize();

  /// Asks for permission the first time; afterwards answers with the setting.
  Future<bool> requestPermission();
  Future<String?> getToken();
  Stream<String> get onTokenRefresh;

  /// The data of notifications tapped while the app was running.
  Stream<Map<String, dynamic>> get onOpened;

  /// The data of the notification that launched the app, if one did.
  Future<Map<String, dynamic>?> launchedFrom();

  /// Invalidates this phone's token, so nothing sent to it arrives any more.
  Future<void> deleteToken();

  /// ios or android
  String get platformName;
}

/// Uses FCM registration tokens, which the backend sends to with the HTTP v1
/// API's `token` field. firebase_messaging 17 prefers its newer register() and
/// installation ids, but the backend has only been built against tokens, so the
/// token calls stay until it is moved over too.
// ignore_for_file: deprecated_member_use
class FirebasePushClient implements PushClient {
  FirebasePushClient({FirebaseSettings settings = const FirebaseSettings()})
    : _options = kIsWeb ? null : settings.optionsFor(defaultTargetPlatform);

  final FirebaseOptions? _options;
  bool _ready = false;

  @override
  bool get available => _options != null;

  @override
  String get platformName =>
      defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';

  FirebaseMessaging get _messaging => FirebaseMessaging.instance;

  @override
  Future<void> initialize() async {
    if (_ready || _options == null) return;
    if (Firebase.apps.isEmpty) await Firebase.initializeApp(options: _options);
    _ready = true;
  }

  @override
  Future<bool> requestPermission() async {
    final settings = await _messaging.requestPermission();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  @override
  Future<String?> getToken() async {
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      // FCM can only hand out a token once Apple has given the phone one.
      for (var attempt = 0; attempt < 10; attempt++) {
        if (await _messaging.getAPNSToken() != null) break;
        await Future<void>.delayed(const Duration(milliseconds: 500));
      }
    }
    return _messaging.getToken();
  }

  @override
  Stream<String> get onTokenRefresh => _messaging.onTokenRefresh;

  @override
  Stream<Map<String, dynamic>> get onOpened =>
      FirebaseMessaging.onMessageOpenedApp.map((message) => message.data);

  @override
  Future<Map<String, dynamic>?> launchedFrom() async =>
      (await _messaging.getInitialMessage())?.data;

  @override
  Future<void> deleteToken() => _messaging.deleteToken();
}

/// Registers this phone for the signed-in account's notifications and opens
/// the conversation a tapped notification is about.
class PushService {
  PushService({required this.graphQL, PushClient? client})
    : _client = client ?? FirebasePushClient();

  final GraphQLService graphQL;
  final PushClient _client;
  final _state = ValueNotifier<PushState>(PushState.checking);
  final _openRoom = StreamController<String>.broadcast();
  StreamSubscription<String>? _tokenRefresh;
  StreamSubscription<Map<String, dynamic>>? _opened;
  String? _registeredToken;

  ValueListenable<PushState> get state => _state;

  /// Ids of conversations whose notification was tapped.
  Stream<String> get openRoomRequests => _openRoom.stream;

  /// Starts with the settings switch's value: registers when it is on, and
  /// opens the conversation of the notification that launched the app.
  Future<void> start({required bool enabled}) async {
    if (!_client.available) {
      _state.value = kIsWeb || !_isPhone
          ? PushState.unsupportedPlatform
          : PushState.notConfigured;
      return;
    }
    try {
      await _client.initialize();
    } catch (_) {
      _state.value = PushState.notConfigured;
      return;
    }
    _opened ??= _client.onOpened.listen(_handleOpened);
    final launched = await _client.launchedFrom().catchError(
      (Object _) => null,
    );
    if (launched != null) _handleOpened(launched);
    await setEnabled(enabled);
  }

  bool get _isPhone =>
      defaultTargetPlatform == TargetPlatform.iOS ||
      defaultTargetPlatform == TargetPlatform.android;

  String? _pendingRoom;

  void _handleOpened(Map<String, dynamic> data) {
    final roomId = data['roomId'];
    if (roomId is! String || roomId.isEmpty) return;
    // Nothing is listening yet while the app is still starting.
    if (_openRoom.hasListener) {
      _openRoom.add(roomId);
    } else {
      _pendingRoom = roomId;
    }
  }

  /// The conversation of a notification tapped before anyone was listening.
  String? takePendingRoom() {
    final room = _pendingRoom;
    _pendingRoom = null;
    return room;
  }

  /// The settings switch: on registers this phone, off stops its notifications.
  Future<void> setEnabled(bool enabled) async {
    if (!_client.available) return;
    if (!enabled) {
      await _unregister();
      _state.value = PushState.off;
      return;
    }
    _state.value = PushState.checking;
    try {
      if (!await graphQL.pushNotificationsAvailable()) {
        _state.value = PushState.serverNotConfigured;
        return;
      }
      if (!await _client.requestPermission()) {
        _state.value = PushState.denied;
        return;
      }
      final token = await _client.getToken();
      if (token == null || token.isEmpty) {
        _state.value = PushState.failed;
        return;
      }
      await graphQL.registerPushDevice(token, _client.platformName);
      _registeredToken = token;
      _tokenRefresh ??= _client.onTokenRefresh.listen((fresh) async {
        if (_state.value != PushState.on) return;
        try {
          await graphQL.registerPushDevice(fresh, _client.platformName);
          _registeredToken = fresh;
        } catch (_) {
          // Registered again on the next start.
        }
      });
      _state.value = PushState.on;
    } catch (_) {
      _state.value = PushState.failed;
    }
  }

  Future<void> _unregister({Duration? timeout}) async {
    final token = _registeredToken ?? await _safeToken();
    _registeredToken = null;
    if (token == null) return;
    try {
      final request = graphQL.unregisterPushDevice(token);
      await (timeout == null ? request : request.timeout(timeout));
    } catch (_) {
      // Signing out also invalidates the token, which the server then forgets.
    }
  }

  Future<String?> _safeToken() async {
    try {
      return await _client.getToken();
    } catch (_) {
      return null;
    }
  }

  /// Signing out: the account's notifications stop on this phone, even when
  /// the server can't be reached, because the token itself is invalidated.
  Future<void> signOut() async {
    // Not awaited: nothing depends on it, and it can finish after sign-out.
    unawaited(_tokenRefresh?.cancel());
    _tokenRefresh = null;
    if (!_client.available) return;
    // Signing out doesn't wait long on a slow connection.
    await _unregister(timeout: const Duration(seconds: 3));
    try {
      await _client.deleteToken();
    } catch (_) {
      // Nothing more can be done offline.
    }
    _state.value = PushState.off;
  }

  void dispose() {
    _tokenRefresh?.cancel();
    _opened?.cancel();
    _openRoom.close();
  }
}
