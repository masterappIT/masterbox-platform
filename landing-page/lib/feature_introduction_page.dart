import 'package:flutter/material.dart';

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
      final layoutWidth = constraints.maxWidth;
      final width = MediaQuery.sizeOf(context).width;
      final isMobile = layoutWidth <= 640;
      final canvas = isMobile ? _canvasFor(layoutWidth) : _desktop;
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
            if (isMobile) ...[
              Positioned(
                top: 0,
                left: 0,
                width: 180 * scale,
                height: 56 * scale,
                child: GestureDetector(
                  key: const ValueKey('features-mobile-logo-target'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => Navigator.of(context).pushReplacementNamed('/'),
                ),
              ),
              Positioned(
                top: 0,
                right: 0,
                width: 56 * scale,
                height: 56 * scale,
                child: GestureDetector(
                  key: const ValueKey('features-mobile-menu-target'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _sidebarOpen = true),
                ),
              ),
            ],
            if (_sidebarOpen && isMobile)
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _sidebarOpen = false),
                  child: ColoredBox(
                    color: Colors.black.withValues(alpha: 0.18),
                    child: Align(
                      alignment: Alignment.topLeft,
                      child: SizedBox(
                        width: 328 * (width / 375),
                        height: double.infinity,
                        child: SingleChildScrollView(
                          child: SizedBox(
                            key: const ValueKey('features-mobile-sidebar'),
                            width: 328 * (width / 375),
                            height: 854 * (width / 375),
                            child: Stack(
                              children: [
                                Image.asset(
                                  'assets/mobile-sidebar-figma-4x.png',
                                  width: 328 * (width / 375),
                                  height: 854 * (width / 375),
                                  fit: BoxFit.fill,
                                  filterQuality: FilterQuality.high,
                                ),
                                Positioned(
                                  left: 16 * (width / 375),
                                  top: 16 * (width / 375),
                                  width: 24 * (width / 375),
                                  height: 24 * (width / 375),
                                  child: GestureDetector(
                                    onTap: () =>
                                        setState(() => _sidebarOpen = false),
                                  ),
                                ),
                                Positioned(
                                  left: 0,
                                  top: 64 * (width / 375),
                                  right: 0,
                                  height: 57 * (width / 375),
                                  child: GestureDetector(
                                    onTap: () =>
                                        Navigator.of(context)
                                            .pushReplacementNamed('/'),
                                  ),
                                ),
                                Positioned(
                                  left: 0,
                                  top: 121 * (width / 375),
                                  right: 0,
                                  height: 57 * (width / 375),
                                  child: GestureDetector(
                                    onTap: () =>
                                        setState(() => _sidebarOpen = false),
                                  ),
                                ),
                                Positioned(
                                  left: 0,
                                  top: 235 * (width / 375),
                                  right: 0,
                                  height: 57 * (width / 375),
                                  child: GestureDetector(
                                    onTap: () =>
                                        Navigator.of(context)
                                            .pushReplacementNamed('/'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
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
