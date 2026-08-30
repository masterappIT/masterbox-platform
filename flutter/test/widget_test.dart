import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:masterbox_flutter/main.dart';

void main() {
  testWidgets('login can enter development mode', (tester) async {
    await tester.pumpWidget(const MasterBoxApp());
    expect(find.text('開發免登入'), findsOneWidget);
    await tester.tap(find.text('以開發模式進入'));
    await tester.pumpAndSettle();
    expect(find.text('尚未指派社群'), findsOneWidget);
    expect(find.text('Client'), findsNWidgets(2));
  });

  testWidgets('bottom navigation and conversation are usable', (tester) async {
    await tester.pumpWidget(const MasterBoxApp());
    await tester.tap(find.text('以開發模式進入'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chat'));
    await tester.pumpAndSettle();
    expect(find.text('示範聊天室'), findsOneWidget);
    await tester.tap(find.text('示範聊天室'));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsOneWidget);
    await tester.enterText(find.byType(TextField), '測試訊息');
    await tester.tap(find.byKey(const ValueKey('send-message')));
    await tester.pump();
    expect(find.text('測試訊息'), findsOneWidget);
  });
}
