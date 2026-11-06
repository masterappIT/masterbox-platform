import ActivityKit
import Flutter
import UIKit
import UserNotifications
import os.log

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var demoTimer: Timer?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Has to be set before launching ends, to hear about the tap that launched the app.
    UNUserNotificationCenter.current().delegate = self
    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    return result
    if #available(iOS 16.2, *), ProcessInfo.processInfo.arguments.contains("--live-activity-demo") {
      DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
        Task {
          let attributes = MasterBoxActivityAttributes(conversationId: "demo-conversation")
          let state = MasterBoxActivityAttributes.ContentState(title: "MasterBox 對話", detail: "正在處理新訊息", progress: 0, stage: 1)
          do {
            _ = try Activity.request(attributes: attributes, content: .init(state: state, staleDate: nil), pushType: nil)
            self?.demoTimer?.invalidate()
            self?.demoTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { _ in
              Task {
                let progress = Int.random(in: 15...95)
                let state = MasterBoxActivityAttributes.ContentState(title: "MasterBox 對話", detail: progress > 70 ? "客服即將完成回覆" : "機器人作動中", progress: progress, stage: min(progress / 25 + 1, 5))
                for activity in Activity<MasterBoxActivityAttributes>.activities { await activity.update(.init(state: state, staleDate: nil)) }
              }
            }
          } catch { os_log("Live Activity demo failed: %{public}@", log: .default, type: .error, error.localizedDescription) }
        }
      }
    }
    return result
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    AppDelegate.registerDynamicIslandChannel(using: engineBridge.applicationRegistrar.messenger())
    PushBridge.shared.attach(using: engineBridge.applicationRegistrar.messenger())
  }

  override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
    PushBridge.shared.registered(deviceToken: deviceToken)
  }

  override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
    PushBridge.shared.registrationFailed(error)
  }

  // The phone shows nothing while the app is open; the app shows its own notice instead.
  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    PushBridge.shared.arrivedWhileOpen(notification)
    completionHandler([])
  }

  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    if response.actionIdentifier == UNNotificationDefaultActionIdentifier {
      PushBridge.shared.tapped(response.notification)
    }
    completionHandler()
  }

  static func registerDynamicIslandChannel(using messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: "masterbox/dynamic_island", binaryMessenger: messenger)
    channel.setMethodCallHandler { call, reply in
      guard #available(iOS 16.2, *) else {
        reply(FlutterError(code: "UNAVAILABLE", message: "Live Activities require iOS 16.2 or later", details: nil))
        return
      }
      Task {
        do {
          switch call.method {
          case "start":
            let args = call.arguments as? [String: Any] ?? [:]
            for activity in Activity<MasterBoxActivityAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
            let attributes = MasterBoxActivityAttributes(conversationId: args["conversationId"] as? String ?? "unknown")
            let state = MasterBoxActivityAttributes.ContentState(title: args["title"] as? String ?? "MasterBox", detail: args["detail"] as? String ?? "", progress: args["progress"] as? Int ?? 0, stage: args["stage"] as? Int ?? 1)
            _ = try Activity.request(attributes: attributes, content: .init(state: state, staleDate: nil), pushType: nil)
            reply(nil)
          case "update":
            let args = call.arguments as? [String: Any] ?? [:]
            let state = MasterBoxActivityAttributes.ContentState(title: args["title"] as? String ?? "MasterBox", detail: args["detail"] as? String ?? "", progress: args["progress"] as? Int ?? 0, stage: args["stage"] as? Int ?? 1)
            for activity in Activity<MasterBoxActivityAttributes>.activities { await activity.update(.init(state: state, staleDate: nil)) }
            reply(nil)
          case "end":
            for activity in Activity<MasterBoxActivityAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
            reply(nil)
          default: reply(FlutterMethodNotImplemented)
          }
        } catch { reply(FlutterError(code: "LIVE_ACTIVITY_ERROR", message: error.localizedDescription, details: nil)) }
      }
    }
  }
}

/// The native side of push_service.dart: asks for permission, gets the APNs device
/// token, and passes on notifications that arrive while open or are tapped.
final class PushBridge {
  static let shared = PushBridge()
  private var channel: FlutterMethodChannel?
  private var tokenReplies: [FlutterResult] = []
  private var lastToken: String?
  // A tap can come before Dart is ready, as when it launched the app.
  private var dartListening = false
  private var waitingTap: [String: Any]?

  func attach(using messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: "masterbox/push", binaryMessenger: messenger)
    channel.setMethodCallHandler { [weak self] call, reply in self?.handle(call, reply) }
    self.channel = channel
  }

  private func handle(_ call: FlutterMethodCall, _ reply: @escaping FlutterResult) {
    switch call.method {
    case "requestPermission":
      UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
        DispatchQueue.main.async { reply(granted) }
      }
    case "getToken":
      tokenReplies.append(reply)
      UIApplication.shared.registerForRemoteNotifications()
    case "takeLaunchNotification":
      dartListening = true
      reply(waitingTap)
      waitingTap = nil
    case "setBadge":
      let count = max(call.arguments as? Int ?? 0, 0)
      if #available(iOS 16.0, *) {
        UNUserNotificationCenter.current().setBadgeCount(count) { _ in DispatchQueue.main.async { reply(nil) } }
      } else {
        UIApplication.shared.applicationIconBadgeNumber = count
        reply(nil)
      }
    case "stop":
      UIApplication.shared.unregisterForRemoteNotifications()
      lastToken = nil
      reply(nil)
    default:
      reply(FlutterMethodNotImplemented)
    }
  }

  func registered(deviceToken: Data) {
    let token = deviceToken.map { String(format: "%02x", $0) }.joined()
    let replies = tokenReplies
    tokenReplies = []
    replies.forEach { $0(token) }
    // Apple gave a new token without being asked.
    if replies.isEmpty && lastToken != nil && lastToken != token { channel?.invokeMethod("token", arguments: token) }
    lastToken = token
  }

  func registrationFailed(_ error: Error) {
    let replies = tokenReplies
    tokenReplies = []
    replies.forEach { $0(FlutterError(code: "REGISTER_FAILED", message: error.localizedDescription, details: nil)) }
  }

  func arrivedWhileOpen(_ notification: UNNotification) {
    channel?.invokeMethod("foreground", arguments: payload(of: notification))
  }

  func tapped(_ notification: UNNotification) {
    if dartListening {
      channel?.invokeMethod("opened", arguments: payload(of: notification))
    } else {
      waitingTap = payload(of: notification)
    }
  }

  private func payload(of notification: UNNotification) -> [String: Any] {
    let content = notification.request.content
    var data: [String: String] = [:]
    for (key, value) in content.userInfo {
      if let key = key as? String, let value = value as? String { data[key] = value }
    }
    return ["title": content.title, "body": content.body, "data": data]
  }
}
