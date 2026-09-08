import 'package:flutter/material.dart';

import 'desktop_navigation.dart';

class FeatureIntroductionPage extends StatefulWidget {
  const FeatureIntroductionPage({super.key});

  @override
  State<FeatureIntroductionPage> createState() =>
      _FeatureIntroductionPageState();
}

class _FeatureIntroductionPageState extends State<FeatureIntroductionPage> {
  bool _sidebarOpen = false;

  static const _desktop = _FeatureCanvas(
    id: '1920',
    designWidth: 1920,
    designHeight: 5552,
    segmentHeights: [2000, 2000, 1552],
  );
  static const _mobile640 = _FeatureCanvas(
    id: '640',
    designWidth: 640,
    designHeight: 4718,
    segmentHeights: [2000, 2000, 718],
  );
  static const _mobile480 = _FeatureCanvas(
    id: '480',
    designWidth: 480,
    designHeight: 3923,
    segmentHeights: [2000, 1923],
  );
  static const _mobile375 = _FeatureCanvas(
    id: '375',
    designWidth: 375,
    designHeight: 3899,
    segmentHeights: [2000, 1899],
  );

  _FeatureCanvas _canvasFor(double width) {
    if (width >= 640) return _mobile640;
    if (width >= 480) return _mobile480;
    return _mobile375;
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final width = constraints.maxWidth;
      final isMobile = width <= 640;
      final canvas = isMobile ? _canvasFor(width) : _desktop;
      final scale = isMobile
          ? width / canvas.designWidth
          : (width / canvas.designWidth).clamp(0.0, 1.0);
      final renderedWidth = canvas.designWidth * scale;
      final renderedHeight = canvas.designHeight * scale;
      return Scaffold(
        body: Stack(
          children: [
            SingleChildScrollView(
              key: const ValueKey('features-page'),
              child: SizedBox(
                key: ValueKey('features-${canvas.id}-canvas'),
                width: renderedWidth,
                height: renderedHeight,
                child: Stack(
                  children: [
                    for (
                      var index = 0;
                      index < canvas.segmentHeights.length;
                      index++
                    )
                      Positioned(
                        key: ValueKey('features-${canvas.id}-segment-$index'),
                        top:
                            canvas.segmentHeights
                                .take(index)
                                .fold<double>(
                                  0,
                                  (sum, height) => sum + height,
                                ) *
                            scale,
                        width: renderedWidth,
                        height: canvas.segmentHeights[index] * scale,
                        child: Image.asset(
                          'assets/features-page-${canvas.id}-${isMobile ? '4x' : '2x'}-$index.png',
                          key: index == 0
                              ? ValueKey('features-${canvas.id}-image')
                              : null,
                          width: renderedWidth,
                          height: canvas.segmentHeights[index] * scale,
                          fit: BoxFit.fill,
                          filterQuality: FilterQuality.high,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (!isMobile)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: DesktopTopBar(
                  scale: scale,
                  assetPath: 'assets/topbars/desktop-features.png',
                  sourceHeight: 2000,
                  onHomeTap: () =>
                      Navigator.of(context).pushReplacementNamed('/'),
                  onFeaturesTap: () {},
                  onPricingTap: () =>
                      Navigator.of(context).pushReplacementNamed('/pricing'),
                  onContactTap: () =>
                      Navigator.of(context).pushReplacementNamed('/contact'),
                ),
              ),
            if (isMobile)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: MobileTopBar(
                  scale: scale,
                  assetPath: 'assets/topbars/mobile-features-${canvas.id}.png',
                  sourceWidth: canvas.designWidth,
                  sourceHeight: canvas.segmentHeights.first,
                  homeKey: const ValueKey('features-mobile-logo-target'),
                  menuKey: const ValueKey('features-mobile-menu-target'),
                  onHomeTap: () =>
                      Navigator.of(context).pushReplacementNamed('/'),
                  onMenuTap: () => setState(() => _sidebarOpen = true),
                ),
              ),
            if (_sidebarOpen && isMobile)
              MobileSidebar(
                scale: width / 375,
                sidebarKey: const ValueKey('features-mobile-sidebar'),
                onCloseTap: () => setState(() => _sidebarOpen = false),
                onHomeTap: () {
                  setState(() => _sidebarOpen = false);
                  Navigator.of(context).pushReplacementNamed('/');
                },
                onFeaturesTap: () {
                  setState(() => _sidebarOpen = false);
                  Navigator.of(context).pushReplacementNamed('/features');
                },
                onPricingTap: () {
                  setState(() => _sidebarOpen = false);
                  Navigator.of(context).pushReplacementNamed('/pricing');
                },
                onContactTap: () {
                  setState(() => _sidebarOpen = false);
                  Navigator.of(context).pushReplacementNamed('/contact');
                },
              ),
          ],
        ),
      );
    },
  );
}

class _FeatureCanvas {
  const _FeatureCanvas({
    required this.id,
    required this.designWidth,
    required this.designHeight,
    required this.segmentHeights,
  });

  final String id;
  final double designWidth;
  final double designHeight;
  final List<double> segmentHeights;
}
