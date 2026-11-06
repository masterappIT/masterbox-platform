import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:masterbox_flutter/main.dart';

void main() {
  testWidgets('login needs an email and password', (tester) async {
    await tester.pumpWidget(const MasterBoxApp());
    await tester.pumpAndSettle();
    expect(find.text('開發免登入'), findsNothing);

    FilledButton loginButton() =>
        tester.widget<FilledButton>(find.widgetWithText(FilledButton, '登入'));
    expect(loginButton().onPressed, isNull);

    await tester.enterText(find.widgetWithText(TextField, 'Email'), 'a@b.co');
    await tester.enterText(find.widgetWithText(TextField, '密碼'), 'secret');
    await tester.pump();
    expect(loginButton().onPressed, isNotNull);
  });
}
