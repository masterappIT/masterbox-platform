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

  static const double height = 120;

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
