import ActivityKit
import SwiftUI
import WidgetKit

struct MasterBoxActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var detail: String
    var progress: Int
    var stage: Int
  }

  var conversationId: String
}

struct PulsingRobot: View {
  @State private var isPulsing = false
  let size: CGFloat

  var body: some View {
    Image("robot-icon", bundle: nil)
      .resizable()
      .scaledToFit()
      .frame(width: size, height: size)
      .scaleEffect(isPulsing ? 1.08 : 0.94)
      .opacity(isPulsing ? 1 : 0.86)
      .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: isPulsing)
      .onAppear { isPulsing = true }
  }
}

struct NotificationIcon: View {
  let stage: Int
  let size: CGFloat

  var body: some View {
    Group {
      switch stage {
      case 1:
        PulsingRobot(size: size)
      case 2:
        Image(systemName: "message.fill")
          .foregroundStyle(.white)
      case 3:
        Image(systemName: "person.badge.plus")
          .foregroundStyle(.white)
      case 4:
        Image(systemName: "checkmark.circle.fill")
          .foregroundStyle(.white)
      default:
        Image(systemName: "exclamationmark.triangle.fill")
          .foregroundStyle(.red)
      }
    }
    .font(.system(size: size * 0.82, weight: .semibold))
    .frame(width: size, height: size)
    .contentShape(Rectangle())
  }
}

struct MasterBoxLiveActivity: Widget {
  private let brandOrange = Color(red: 1, green: 0.67, blue: 0.22)

  var body: some WidgetConfiguration {
    ActivityConfiguration(for: MasterBoxActivityAttributes.self) { context in
      HStack(spacing: 8) {
        PulsingRobot(size: 30)
          .scaleEffect(1.12)
          .clipShape(RoundedRectangle(cornerRadius: 7))
          .animation(.easeInOut(duration: 0.9), value: context.state.progress)
        VStack(alignment: .leading, spacing: 2) {
          Text(context.state.title)
            .font(.subheadline.weight(.semibold))
            .lineLimit(1)
          Text(context.state.detail)
            .font(.caption)
            .foregroundStyle(.white.opacity(0.75))
            .lineLimit(1)
        }
        Spacer(minLength: 0)
        Text("\(context.state.progress)%")
          .font(.caption.weight(.bold))
          .foregroundStyle(brandOrange)
      }
      .padding(.horizontal, 24)
      .padding(.vertical, 11)
      .activityBackgroundTint(.black)
      .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          ZStack {
            NotificationIcon(stage: context.state.stage, size: 36)
          }
          .frame(width: 44, height: 44, alignment: .center)
        }
        DynamicIslandExpandedRegion(.center) {
          VStack(alignment: .leading, spacing: 2) {
            Text(context.state.title)
              .font(.subheadline.weight(.semibold))
              .lineLimit(1)
            Text(context.state.detail)
              .font(.caption)
              .foregroundStyle(.secondary)
              .lineLimit(1)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text("\(context.state.progress)%")
            .font(.caption.weight(.bold))
            .foregroundStyle(brandOrange)
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack(spacing: 8) {
            GeometryReader { proxy in
              ZStack(alignment: .leading) {
                Capsule().fill(brandOrange.opacity(0.25))
                Capsule().fill(brandOrange)
                  .frame(width: proxy.size.width * CGFloat(min(max(context.state.progress, 0), 100)) / 100)
                  .animation(.easeInOut(duration: 0.45), value: context.state.progress)
              }
            }
            .frame(height: 4)
            Text("正在處理")
              .font(.caption2)
              .foregroundStyle(.secondary)
          }
        }
      } compactLeading: {
        NotificationIcon(stage: context.state.stage, size: 28)
          .frame(width: 32, height: 32, alignment: .center)
      } compactTrailing: {
        Text("\(context.state.progress)%")
          .font(.caption2.weight(.bold))
          .foregroundStyle(brandOrange)
      } minimal: {
        NotificationIcon(stage: context.state.stage, size: 36)
          .frame(width: 38, height: 38, alignment: .center)
      }
      .widgetURL(URL(string: "masterbox://conversation/\(context.attributes.conversationId)"))
      .keylineTint(brandOrange)
    }
  }
}

@main
struct MasterBoxLiveActivityBundle: WidgetBundle {
  var body: some Widget {
    MasterBoxLiveActivity()
  }
}
