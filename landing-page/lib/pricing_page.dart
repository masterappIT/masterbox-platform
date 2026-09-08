import 'package:flutter/material.dart';

import 'desktop_navigation.dart';

class PricingPage extends StatefulWidget {
  const PricingPage({super.key});

  @override
  State<PricingPage> createState() => _PricingPageState();
}

class _PricingPageState extends State<PricingPage> {
  bool _sidebarOpen = false;
  final _pricingCardsScrollController = ScrollController();
  final _pricingDetailsScrollController = ScrollController();

  @override
  void dispose() {
    _pricingCardsScrollController.dispose();
    _pricingDetailsScrollController.dispose();
    super.dispose();
  }

  static const _desktop = _PricingCanvas(
    id: '1920',
    designWidth: 1920,
    designHeight: 3300,
    segmentHeights: [2000, 1300],
  );
  static const _mobile640 = _PricingCanvas(
    id: '640',
    designWidth: 640,
    designHeight: 2764,
    segmentHeights: [2000, 764],
  );
  static const _mobile480 = _PricingCanvas(
    id: '480',
    designWidth: 480,
    designHeight: 2618,
    segmentHeights: [2000, 618],
  );
  static const _mobile375 = _PricingCanvas(
    id: '375',
    designWidth: 375,
    designHeight: 2484,
    segmentHeights: [2000, 484],
  );

