import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'graphql_service.dart';

/// Where push stands on this phone, in words the settings page shows.
enum PushState {
  /// Being worked out.
  checking,

  /// Notifications arrive when a customer writes.
  on,

  /// The switch in settings is off.
  off,

  /// Only the iPhone app has push so far.
  unsupportedPlatform,

  /// The server has no APNs key.
  serverNotConfigured,

  /// The phone's settings don't allow MasterBox notifications.
  denied,

  /// Registering failed, such as without a connection.
  failed,
}

String pushStateLabel(PushState state) => switch (state) {
  PushState.checking => '檢查中…',
  PushState.on => '客戶傳訊息時，手機會收到推播通知',
  PushState.off => '已關閉：只有 App 開啟時才會提示新訊息',
  PushState.unsupportedPlatform => '目前只有 iPhone App 支援推播，這裡在 App 開啟時會提示新訊息',
  PushState.serverNotConfigured => '伺服器尚未設定推播，App 開啟時仍會提示新訊息',
  PushState.denied => '手機不允許 MasterBox 通知，請到系統設定開啟通知',
  PushState.failed => '推播註冊失敗，下次開啟 App 時會再試一次',
};

/// A notification that arrived while the app was open. Phones don't show these
/// themselves then, so the app does.
class ForegroundPush {
  const ForegroundPush({
    this.messageId,
    this.roomId,
    this.chatRoomId,
    this.title,
    this.body,
  });
  final String? messageId;

  /// The conversation's id, for opening it.
  final String? roomId;

  /// The room id its messages carry, for telling whether it is on screen.
  final String? chatRoomId;
  final String? title;
  final String? body;

  factory ForegroundPush.fromData(
    Map<String, dynamic> data, {
    String? title,
    String? body,
  }) {
    String? text(String key) {
      final value = data[key];
      return value is String && value.isNotEmpty ? value : null;
    }

    return ForegroundPush(
      messageId: text('messageId'),
      roomId: text('roomId'),
      chatRoomId: text('chatRoomId'),
      title: title,
      body: body,
    );
  }
}

/// What the app needs from the phone's push service; tests pass their own.
abstract class PushClient {
  /// False on platforms without push.
  bool get available;
  Future<void> initialize();

  /// Asks for permission the first time; afterwards answers with the setting.
  Future<bool> requestPermission();

  /// This phone's device token.
  Future<String?> getToken();
  Stream<String> get onTokenRefresh;

  /// The data of notifications tapped while the app was running.
  Stream<Map<String, dynamic>> get onOpened;

  /// Notifications that arrive while the app is open.
  Stream<ForegroundPush> get onForeground;

  /// The data of the notification that launched the app, if one did.
  Future<Map<String, dynamic>?> launchedFrom();

  /// Stops this phone receiving anything, even if the server couldn't be told.
  Future<void> stop();
}

/// Apple's push service, through AppDelegate.swift. Android has no push yet, so
/// nothing here runs there and it never asks for notification permission.
class ApnsPushClient implements PushClient {
  static const _channel = MethodChannel('masterbox/push');
  static const _tokenTimeout = Duration(seconds: 15);

  final _tokens = StreamController<String>.broadcast();
  final _opened = StreamController<Map<String, dynamic>>.broadcast();
  final _foreground = StreamController<ForegroundPush>.broadcast();

  @override
  bool get available => !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;

  @override
  Future<void> initialize() async => _channel.setMethodCallHandler(_handle);

  Future<void> _handle(MethodCall call) async {
    final arguments = call.arguments;
    switch (call.method) {
      case 'token' when arguments is String:
        _tokens.add(arguments);
      case 'opened' when arguments is Map:
        _opened.add(_dataOf(arguments));
      case 'foreground' when arguments is Map:
        _foreground.add(
          ForegroundPush.fromData(
            _dataOf(arguments),
            title: arguments['title'] as String?,
            body: arguments['body'] as String?,
          ),
        );
    }
  }

  static Map<String, dynamic> _dataOf(Map<Object?, Object?> notification) {
    final data = notification['data'];
    return data is Map ? data.cast<String, dynamic>() : const {};
  }

