import 'package:flutter/material.dart';

import 'desktop_navigation.dart';
import 'design_tokens.dart';

class ContactPage extends StatefulWidget {
  const ContactPage({super.key});

  @override
  State<ContactPage> createState() => _ContactPageState();
}

class _ContactPageState extends State<ContactPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _companyController = TextEditingController();
  final _departmentController = TextEditingController();
  final _emailController = TextEditingController();
  final _sourceController = TextEditingController();
  final _focusNodes = List.generate(6, (_) => FocusNode());
  final _selectedTopics = <int>{};
  bool _sidebarOpen = false;

  static const _desktop = _ContactCanvas(
    id: '1920',
    designWidth: 1920,
    designHeight: 1518,
    inputPositions: [
      _InputPosition(564, 621, 380, 48),
      _InputPosition(976, 621, 380, 48),
      _InputPosition(564, 689, 380, 48),
      _InputPosition(976, 689, 380, 48),
      _InputPosition(564, 757, 380, 48),
      _InputPosition(976, 757, 380, 48),
    ],
    topicPositions: [
      Offset(564, 897),
      Offset(564, 941),
      Offset(770, 897),
      Offset(770, 941),
      Offset(976, 897),
      Offset(976, 941),
      Offset(1182, 897),
      Offset(1182, 941),
    ],
    submitPosition: Rect.fromLTWH(873, 1025, 174, 48),
  );
  static const _mobile640 = _ContactCanvas(
    id: '640',
    designWidth: 640,
    designHeight: 1392,
    inputPositions: [
      _InputPosition(24, 431, 288, 48),
      _InputPosition(328, 431, 288, 48),
      _InputPosition(24, 499, 288, 48),
      _InputPosition(328, 499, 288, 48),
      _InputPosition(24, 567, 288, 48),
      _InputPosition(328, 567, 288, 48),
    ],
    topicPositions: [
      Offset(24, 715),
      Offset(24, 759),
      Offset(176, 715),
      Offset(176, 759),
      Offset(328, 715),
      Offset(328, 759),
    ],
    submitPosition: Rect.fromLTWH(233, 843, 174, 48),
  );
  static const _mobile480 = _ContactCanvas(
    id: '480',
    designWidth: 480,
    designHeight: 1352,
    inputPositions: [
      _InputPosition(16, 447, 448, 48),
      _InputPosition(16, 515, 448, 48),
      _InputPosition(16, 583, 448, 48),
      _InputPosition(16, 651, 448, 48),
      _InputPosition(16, 719, 448, 48),
    ],
    submitPosition: Rect.fromLTWH(153, 851, 174, 48),
  );
  static const _mobile375 = _ContactCanvas(
    id: '375',
    designWidth: 375,
    designHeight: 1256,
    inputPositions: [
      _InputPosition(8, 367, 359, 48),
      _InputPosition(8, 435, 359, 48),
      _InputPosition(8, 503, 359, 48),
      _InputPosition(8, 571, 359, 48),
      _InputPosition(8, 639, 359, 48),
    ],
    submitPosition: Rect.fromLTWH(103, 731, 174, 48),
  );

  @override
  void dispose() {
    for (final controller in [
      _nameController,
      _phoneController,
      _companyController,
      _departmentController,
      _emailController,
      _sourceController,
    ]) {
      controller.dispose();
    }
    for (final focusNode in _focusNodes) {
      focusNode.dispose();
    }
    super.dispose();
  }

  _ContactCanvas _canvasFor(double width) {
    if (width > 640) return _desktop;
    if (width == 640) return _mobile640;
    if (width >= 480) return _mobile480;
    return _mobile375;
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('請先填寫必要資料')));
      return;
    }
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('已收到您的聯繫資料，專人將盡快與您聯繫')));
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final width = constraints.maxWidth;
      final isMobile = width <= 640;
      final canvas = _canvasFor(width);
      final scale = isMobile
          ? width / canvas.designWidth
          : (width / canvas.designWidth).clamp(0.0, 1.0);
      final renderedWidth = canvas.designWidth * scale;
      final renderedHeight = canvas.designHeight * scale;

      return Scaffold(
        body: Stack(
          children: [
            SingleChildScrollView(
              key: const ValueKey('contact-page'),
              child: SizedBox(
                key: ValueKey('contact-${canvas.id}-canvas'),
                width: renderedWidth,
                height: renderedHeight,
                child: Stack(
                  children: [
                    Image(
                      image: AssetImage('assets/contact-page-${canvas.id}.png'),
                      width: renderedWidth,
                      height: renderedHeight,
                      fit: BoxFit.fill,
                      filterQuality: FilterQuality.high,
                    ),
                    Form(
                      key: _formKey,
                      child: Stack(
                        children: [
                          for (
                            var index = 0;
                            index < canvas.inputPositions.length;
                            index++
                          )
                            _positionedInput(
                              canvas.inputPositions[index],
                              scale,
                              _controllersFor(canvas)[index],
                              _labelsFor(canvas)[index],
                              focusNode: _focusNodes[index],
                              requiredField:
                                  _labelsFor(canvas)[index] != '部門職稱(此項目可不填)' &&
                                  _labelsFor(canvas)[index] !=
                                      '如何得知MasterBox平台',
                            ),
                          for (
                            var index = 0;
                            index < canvas.topicPositions.length;
                            index++
                          )
                            _positionedTopic(
                              canvas.topicPositions[index],
                              scale,
                              index,
                            ),
                          Positioned.fromRect(
                            rect: _scaleRect(canvas.submitPosition, scale),
                            child: Semantics(
                              key: const ValueKey('contact-submit'),
                              button: true,
                              label: '送出',
                              child: GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: _submit,
                              ),
                            ),
                          ),
                        ],
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
                  assetPath: 'assets/contact-page-1920.png',
                  sourceHeight: 1518,
                  onHomeTap: () =>
                      Navigator.of(context).pushReplacementNamed('/'),
                  onFeaturesTap: () =>
                      Navigator.of(context).pushReplacementNamed('/features'),
                  onPricingTap: () =>
                      Navigator.of(context).pushReplacementNamed('/pricing'),
                  onContactTap: () {},
                ),
              ),
            if (isMobile)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: MobileTopBar(
                  scale: scale,
                  assetPath: 'assets/contact-page-${canvas.id}.png',
                  sourceWidth: canvas.designWidth,
                  sourceHeight: canvas.designHeight,
                  homeKey: const ValueKey('contact-mobile-logo-target'),
                  menuKey: const ValueKey('contact-mobile-menu-target'),
                  onHomeTap: () =>
                      Navigator.of(context).pushReplacementNamed('/'),
                  onMenuTap: () => setState(() => _sidebarOpen = true),
                ),
              ),
            if (_sidebarOpen && isMobile) _sidebar(context),
          ],
        ),
      );
    },
  );

  List<TextEditingController> _controllersFor(_ContactCanvas canvas) => [
    _nameController,
    _phoneController,
    _companyController,
    if (canvas.inputPositions.length == 6) _departmentController,
    _emailController,
    _sourceController,
  ];

  List<String> _labelsFor(_ContactCanvas canvas) => [
    '姓名',
    '聯絡電話',
    '公司名稱',
    if (canvas.inputPositions.length == 6) '部門職稱(此項目可不填)',
    'E-mail',
    '如何得知MasterBox平台',
  ];

  Widget _positionedInput(
    _InputPosition position,
    double scale,
    TextEditingController controller,
    String label, {
    required FocusNode focusNode,
    required bool requiredField,
  }) {
    final isEmail = label == 'E-mail';
    return Positioned(
      left: position.left * scale,
      top: position.top * scale,
      width: position.width * scale,
      height: position.height * scale,
      child: FormField<String>(
        validator: (value) {
          final text = controller.text.trim();
          if (requiredField && text.isEmpty) {
            return '';
          }
          if (isEmail &&
              text.isNotEmpty &&
              !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(text)) {
            return '';
          }
          return null;
        },
        builder: (state) => Stack(
          children: [
            Positioned(
              left: 2 * scale,
              right: 2 * scale,
              top: isEmail ? 14 * scale : 2 * scale,
              bottom: 2 * scale,
              child: ColoredBox(
                color: controller.text.isNotEmpty
                    ? Colors.white
                    : Colors.transparent,
              ),
            ),
            Positioned.fill(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 8 * scale),
                child: SizedBox.expand(
                  child: EditableText(
                    controller: controller,
                    focusNode: focusNode,
                    keyboardType: label == 'E-mail'
                        ? TextInputType.emailAddress
                        : TextInputType.text,
                    style: TextStyle(
                      fontFamily: DesignTokens.fontFamily,
                      fontSize: 14 * scale,
                      color: controller.text.isEmpty
                          ? Colors.transparent
                          : DesignTokens.black,
                    ),
                    cursorColor: DesignTokens.black,
                    backgroundCursorColor: DesignTokens.black,
                    maxLines: 1,
                    onChanged: state.didChange,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _positionedTopic(Offset position, double scale, int index) {
    final selected = _selectedTopics.contains(index);
    return Positioned(
      left: position.dx * scale,
      top: position.dy * scale,
      width: 136 * scale,
      height: 24 * scale,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() {
          if (selected) {
            _selectedTopics.remove(index);
          } else {
            _selectedTopics.add(index);
          }
        }),
        child: selected
            ? Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  width: 24 * scale,
                  height: 24 * scale,
                  decoration: BoxDecoration(
                    color: const Color(0xff454555),
                    borderRadius: BorderRadius.circular(3 * scale),
                  ),
                  child: CustomPaint(painter: _CheckMarkPainter(scale)),
                ),
              )
            : const SizedBox.expand(),
      ),
    );
  }

  Widget _sidebar(BuildContext context) => Positioned.fill(
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => setState(() => _sidebarOpen = false),
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.18),
        child: Align(
          alignment: Alignment.topLeft,
          child: SizedBox(
            width: 328 * (MediaQuery.sizeOf(context).width / 375),
            height: double.infinity,
            child: SingleChildScrollView(
              child: SizedBox(
                key: const ValueKey('contact-mobile-sidebar'),
                width: 328 * (MediaQuery.sizeOf(context).width / 375),
                height: 854 * (MediaQuery.sizeOf(context).width / 375),
                child: Stack(
                  children: [
                    Image.asset(
                      'assets/mobile-sidebar-figma-4x.png',
                      width: 328 * (MediaQuery.sizeOf(context).width / 375),
                      height: 854 * (MediaQuery.sizeOf(context).width / 375),
                      fit: BoxFit.fill,
                    ),
                    Positioned(
                      left: 0,
                      top: 64 * (MediaQuery.sizeOf(context).width / 375),
                      right: 0,
                      height: 57 * (MediaQuery.sizeOf(context).width / 375),
                      child: GestureDetector(
                        onTap: () {
                          setState(() => _sidebarOpen = false);
                          Navigator.of(context).pushReplacementNamed('/');
                        },
                      ),
                    ),
                    Positioned(
                      left: 0,
                      top: 121 * (MediaQuery.sizeOf(context).width / 375),
                      right: 0,
                      height: 57 * (MediaQuery.sizeOf(context).width / 375),
                      child: GestureDetector(
                        onTap: () {
                          setState(() => _sidebarOpen = false);
                          Navigator.of(context)
                              .pushReplacementNamed('/features');
                        },
                      ),
                    ),
                    Positioned(
                      left: 0,
                      top: 178 * (MediaQuery.sizeOf(context).width / 375),
                      right: 0,
                      height: 57 * (MediaQuery.sizeOf(context).width / 375),
                      child: GestureDetector(
                        onTap: () {
                          setState(() => _sidebarOpen = false);
                          Navigator.of(context)
                              .pushReplacementNamed('/pricing');
                        },
                      ),
                    ),
                    Positioned(
                      left: 0,
                      top: 235 * (MediaQuery.sizeOf(context).width / 375),
                      right: 0,
                      height: 57 * (MediaQuery.sizeOf(context).width / 375),
                      child: GestureDetector(
                        onTap: () => setState(() => _sidebarOpen = false),
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
  );

  Rect _scaleRect(Rect rect, double scale) => Rect.fromLTWH(
    rect.left * scale,
    rect.top * scale,
    rect.width * scale,
    rect.height * scale,
  );
}

class _ContactCanvas {
  const _ContactCanvas({
    required this.id,
    required this.designWidth,
    required this.designHeight,
    required this.inputPositions,
    required this.submitPosition,
    this.topicPositions = const [],
  });

  final String id;
  final double designWidth;
  final double designHeight;
  final List<_InputPosition> inputPositions;
  final List<Offset> topicPositions;
  final Rect submitPosition;
}

class _InputPosition {
  const _InputPosition(this.left, this.top, this.width, this.height);

  final double left;
  final double top;
  final double width;
  final double height;
}

class _CheckMarkPainter extends CustomPainter {
  const _CheckMarkPainter(this.scale);

  final double scale;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..strokeWidth = 2 * scale
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    final path = Path()
      ..moveTo(6 * scale, 12 * scale)
      ..lineTo(10 * scale, 16 * scale)
      ..lineTo(18 * scale, 8 * scale);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _CheckMarkPainter oldDelegate) =>
      oldDelegate.scale != scale;
}
