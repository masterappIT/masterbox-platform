import 'package:flutter/material.dart';

class DesktopNavigationHitTargets extends StatelessWidget {
  const DesktopNavigationHitTargets({
    super.key,
    required this.onHomeTap,
    required this.onFeaturesTap,
    required this.onPricingTap,
    required this.onContactTap,
  });

  final VoidCallback onHomeTap;
  final VoidCallback onFeaturesTap;
  final VoidCallback onPricingTap;
  final VoidCallback onContactTap;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      Positioned(left: 20, top: 8, width: 145, height: 40, child: _hit(onHomeTap)),
      Positioned(left: 520, top: 8, width: 72, height: 40, child: _hit(onFeaturesTap)),
      Positioned(left: 616, top: 8, width: 72, height: 40, child: _hit(onPricingTap)),
      Positioned(left: 712, top: 8, width: 72, height: 40, child: _hit(onContactTap)),
    ],
  );

  Widget _hit(VoidCallback onTap) => MouseRegion(
    cursor: SystemMouseCursors.click,
    child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap),
  );
}