  @override
  Future<bool> requestPermission() async =>
      await _channel.invokeMethod<bool>('requestPermission') ?? false;

  @override
  Future<String?> getToken() =>
      _channel.invokeMethod<String>('getToken').timeout(_tokenTimeout);

  @override
  Stream<String> get onTokenRefresh => _tokens.stream;

  @override
  Stream<Map<String, dynamic>> get onOpened => _opened.stream;

  @override
  Stream<ForegroundPush> get onForeground => _foreground.stream;

  @override
  Future<Map<String, dynamic>?> launchedFrom() async {
    final notification = await _channel.invokeMethod<Map<Object?, Object?>>(
      'takeLaunchNotification',
    );
    return notification == null ? null : _dataOf(notification);
  }

  @override
  Future<void> stop() => _channel.invokeMethod<void>('stop');
}

/// Registers this phone for the signed-in account's notifications and opens
/// the conversation a tapped notification is about.
class PushService {
  PushService({required this.graphQL, PushClient? client})
    : _client = client ?? ApnsPushClient();

  static const _platform = 'ios';
  static const _serverWait = Duration(seconds: 3);

  final GraphQLService graphQL;
  final PushClient _client;
  final _state = ValueNotifier<PushState>(PushState.checking);
  final _openRoom = StreamController<String>.broadcast();
  StreamSubscription<String>? _tokenRefresh;
  StreamSubscription<Map<String, dynamic>>? _opened;
  StreamSubscription<ForegroundPush>? _foreground;
  final _foregroundMessages = StreamController<ForegroundPush>.broadcast();
  String? _registeredToken;

  ValueListenable<PushState> get state => _state;

  /// Ids of conversations whose notification was tapped.
  Stream<String> get openRoomRequests => _openRoom.stream;

  /// Notifications that arrived while the app was open.
  Stream<ForegroundPush> get foregroundMessages => _foregroundMessages.stream;

  /// Starts with the settings switch's value: registers when it is on, and
  /// opens the conversation of the notification that launched the app.
  Future<void> start({required bool enabled}) async {
    if (!_client.available) {
      _state.value = PushState.unsupportedPlatform;
      return;
    }
    try {
      await _client.initialize();
      _opened ??= _client.onOpened.listen(_handleOpened);
      _foreground ??= _client.onForeground.listen(_foregroundMessages.add);
      final launched = await _client.launchedFrom();
      if (launched != null) _handleOpened(launched);
    } catch (_) {
      _state.value = PushState.failed;
      return;
    }
    await setEnabled(enabled);
  }

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
      await _stopHere();
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
      await graphQL.registerPushDevice(token, _platform);
      _registeredToken = token;
      _tokenRefresh ??= _client.onTokenRefresh.listen((fresh) async {
        if (_state.value != PushState.on) return;
        try {
          await graphQL.registerPushDevice(fresh, _platform);
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

  /// Tells the server, without waiting long on a slow connection, and stops
  /// the phone receiving anything in case the server didn't hear.
  Future<void> _stopHere() async {
    try {
      final token =
          _registeredToken ?? await _client.getToken().timeout(_serverWait);
      _registeredToken = null;
      if (token != null) {
        await graphQL.unregisterPushDevice(token).timeout(_serverWait);
      }
    } catch (_) {
      // Stopping below still ends the notifications.
    }
    try {
      await _client.stop();
    } catch (_) {
      // Nothing more can be done.
    }
  }

  /// Signing out: the account's notifications stop on this phone.
  Future<void> signOut() async {
    // Not awaited: nothing depends on it, and it can finish after sign-out.
    unawaited(_tokenRefresh?.cancel());
    _tokenRefresh = null;
    if (!_client.available) return;
    await _stopHere();
    _state.value = PushState.off;
  }

  void dispose() {
    _tokenRefresh?.cancel();
    _opened?.cancel();
    _foreground?.cancel();
    _foregroundMessages.close();
    _openRoom.close();
  }
}
