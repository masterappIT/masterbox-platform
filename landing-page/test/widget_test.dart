import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masterbox_landing/main.dart';

void main() {
  testWidgets('renders the desktop Figma canvas', (tester) async {
    tester.view
      ..physicalSize = const Size(1920, 1080)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MasterBoxLandingApp());

    expect(find.byKey(const ValueKey('desktop-2x-canvas-top')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('desktop-2x-canvas-bottom')),
      findsOneWidget,
    );
  });

  testWidgets('renders the feature introduction route', (tester) async {
    tester.view
      ..physicalSize = const Size(1920, 1080)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MasterBoxLandingApp());
    final navigator = tester.state<NavigatorState>(find.byType(Navigator));
    navigator.pushNamed('/features');
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('features-1920-image')), findsOneWidget);
    expect(find.byKey(const ValueKey('desktop-2x-canvas-top')), findsNothing);
  });

  testWidgets('preserves feature canvas geometry at every Figma breakpoint', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final cases =
        <({double width, String id, double height, List<double> segments})>[
          (width: 375, id: '375', height: 3899, segments: [2000, 1899]),
          (
            width: 479,
            id: '375',
            height: 3899 * 479 / 375,
            segments: [2000, 1899],
          ),
          (width: 480, id: '480', height: 3923, segments: [2000, 1923]),
          (
            width: 639,
            id: '480',
            height: 3923 * 639 / 480,
            segments: [2000, 1923],
          ),
          (width: 640, id: '640', height: 4718, segments: [2000, 2000, 718]),
          (width: 1920, id: '1920', height: 5552, segments: [2000, 2000, 1552]),
        ];

    for (final testCase in cases) {
      tester.view.physicalSize = Size(testCase.width, 900);
      await tester.pumpWidget(const MasterBoxLandingApp());
      final navigator = tester.state<NavigatorState>(find.byType(Navigator));
      navigator.pushNamed('/features');
      await tester.pumpAndSettle();

      expect(
        tester
            .getSize(find.byKey(ValueKey('features-${testCase.id}-canvas')))
            .width,
        closeTo(testCase.width, 0.01),
      );
      expect(
        tester
            .getSize(find.byKey(ValueKey('features-${testCase.id}-canvas')))
            .height,
        closeTo(testCase.height, 0.01),
      );
      final designWidth = switch (testCase.id) {
        '375' => 375,
        '480' => 480,
        '640' => 640,
        _ => 1920,
      };
      final scale = testCase.width / designWidth;
      for (var index = 0; index < testCase.segments.length; index++) {
        expect(
          tester
              .getSize(
                find.byKey(ValueKey('features-${testCase.id}-segment-$index')),
              )
              .height,
          closeTo(testCase.segments[index] * scale, 0.01),
        );
      }
    }
  });

  testWidgets('feature page keeps pricing overlay absent', (tester) async {
    tester.view
      ..physicalSize = const Size(375, 900)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MasterBoxLandingApp());
    final navigator = tester.state<NavigatorState>(find.byType(Navigator));
    navigator.pushNamed('/features');
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('features-pricing-horizontal-scroll')),
      findsNothing,
    );
    expect(find.byType(Image), findsNWidgets(2));
  });

  testWidgets('feature page uses the same mobile sidebar geometry', (
    tester,
  ) async {
    tester.view
      ..physicalSize = const Size(375, 900)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MasterBoxLandingApp());
    final navigator = tester.state<NavigatorState>(find.byType(Navigator));
    navigator.pushNamed('/features');
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('features-mobile-menu-target')));
    await tester.pump();

    expect(
      tester.getSize(find.byKey(const ValueKey('features-mobile-sidebar'))),
      const Size(328, 854),
    );
  });

  testWidgets('uses mobile layout through the 640px breakpoint', (
    tester,
  ) async {
    tester.view
      ..physicalSize = const Size(640, 900)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MasterBoxLandingApp());

    expect(find.byKey(const ValueKey('mobile-page')), findsOneWidget);
    expect(find.byKey(const ValueKey('desktop-scaled-canvas')), findsNothing);
  });

  testWidgets('keeps mobile header targets separate and bounded', (
    tester,
  ) async {
    tester.view
      ..physicalSize = const Size(375, 900)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MasterBoxLandingApp());

    final logoTarget = tester.getSize(
      find.byKey(const ValueKey('mobile-logo-target')),
    );
    final menuTarget = tester.getSize(
      find.byKey(const ValueKey('mobile-menu-target')),
    );
    expect(logoTarget, const Size(180, 56));
    expect(menuTarget, const Size(56, 56));
  });
  testWidgets('preserves the sidebar design geometry at 640px', (tester) async {
    tester.view
      ..physicalSize = const Size(640, 900)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MasterBoxLandingApp());
    await tester.tap(find.byKey(const ValueKey('mobile-menu-target')));
    await tester.pump();

    final sidebar = tester.getSize(
      find.byKey(const ValueKey('mobile-sidebar')),
    );
    expect(sidebar.width, closeTo(328 * 640 / 375, 0.01));
    expect(sidebar.height, closeTo(854 * 640 / 375, 0.01));
  });
  testWidgets('selects native mobile canvases and preserves segment geometry', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final cases =
        <({double width, String id, double height, List<double> segments})>[
          (width: 375, id: '375', height: 5127, segments: [2000, 2000, 1127]),
          (
            width: 479,
            id: '375',
            height: 5127 * 479 / 375,
            segments: [2000, 2000, 1127],
          ),
          (width: 480, id: '480', height: 5646, segments: [2000, 2000, 1646]),
          (
            width: 639,
            id: '480',
            height: 5646 * 639 / 480,
            segments: [2000, 2000, 1646],
          ),
          (
            width: 640,
            id: '640',
            height: 6741,
            segments: [2000, 2000, 2000, 741],
          ),
        ];

    for (final testCase in cases) {
      tester.view.physicalSize = Size(testCase.width, 900);
      await tester.pumpWidget(const MasterBoxLandingApp());
      await tester.pump();

      final canvas = tester.getSize(
        find.byKey(const ValueKey('mobile-page-canvas')),
      );
      expect(canvas.width, testCase.width);
      expect(canvas.height, closeTo(testCase.height, 0.01));

      final scale =
          testCase.width /
          (testCase.id == '375'
              ? 375
              : testCase.id == '480'
              ? 480
              : 640);
      for (var index = 0; index < testCase.segments.length; index++) {
        expect(
          tester
              .getSize(
                find.byKey(ValueKey('mobile-segment-${testCase.id}-$index')),
              )
              .height,
          closeTo(testCase.segments[index] * scale, 0.01),
        );
      }
    }
  });

  testWidgets('uses desktop scaling above the 640px breakpoint', (
    tester,
  ) async {
    tester.view
      ..physicalSize = const Size(641, 900)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MasterBoxLandingApp());

    expect(find.byKey(const ValueKey('mobile-page')), findsNothing);
    expect(find.byKey(const ValueKey('desktop-scaled-canvas')), findsOneWidget);
  });

  testWidgets('preserves desktop canvas image geometry', (tester) async {
    tester.view
      ..physicalSize = const Size(1920, 1080)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MasterBoxLandingApp());

    expect(
      tester.getSize(find.byKey(const ValueKey('desktop-2x-canvas-top'))),
      const Size(1920, 4000),
    );
    expect(
      tester.getSize(find.byKey(const ValueKey('desktop-2x-canvas-bottom'))),
      const Size(1920, 3909),
    );
  });

  testWidgets('scales the desktop canvas across representative widths', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    for (final width in [768.0, 1024.0, 1280.0, 1440.0, 1920.0]) {
      tester.view.physicalSize = Size(width, 1024);
      await tester.pumpWidget(const MasterBoxLandingApp());
      await tester.pump();

      final scaledCanvas = tester.getSize(
        find.byKey(const ValueKey('desktop-scaled-canvas')),
      );
      final expectedScale = width / 1920;
      expect(scaledCanvas.width, width);
      expect(scaledCanvas.height, closeTo(7909 * expectedScale, 0.01));
    }
  });
}
