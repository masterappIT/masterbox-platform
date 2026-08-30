import ActivityKit
import Foundation

struct MasterBoxActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var detail: String
    var progress: Int
    var stage: Int
  }
  var conversationId: String
}
