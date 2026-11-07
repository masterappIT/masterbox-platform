import 'package:flutter/material.dart';

/// The chat room's colours, from the Figma variable collection
/// 「MasterBox Chat v1」, Light and Dark modes. The app follows the phone's
/// light or dark setting, and every chat screen reads its colours from here.
@immutable
class ChatColors extends ThemeExtension<ChatColors> {
  const ChatColors({
    required this.brandPrimary,
    required this.brandPrimaryDark,
    required this.brandPrimarySoft,
    required this.brandPrimaryTint,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.textOnPrimary,
    required this.borderDefault,
    required this.borderStrong,
    required this.surfacePage,
    required this.surfaceCard,
    required this.surfaceChat,
    required this.surfaceNav,
    required this.bubbleCustomer,
    required this.bubbleCompany,
    required this.bubbleNote,
    required this.bubbleNoteBorder,
    required this.statusOpen,
    required this.statusOpenSoft,
    required this.statusProgress,
    required this.statusProgressSoft,
    required this.statusClosed,
    required this.statusClosedSoft,
    required this.feedbackAlert,
    required this.feedbackAlertSoft,
    required this.feedbackInfo,
    required this.feedbackInfoSoft,
    required this.feedbackSuccess,
    required this.sources,
    required this.sourcesSoft,
    required this.names,
  });

  final Color brandPrimary;
  final Color brandPrimaryDark;
  final Color brandPrimarySoft;
  final Color brandPrimaryTint;
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color textOnPrimary;
  final Color borderDefault;
  final Color borderStrong;
  final Color surfacePage;
  final Color surfaceCard;
  final Color surfaceChat;
  final Color surfaceNav;
  final Color bubbleCustomer;
  final Color bubbleCompany;
  final Color bubbleNote;
  final Color bubbleNoteBorder;
  final Color statusOpen;
  final Color statusOpenSoft;
  final Color statusProgress;
  final Color statusProgressSoft;
  final Color statusClosed;
  final Color statusClosedSoft;
  final Color feedbackAlert;
  final Color feedbackAlertSoft;
  final Color feedbackInfo;
  final Color feedbackInfoSoft;
  final Color feedbackSuccess;

  /// `source/<name>`: the dot of a source tag, by source (messenger,
  /// instagram, whatsapp_cloud, whatsapp_web, line, chatbox_internal,
  /// chatbox_external).
  final Map<String, Color> sources;

  /// `source/<name>-soft`: the tag's background.
  final Map<String, Color> sourcesSoft;

  /// name/1–4: colleagues' names in a group, each person one colour.
  final List<Color> names;

  Color sourceColor(String? source) => sources[source] ?? textTertiary;
  Color sourceSoftColor(String? source) =>
      sourcesSoft[source] ?? statusClosedSoft;

  static const light = ChatColors(
    brandPrimary: Color(0xFFFFAB37),
    brandPrimaryDark: Color(0xFFF08F36),
    brandPrimarySoft: Color(0xFFFFEED7),
    brandPrimaryTint: Color(0xFFFFF5E8),
    textPrimary: Color(0xFF1F1F1F),
    textSecondary: Color(0xFF666666),
    textTertiary: Color(0xFF9A9A9A),
    textOnPrimary: Color(0xFFFFFFFF),
    borderDefault: Color(0xFFE6E6E6),
    borderStrong: Color(0xFFD0D0D0),
    surfacePage: Color(0xFFF7F7F7),
    surfaceCard: Color(0xFFFFFFFF),
    surfaceChat: Color(0xFFF2EDE6),
    surfaceNav: Color(0xFFFFFFFF),
    bubbleCustomer: Color(0xFFFFFFFF),
    bubbleCompany: Color(0xFFFFE9CC),
    bubbleNote: Color(0xFFFFF6D6),
    bubbleNoteBorder: Color(0xFFF2D58A),
    statusOpen: Color(0xFFFFAB37),
    statusOpenSoft: Color(0xFFFFF3E3),
    statusProgress: Color(0xFF2B84FF),
    statusProgressSoft: Color(0xFFE1EEFF),
    statusClosed: Color(0xFF9A9A9A),
    statusClosedSoft: Color(0xFFF1F1F1),
    feedbackAlert: Color(0xFFEB6666),
    feedbackAlertSoft: Color(0xFFFBE0E0),
    feedbackInfo: Color(0xFF2B84FF),
    feedbackInfoSoft: Color(0xFFEAF3FF),
    feedbackSuccess: Color(0xFF3FA66B),
    sources: {
      'messenger': Color(0xFF1877F2),
      'instagram': Color(0xFFE1306C),
      'whatsapp_cloud': Color(0xFF25D366),
      'whatsapp_web': Color(0xFF128C7E),
      'line': Color(0xFF06C755),
      'chatbox_internal': Color(0xFF7993B7),
      'chatbox_external': Color(0xFF2B84FF),
    },
    sourcesSoft: {
      'messenger': Color(0xFFE3EFFD),
      'instagram': Color(0xFFFBE6ED),
      'whatsapp_cloud': Color(0xFFE5FAED),
      'whatsapp_web': Color(0xFFE3F1F0),
      'line': Color(0xFFE1F8EB),
      'chatbox_internal': Color(0xFFEFF2F6),
      'chatbox_external': Color(0xFFE6F0FF),
    },
    names: [
      Color(0xFFD9731F),
      Color(0xFF2B7BE5),
      Color(0xFF2E9A5C),
      Color(0xFF9B4DC4),
    ],
  );

