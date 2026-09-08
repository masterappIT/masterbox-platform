import 'package:flutter/material.dart';

import 'design_tokens.dart';
import 'contact_page.dart';
import 'feature_introduction_page.dart';
import 'pricing_page.dart';

void main() => runApp(const MasterBoxLandingApp());

class MasterBoxLandingApp extends StatelessWidget {
  const MasterBoxLandingApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'MasterBox',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      fontFamily: DesignTokens.fontFamily,
      scaffoldBackgroundColor: DesignTokens.white,
    ),
    initialRoute: switch (Uri.base.path) {
      '/features' => '/features',
      '/pricing' => '/pricing',
      '/contact' => '/contact',
      _ => '/',
    },
    onGenerateRoute: (settings) {
      if (settings.name == '/features') {
        return MaterialPageRoute<void>(
          builder: (_) => const FeatureIntroductionPage(),
          settings: settings,
        );
      }
      if (settings.name == '/pricing') {
        return MaterialPageRoute<void>(
          builder: (_) => const PricingPage(),
          settings: settings,
        );
      }
      if (settings.name == '/contact') {
        return MaterialPageRoute<void>(
          builder: (_) => const ContactPage(),
          settings: settings,
        );
      }
      return MaterialPageRoute<void>(builder: (_) => const MasterBoxHomePage());
    },
    home: const MasterBoxHomePage(),
  );
}

class _MobileCanvasConfig {
  const _MobileCanvasConfig({
    required this.id,
    required this.designWidth,
    required this.designHeight,
    required this.featuresOffset,
    required this.contactOffset,
    required this.segmentHeights,
  });

  final String id;
  final double designWidth;
  final double designHeight;
  final double featuresOffset;
  final double contactOffset;
  final List<double> segmentHeights;

  List<String> get segmentAssets => [
    for (var index = 0; index < segmentHeights.length; index++)
      'assets/mobile-page-$id-4x-$index.png',
  ];
}

const _mobile375 = _MobileCanvasConfig(
  id: '375',
  designWidth: 375,
  designHeight: 5127,
  featuresOffset: 1373,
  contactOffset: 3500,
  segmentHeights: [2000, 2000, 1127],
);

const _mobile480 = _MobileCanvasConfig(
  id: '480',
  designWidth: 480,
  designHeight: 5646,
  featuresOffset: 1547,
  contactOffset: 4304,
  segmentHeights: [2000, 2000, 1646],
);

const _mobile640 = _MobileCanvasConfig(
  id: '640',
  designWidth: 640,
  designHeight: 6741,
  featuresOffset: 1962,
  contactOffset: 5155,
  segmentHeights: [2000, 2000, 2000, 741],
);

_MobileCanvasConfig _mobileConfigForWidth(double width) {
  if (width >= 640) return _mobile640;
  if (width >= 480) return _mobile480;
  return _mobile375;
}

class MasterBoxHomePage extends StatefulWidget {
  const MasterBoxHomePage({super.key});

  @override
  State<MasterBoxHomePage> createState() => _MasterBoxHomePageState();
}

class _MasterBoxHomePageState extends State<MasterBoxHomePage> {
  final _scrollController = ScrollController();
  bool _mobileSidebarOpen = false;

