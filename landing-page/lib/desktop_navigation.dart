import 'package:flutter/material.dart';

class DesktopNavigationHitTargets extends StatelessWidget {
  const DesktopNavigationHitTargets({
    super.key,
    required this.scale,
    required this.onHomeTap,
    required this.onFeaturesTap,
    required this.onPricingTap,
    required this.onContactTap,
  });

  static const double height = 80;

  final double scale;
  final VoidCallback onHomeTap;
  final VoidCallback onFeaturesTap;
  final VoidCallback onPricingTap;
  final VoidCallback onContactTap;
  @override
  Widget build(BuildContext context) => SizedBox(
    height: height * scale,
    child: Stack(
      children: [
        Positioned(
          left: 20 * scale,
          top: 0,
          width: 145 * scale,
          height: height * scale,
          child: _hit(onHomeTap),
        ),
        Positioned(
          left: 520 * scale,
          top: 0,
          width: 72 * scale,
          height: height * scale,
          child: _hit(onFeaturesTap),
        ),
        Positioned(
          left: 616 * scale,
          top: 0,
          width: 72 * scale,
          height: height * scale,
          child: _hit(onPricingTap),
        ),
        Positioned(
          left: 712 * scale,
          top: 0,
          width: 72 * scale,
          height: height * scale,
          child: _hit(onContactTap),
        ),
        Positioned(
          left: 800 * scale,
          top: 0,
          width: 180 * scale,
          height: height * scale,
          child: _disabledHit(),
        ),
      ],
    ),
  );

  Widget _hit(VoidCallback onTap) => MouseRegion(
    cursor: SystemMouseCursors.click,
    child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap),
  );

  Widget _disabledHit() => MouseRegion(
    cursor: SystemMouseCursors.basic,
    child: GestureDetector(behavior: HitTestBehavior.opaque),
  );
}

class DesktopTopBar extends StatelessWidget {
  const DesktopTopBar({
    super.key,
    required this.scale,
    required this.assetPath,
    required this.sourceHeight,
    required this.onHomeTap,
    required this.onFeaturesTap,
    required this.onPricingTap,
    required this.onContactTap,
  });

  static const double sourceWidth = 1920;
  static const double barHeight = 80;

  final double scale;
  final String assetPath;
  final double sourceHeight;
  final VoidCallback onHomeTap;
  final VoidCallback onFeaturesTap;
  final VoidCallback onPricingTap;
  final VoidCallback onContactTap;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: sourceWidth * scale,
    height: barHeight * scale,
    child: ClipRect(
      child: Stack(
        children: [
          Positioned(
            top: 0,
            left: 0,
            width: sourceWidth * scale,
            height: sourceHeight * scale,
            child: Image.asset(
              assetPath,
              fit: BoxFit.fill,
              filterQuality: FilterQuality.high,
            ),
          ),
          Positioned(
            top: 0,
            left: 358 * scale,
            width: 1204 * scale,
            height: barHeight * scale,
            child: DesktopNavigationHitTargets(
              scale: scale,
              onHomeTap: onHomeTap,
              onFeaturesTap: onFeaturesTap,
              onPricingTap: onPricingTap,
              onContactTap: onContactTap,
            ),
          ),
        ],
      ),
    ),
  );
}

class MobileTopBar extends StatelessWidget {
  const MobileTopBar({
    super.key,
    required this.scale,
    required this.assetPath,
    required this.sourceWidth,
    required this.sourceHeight,
    required this.onHomeTap,
    required this.onMenuTap,
    this.homeKey,
    this.menuKey,
  });

  static const double height = 64;

  final double scale;
  final String assetPath;
  final double sourceWidth;
  final double sourceHeight;
  final VoidCallback onHomeTap;
  final VoidCallback onMenuTap;
  final Key? homeKey;
  final Key? menuKey;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: height * scale,
    child: ClipRect(
      child: Stack(
        children: [
          Positioned(
            top: 0,
            left: 0,
            width: sourceWidth * scale,
            height: sourceHeight * scale,
            child: Image.asset(
              assetPath,
              fit: BoxFit.fill,
              filterQuality: FilterQuality.high,
            ),
          ),
          MobileHeaderHitTargets(
            scale: scale,
            homeKey: homeKey,
            menuKey: menuKey,
            onHomeTap: onHomeTap,
            onMenuTap: onMenuTap,
          ),
        ],
      ),
    ),
  );
}