  _PricingCanvas _canvasFor(double width) {
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
              key: const ValueKey('pricing-page'),
              child: SizedBox(
                key: ValueKey('pricing-${canvas.id}-canvas'),
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
                        key: ValueKey('pricing-${canvas.id}-segment-$index'),
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
                          'assets/pricing-page-${canvas.id}-${isMobile ? '4x' : '2x'}-$index.png',
                          width: renderedWidth,
                          height: canvas.segmentHeights[index] * scale,
                          fit: BoxFit.fill,
                          filterQuality: FilterQuality.high,
                        ),
                      ),
                    if (isMobile &&
                        (canvas.id == '375' ||
                            canvas.id == '480' ||
                            canvas.id == '640'))
                      Positioned(
                        left: 0,
                        top:
                            (canvas.id == '375'
                                ? 142
                                : canvas.id == '480'
                                ? 163
                                : 187) *
                            scale,
                        width: width,
                        height:
                            (canvas.id == '375'
                                ? 330
                                : canvas.id == '480'
                                ? 322
                                : 445) *
                            scale,
                        child: const ColoredBox(color: Colors.white),
                      ),
                    if (isMobile &&
                        (canvas.id == '375' ||
                            canvas.id == '480' ||
                            canvas.id == '640'))
                      Positioned(
                        left: 0,
                        top:
                            (canvas.id == '375'
                                ? 142
                                : canvas.id == '480'
                                ? 163
                                : 187) *
                            scale,
                        width: width,
                        height:
                            (canvas.id == '375'
                                ? 330
                                : canvas.id == '480'
                                ? 322
                                : 445) *
                            scale,
                        child: SingleChildScrollView(
                          key: const ValueKey(
                            'pricing-cards-horizontal-scroll',
                          ),
                          controller: _pricingCardsScrollController,
                          scrollDirection: Axis.horizontal,
                          physics: const _NoBallisticScrollPhysics(),
                          child: SizedBox(
                            width:
                                (canvas.designWidth +
                                    2 * (canvas.id == '640' ? 304 : 228)) *
                                scale,
                            height:
                                (canvas.id == '375'
                                    ? 330
                                    : canvas.id == '480'
                                    ? 322
                                    : 445) *
                                scale,
                            child: Stack(
                              children: [
                                for (var index = 0; index < 3; index++)
                                  Positioned(
                                    left:
                                        (canvas.id == '375'
                                            ? 5 + index * 228
                                            : canvas.id == '480'
                                            ? 8 + index * 228
                                            : 12 + index * 304) *
                                        scale,
                                    child: Image.asset(
                                      'assets/pricing-${canvas.id}-card-free-4x.png',
                                      width:
                                          (canvas.id == '375'
                                              ? 232
                                              : canvas.id == '480'
                                              ? 220
                                              : 288) *
                                          scale,
                                      height:
                                          (canvas.id == '375'
                                              ? 330
                                              : canvas.id == '480'
                                              ? 322
                                              : 445) *
                                          scale,
                                      fit: BoxFit.fill,
                                      filterQuality: FilterQuality.high,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    if (isMobile &&
                        (canvas.id == '375' ||
                            canvas.id == '480' ||
                            canvas.id == '640'))
                      Positioned(
                        key: ValueKey('pricing-${canvas.id}-details-column'),
                        left:
                            (canvas.id == '375'
                                ? 184
                                : canvas.id == '480'
                                ? 236
                                : 472) *
                            scale,
                        top:
                            (canvas.id == '375'
                                ? 752
                                : canvas.id == '480'
                                ? 830
                                : 1068) *
                            scale,
                        width:
                            (canvas.id == '375'
                                ? 191
                                : canvas.id == '480'
                                ? 236
                                : 168) *
                            scale,
                        height:
                            (canvas.id == '375'
                                ? 1111
                                : canvas.id == '480'
                                ? 1167
                                : 1167) *
                            scale,
                        child: SingleChildScrollView(
                          key: const ValueKey(
                            'pricing-details-horizontal-scroll',
                          ),
                          controller: _pricingDetailsScrollController,
                          scrollDirection: Axis.horizontal,
                          physics: const _NoBallisticScrollPhysics(),
                          child: SizedBox(
                            width:
                                (canvas.id == '375'
                                    ? 191
                                    : canvas.id == '480'
                                    ? 236
                                    : 168) *
                                3 *
                                scale,
                            height:
                                (canvas.id == '375'
                                    ? 1111
                                    : canvas.id == '480'
                                    ? 1167
                                    : 1167) *
                                scale,
                            child: Row(
                              children: [
                                for (var index = 0; index < 3; index++)
                                  Image.asset(
                                    'assets/pricing-${canvas.id}-details-${canvas.id == '640' ? 'standard' : 'free'}-4x.png',
                                    width:
                                        (canvas.id == '375'
                                            ? 191
                                            : canvas.id == '480'
                                            ? 236
                                            : 168) *
                                        scale,
                                    height:
                                        (canvas.id == '375'
                                            ? 1111
                                            : canvas.id == '480'
                                            ? 1167
                                            : 1167) *
                                        scale,
                                    fit: BoxFit.fill,
                                    filterQuality: FilterQuality.high,
                                  ),
                              ],
                            ),
                          ),
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
                  assetPath: 'assets/topbars/desktop-pricing.png',
                  sourceHeight: 2000,
                  onHomeTap: () =>
                      Navigator.of(context).pushReplacementNamed('/'),
                  onFeaturesTap: () =>
                      Navigator.of(context).pushReplacementNamed('/features'),
                  onPricingTap: () {},
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
                  assetPath: 'assets/topbars/mobile-pricing-${canvas.id}.png',
                  sourceWidth: canvas.designWidth,
                  sourceHeight: canvas.segmentHeights.first,
                  homeKey: const ValueKey('pricing-mobile-logo-target'),
                  menuKey: const ValueKey('pricing-mobile-menu-target'),
                  onHomeTap: () =>
                      Navigator.of(context).pushReplacementNamed('/'),
                  onMenuTap: () => setState(() => _sidebarOpen = true),
                ),
              ),
            if (_sidebarOpen && isMobile)
              MobileSidebar(
                scale: width / 375,
                sidebarKey: const ValueKey('pricing-mobile-sidebar'),
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

class _NoBallisticScrollPhysics extends ClampingScrollPhysics {
  const _NoBallisticScrollPhysics();

  @override
  Simulation? createBallisticSimulation(
    ScrollMetrics position,
    double velocity,
  ) => null;
}

class _PricingCanvas {
  const _PricingCanvas({
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