  void _scrollTo(double offset) {
    if (!_scrollController.hasClients) return;
    final target = offset.clamp(
      0.0,
      _scrollController.position.maxScrollExtent,
    );
    _scrollController.animateTo(
      target,
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeInOut,
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      if (constraints.maxWidth <= 640) {
        final mobileConfig = _mobileConfigForWidth(constraints.maxWidth);
        return _MobileLandingPage(
          config: mobileConfig,
          controller: _scrollController,
          sidebarOpen: _mobileSidebarOpen,
          onMenuTap: () => setState(() => _mobileSidebarOpen = true),
          onCloseTap: () => setState(() => _mobileSidebarOpen = false),
          onHomeTap: () {
            setState(() => _mobileSidebarOpen = false);
            _scrollTo(0);
          },
          onFeaturesTap: () {
            setState(() => _mobileSidebarOpen = false);
            _scrollTo(
              mobileConfig.featuresOffset *
                  constraints.maxWidth /
                  mobileConfig.designWidth,
            );
          },
          onContactTap: () {
            setState(() => _mobileSidebarOpen = false);
            Navigator.of(context).pushReplacementNamed('/contact');
          },
        );
      }
      final scale = (constraints.maxWidth / DesignTokens.canvasWidth).clamp(
        0.0,
        1.0,
      );
      return Scaffold(
        body: SingleChildScrollView(
          controller: _scrollController,
          child: SizedBox(
            key: const ValueKey('desktop-scaled-canvas'),
            width: DesignTokens.canvasWidth * scale,
            height: DesignTokens.canvasHeight * scale,
            child: FittedBox(
              alignment: Alignment.topLeft,
              fit: BoxFit.fill,
              child: SizedBox(
                key: const ValueKey('desktop-source-canvas'),
                width: DesignTokens.canvasWidth,
                height: DesignTokens.canvasHeight,
                child: _FigmaDesktopCanvas(
                  onHomeTap: () => _scrollTo(0),
                  onFeaturesTap: () => _scrollTo(2907 * scale),
                  onContactTap: () =>
                      Navigator.of(context).pushReplacementNamed('/contact'),
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
}

class _MobileLandingPage extends StatelessWidget {
  const _MobileLandingPage({
    required this.config,
    required this.controller,
    required this.sidebarOpen,
    required this.onMenuTap,
    required this.onCloseTap,
    required this.onHomeTap,
    required this.onFeaturesTap,
    required this.onContactTap,
  });

  final _MobileCanvasConfig config;
  final ScrollController controller;
  final bool sidebarOpen;
  final VoidCallback onMenuTap;
  final VoidCallback onCloseTap;
  final VoidCallback onHomeTap;
  final VoidCallback onFeaturesTap;
  final VoidCallback onContactTap;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final scale = width / config.designWidth;
    final sidebarScale = width / 375;
    return Scaffold(
      body: Stack(
        children: [
          SingleChildScrollView(
            key: const ValueKey('mobile-page'),
            controller: controller,
            child: SizedBox(
              key: const ValueKey('mobile-page-canvas'),
              width: width,
              height: config.designHeight * scale,
              child: Stack(
                children: [
                  for (
                    var index = 0;
                    index < config.segmentHeights.length;
                    index++
                  )
                    Positioned(
                      key: ValueKey('mobile-segment-${config.id}-$index'),
                      top:
                          config.segmentHeights
                              .take(index)
                              .fold<double>(0, (sum, height) => sum + height) *
                          scale,
                      width: width,
                      height: config.segmentHeights[index] * scale,
                      child: Image.asset(
                        config.segmentAssets[index],
                        width: width,
                        height: config.segmentHeights[index] * scale,
                        fit: BoxFit.fill,
                        filterQuality: FilterQuality.high,
                      ),
                    ),
                ],
              ),
            ),
          ),
          Positioned(
            top: 0,
            left: 0,
            width: 180 * scale,
            height: 56 * scale,
            child: GestureDetector(
              key: const ValueKey('mobile-logo-target'),
              behavior: HitTestBehavior.opaque,
              onTap: onHomeTap,
            ),
          ),
          Positioned(
            top: 0,
            right: 0,
            width: 56 * scale,
            height: 56 * scale,
            child: GestureDetector(
              key: const ValueKey('mobile-menu-target'),
              behavior: HitTestBehavior.opaque,
              onTap: onMenuTap,
            ),
          ),
          if (sidebarOpen)
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onCloseTap,
                child: ColoredBox(
                  color: Colors.black.withValues(alpha: 0.18),
                  child: Align(
                    alignment: Alignment.topLeft,
                    child: SizedBox(
                      width: 328 * sidebarScale,
                      height: double.infinity,
                      child: SingleChildScrollView(
                        child: SizedBox(
                          key: const ValueKey('mobile-sidebar'),
                          width: 328 * sidebarScale,
                          height: 854 * sidebarScale,
                          child: Stack(
                            children: [
                              Image.asset(
                                'assets/mobile-sidebar-figma-4x.png',
                                width: 328 * sidebarScale,
                                height: 854 * sidebarScale,
                                fit: BoxFit.fill,
                                filterQuality: FilterQuality.high,
                              ),
                              _MobileSidebarHitTargets(
                                scale: sidebarScale,
                                onCloseTap: onCloseTap,
                                onHomeTap: onHomeTap,
                                onFeaturesTap: onFeaturesTap,
                                onContactTap: onContactTap,
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
  }
}

class _MobileSidebarHitTargets extends StatelessWidget {
  const _MobileSidebarHitTargets({
    required this.scale,
    required this.onCloseTap,
    required this.onHomeTap,
    required this.onFeaturesTap,
    required this.onContactTap,
  });

  final double scale;
  final VoidCallback onCloseTap;
  final VoidCallback onHomeTap;
  final VoidCallback onFeaturesTap;
  final VoidCallback onContactTap;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      Positioned(
        left: 16 * scale,
        top: 16 * scale,
        width: 24 * scale,
        height: 24 * scale,
        child: GestureDetector(onTap: onCloseTap),
      ),
      Positioned(
        left: 0,
        top: 64 * scale,
        right: 0,
        height: 57 * scale,
        child: GestureDetector(onTap: onHomeTap),
      ),
      Positioned(
        left: 0,
        top: 121 * scale,
        right: 0,
        height: 57 * scale,
        child: GestureDetector(onTap: onFeaturesTap),
      ),
      Positioned(
        left: 0,
        top: 235 * scale,
        right: 0,
        height: 57 * scale,
        child: GestureDetector(onTap: onContactTap),
      ),
    ],
  );
}

class _FigmaDesktopCanvas extends StatelessWidget {
  const _FigmaDesktopCanvas({
    required this.onHomeTap,
    required this.onFeaturesTap,
    required this.onContactTap,
  });

  final VoidCallback onHomeTap;
  final VoidCallback onFeaturesTap;
  final VoidCallback onContactTap;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      const Positioned(
        top: 0,
        left: 0,
        width: DesignTokens.canvasWidth,
        height: 4000,
        child: Image(
          key: ValueKey('desktop-2x-canvas-top'),
          image: AssetImage('assets/desktop-page-figma-2x-top.png'),
          width: DesignTokens.canvasWidth,
          height: 4000,
          fit: BoxFit.fill,
          filterQuality: FilterQuality.high,
        ),
      ),
      const Positioned(
        top: 4000,
        left: 0,
        width: DesignTokens.canvasWidth,
        height: 3909,
        child: Image(
          key: ValueKey('desktop-2x-canvas-bottom'),
          image: AssetImage('assets/desktop-page-figma-2x-bottom.png'),
          width: DesignTokens.canvasWidth,
          height: 3909,
          fit: BoxFit.fill,
          filterQuality: FilterQuality.high,
        ),
      ),
      Positioned(
        top: 0,
        left: 358,
        width: 1204,
        height: 56,
        child: _NavigationHitTargets(
          onHomeTap: onHomeTap,
          onFeaturesTap: onFeaturesTap,
          onContactTap: onContactTap,
        ),
      ),
    ],
  );
}

class _NavigationHitTargets extends StatelessWidget {
  const _NavigationHitTargets({
    required this.onHomeTap,
    required this.onFeaturesTap,
    required this.onContactTap,
  });

  final VoidCallback onHomeTap;
  final VoidCallback onFeaturesTap;
  final VoidCallback onContactTap;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      Positioned(
        left: 20,
        top: 8,
        width: 145,
        height: 40,
        child: _hit(onHomeTap),
      ),
      Positioned(
        left: 520,
        top: 8,
        width: 72,
        height: 40,
        child: _hit(onFeaturesTap),
      ),
      Positioned(
        left: 712,
        top: 8,
        width: 72,
        height: 40,
        child: _hit(onContactTap),
      ),
    ],
  );

  Widget _hit(VoidCallback onTap) => MouseRegion(
    cursor: SystemMouseCursors.click,
    child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap),
  );
}
