import ActivityKit
import Flutter
import UIKit
import os.log

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var demoTimer: Timer?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
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