class MobileSidebar extends StatelessWidget {
  const MobileSidebar({
    super.key,
    required this.scale,
    required this.onCloseTap,
    required this.onHomeTap,
    required this.onFeaturesTap,
    required this.onPricingTap,
    required this.onContactTap,
    this.sidebarKey,
  });

  final double scale;
  final VoidCallback onCloseTap;
  final VoidCallback onHomeTap;
  final VoidCallback onFeaturesTap;
  final VoidCallback onPricingTap;
  final VoidCallback onContactTap;
  final Key? sidebarKey;

  @override
  Widget build(BuildContext context) => Positioned.fill(
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onCloseTap,
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.18),
        child: Align(
          alignment: Alignment.topLeft,
          child: SizedBox(
            width: 328 * scale,
            height: double.infinity,
            child: SingleChildScrollView(
              child: SizedBox(
                key: sidebarKey,
                width: 328 * scale,
                height: 854 * scale,
                child: Stack(
                  children: [
                    Image.asset(
                      'assets/mobile-sidebar-figma-4x.png',
                      width: 328 * scale,
                      height: 854 * scale,
                      fit: BoxFit.fill,
                      filterQuality: FilterQuality.high,
                    ),
                    MobileSidebarHitTargets(
                      scale: scale,
                      onCloseTap: onCloseTap,
                      onHomeTap: onHomeTap,
                      onFeaturesTap: onFeaturesTap,
                      onPricingTap: onPricingTap,
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
  );
}

class MobileSidebarHitTargets extends StatelessWidget {
  const MobileSidebarHitTargets({
    super.key,
    required this.scale,
    required this.onCloseTap,
    required this.onHomeTap,
    required this.onFeaturesTap,
    required this.onPricingTap,
    required this.onContactTap,
  });

  final double scale;
  final VoidCallback onCloseTap;
  final VoidCallback onHomeTap;
  final VoidCallback onFeaturesTap;
  final VoidCallback onPricingTap;
  final VoidCallback onContactTap;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      Positioned(
        left: 16 * scale,
        top: 16 * scale,
        width: 24 * scale,
        height: 24 * scale,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onCloseTap,
        ),
      ),
      Positioned(
        left: 0,
        top: 64 * scale,
        right: 0,
        height: 57 * scale,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onHomeTap,
        ),
      ),
      Positioned(
        left: 0,
        top: 121 * scale,
        right: 0,
        height: 57 * scale,
        child: GestureDetector(
          key: const ValueKey('mobile-sidebar-features-target'),
          behavior: HitTestBehavior.opaque,
          onTap: onFeaturesTap,
        ),
      ),
      Positioned(
        left: 0,
        top: 178 * scale,
        right: 0,
        height: 57 * scale,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onPricingTap,
        ),
      ),
      Positioned(
        left: 0,
        top: 235 * scale,
        right: 0,
        height: 57 * scale,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onContactTap,
        ),
      ),
    ],
  );
}

class MobileHeaderHitTargets extends StatelessWidget {
  const MobileHeaderHitTargets({
    super.key,
    required this.scale,
    required this.onHomeTap,
    required this.onMenuTap,
    this.homeKey,
    this.menuKey,
  });

  final double scale;
  final VoidCallback onHomeTap;
  final VoidCallback onMenuTap;
  final Key? homeKey;
  final Key? menuKey;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      Positioned(
        top: 0,
        left: 0,
        width: 180 * scale,
        height: 56 * scale,
        child: GestureDetector(
          key: homeKey,
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
          key: menuKey,
          behavior: HitTestBehavior.opaque,
          onTap: onMenuTap,
        ),
      ),
    ],
  );
}