  static const dark = ChatColors(
    brandPrimary: Color(0xFFFFAB37),
    brandPrimaryDark: Color(0xFFF5A03A),
    brandPrimarySoft: Color(0xFF4A3418),
    brandPrimaryTint: Color(0xFF2A2218),
    textPrimary: Color(0xFFECECEC),
    textSecondary: Color(0xFFA8A8A8),
    textTertiary: Color(0xFF7A7A7A),
    textOnPrimary: Color(0xFFFFFFFF),
    borderDefault: Color(0xFF2E2F33),
    borderStrong: Color(0xFF3D3E42),
    surfacePage: Color(0xFF0F1012),
    surfaceCard: Color(0xFF1A1B1E),
    surfaceChat: Color(0xFF121314),
    surfaceNav: Color(0xFF1A1B1E),
    bubbleCustomer: Color(0xFF25262A),
    bubbleCompany: Color(0xFF4A3418),
    bubbleNote: Color(0xFF3A3115),
    bubbleNoteBorder: Color(0xFF6B5A24),
    statusOpen: Color(0xFFFFAB37),
    statusOpenSoft: Color(0xFF3A2A14),
    statusProgress: Color(0xFF4C97FF),
    statusProgressSoft: Color(0xFF17263D),
    statusClosed: Color(0xFF8A8A8A),
    statusClosedSoft: Color(0xFF2A2A2A),
    feedbackAlert: Color(0xFFF07878),
    feedbackAlertSoft: Color(0xFF3D1F1F),
    feedbackInfo: Color(0xFF4C97FF),
    feedbackInfoSoft: Color(0xFF17263D),
    feedbackSuccess: Color(0xFF4CC17E),
    sources: {
      'messenger': Color(0xFF4C9AFF),
      'instagram': Color(0xFFF0578A),
      'whatsapp_cloud': Color(0xFF25D366),
      'whatsapp_web': Color(0xFF2BB3A3),
      'line': Color(0xFF06C755),
      'chatbox_internal': Color(0xFF93A9C8),
      'chatbox_external': Color(0xFF4C97FF),
    },
    sourcesSoft: {
      'messenger': Color(0xFF16253A),
      'instagram': Color(0xFF3A1825),
      'whatsapp_cloud': Color(0xFF133523),
      'whatsapp_web': Color(0xFF12302D),
      'line': Color(0xFF12321F),
      'chatbox_internal': Color(0xFF22272F),
      'chatbox_external': Color(0xFF172640),
    },
    names: [
      Color(0xFFFFA45C),
      Color(0xFF6AAEFF),
      Color(0xFF5CCB8A),
      Color(0xFFC68AE8),
    ],
  );

  @override
  ChatColors copyWith() => this;

  @override
  ChatColors lerp(ThemeExtension<ChatColors>? other, double t) {
    if (other is! ChatColors) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    Map<String, Color> m(Map<String, Color> a, Map<String, Color> b) => {
      for (final key in a.keys) key: c(a[key]!, b[key] ?? a[key]!),
    };
    return ChatColors(
      brandPrimary: c(brandPrimary, other.brandPrimary),
      brandPrimaryDark: c(brandPrimaryDark, other.brandPrimaryDark),
      brandPrimarySoft: c(brandPrimarySoft, other.brandPrimarySoft),
      brandPrimaryTint: c(brandPrimaryTint, other.brandPrimaryTint),
      textPrimary: c(textPrimary, other.textPrimary),
      textSecondary: c(textSecondary, other.textSecondary),
      textTertiary: c(textTertiary, other.textTertiary),
      textOnPrimary: c(textOnPrimary, other.textOnPrimary),
      borderDefault: c(borderDefault, other.borderDefault),
      borderStrong: c(borderStrong, other.borderStrong),
      surfacePage: c(surfacePage, other.surfacePage),
      surfaceCard: c(surfaceCard, other.surfaceCard),
      surfaceChat: c(surfaceChat, other.surfaceChat),
      surfaceNav: c(surfaceNav, other.surfaceNav),
      bubbleCustomer: c(bubbleCustomer, other.bubbleCustomer),
      bubbleCompany: c(bubbleCompany, other.bubbleCompany),
      bubbleNote: c(bubbleNote, other.bubbleNote),
      bubbleNoteBorder: c(bubbleNoteBorder, other.bubbleNoteBorder),
      statusOpen: c(statusOpen, other.statusOpen),
      statusOpenSoft: c(statusOpenSoft, other.statusOpenSoft),
      statusProgress: c(statusProgress, other.statusProgress),
      statusProgressSoft: c(statusProgressSoft, other.statusProgressSoft),
      statusClosed: c(statusClosed, other.statusClosed),
      statusClosedSoft: c(statusClosedSoft, other.statusClosedSoft),
      feedbackAlert: c(feedbackAlert, other.feedbackAlert),
      feedbackAlertSoft: c(feedbackAlertSoft, other.feedbackAlertSoft),
      feedbackInfo: c(feedbackInfo, other.feedbackInfo),
      feedbackInfoSoft: c(feedbackInfoSoft, other.feedbackInfoSoft),
      feedbackSuccess: c(feedbackSuccess, other.feedbackSuccess),
      sources: m(sources, other.sources),
      sourcesSoft: m(sourcesSoft, other.sourcesSoft),
      names: [
        for (var i = 0; i < names.length; i++) c(names[i], other.names[i]),
      ],
    );
  }
}

extension ChatColorsOf on BuildContext {
  /// The chat colours of the current light or dark theme.
  ChatColors get chat =>
      Theme.of(this).extension<ChatColors>() ??
      (Theme.of(this).brightness == Brightness.dark
          ? ChatColors.dark
          : ChatColors.light);
}
