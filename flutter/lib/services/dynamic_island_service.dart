import 'package:flutter/services.dart';

class DynamicIslandService {
  static const _channel = MethodChannel('masterbox/dynamic_island');

  static Future<void> start({
    required String conversationId,
    required String title,
    required String detail,
  }) async {
    await _channel.invokeMethod('start', {
      'conversationId': conversationId,
      'title': title,
      'detail': detail,
      'progress': 0,
      'stage': 1,
    });
  }

  static Future<void> update({
    required String title,
    required String detail,
    int progress = 0,
    int stage = 1,
  }) async {
    await _channel.invokeMethod('update', {
      'title': title,
      'detail': detail,
      'progress': progress,
      'stage': stage,
    });
  }

  static Future<void> end() async {
    await _channel.invokeMethod('end');
  }
}
