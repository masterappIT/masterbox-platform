import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

const primaryColor = Color(0xFFFFAB37);

IconData platformIcon(String? platform) => switch (platform) {
  'fb' => Icons.facebook,
  'ig' => Icons.camera_alt_outlined,
  'whatsapp' => Icons.phone_in_talk_outlined,
  'line' => Icons.chat_outlined,
  'wechat' => Icons.forum_outlined,
  _ => Icons.forum_outlined,
};

String formatDateTime(DateTime? value) {
  if (value == null) return '';
  String two(int number) => number.toString().padLeft(2, '0');
  return '${value.year}/${two(value.month)}/${two(value.day)} '
      '${two(value.hour)}:${two(value.minute)}';
}

String formatTime(DateTime value) =>
    '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';

String formatRelativeTime(DateTime? value, {DateTime? now}) {
  if (value == null) return '';
  final elapsed = (now ?? DateTime.now()).difference(value);
  if (elapsed.inDays >= 1) return '${elapsed.inDays} 天前';
  if (elapsed.inHours >= 1) return '${elapsed.inHours} 小時前';
  if (elapsed.inMinutes >= 1) return '${elapsed.inMinutes} 分鐘前';
  return '剛剛';
}

/// A person's picture. Meta's picture links expire, so a broken one falls back
/// to the first letter of the name, the same as having no picture.
class PersonAvatar extends StatelessWidget {
  const PersonAvatar({
    required this.name,
    this.imageUrl,
    this.radius,
    super.key,
  });
  final String name;
  final String? imageUrl;
  final double? radius;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl;
    final hasImage = url != null && url.startsWith('https://');
    return CircleAvatar(
      radius: radius,
      backgroundColor: const Color(0xFFFFEED7),
      foregroundColor: primaryColor,
      foregroundImage: hasImage
          ? NetworkImage(
              url,
              webHtmlElementStrategy: WebHtmlElementStrategy.fallback,
            )
          : null,
      onForegroundImageError: hasImage ? (_, _) {} : null,
      child: Text(name.isEmpty ? '?' : name.characters.first.toUpperCase()),
    );
  }
}

class ErrorRetry extends StatelessWidget {
  const ErrorRetry({required this.message, required this.onRetry, super.key});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.cloud_off, size: 40),
        const SizedBox(height: 8),
        Text(message, textAlign: TextAlign.center),
        TextButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh),
          label: const Text('重試'),
        ),
      ],
    ),
  );
}

class PageFrame extends StatelessWidget {
  const PageFrame({
    required this.title,
    required this.subtitle,
    required this.child,
    this.action,
    super.key,
  });
  final String title, subtitle;
  final Widget child;
  final Widget? action;
  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: const SystemUiOverlayStyle(
      statusBarColor: primaryColor,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
    ),
    child: Column(
      children: [
        Container(
          color: primaryColor,
          padding: EdgeInsets.fromLTRB(
            20,
            MediaQuery.paddingOf(context).top + 16,
            12,
            20,
          ),
          child: Row(
            children: [
              const CircleAvatar(
                backgroundColor: Colors.white,
                child: Icon(Icons.inventory_2_outlined, color: primaryColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(color: Colors.white70),
                    ),
                  ],
                ),
              ),
              ...?action == null ? null : <Widget>[action!],
            ],
          ),
        ),
        Expanded(child: child),
      ],
    ),
  );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle({
    required this.title,
    this.action,
    this.onAction,
    super.key,
  });
  final String title;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        const Spacer(),
        if (action != null && onAction != null)
          TextButton(onPressed: onAction, child: Text(action!))
        else if (action != null)
          Text(
            action!,
            style: TextStyle(color: Theme.of(context).colorScheme.primary),
          ),
      ],
    ),
  );
}

class ChannelTile extends StatelessWidget {
  const ChannelTile({
    required this.icon,
    required this.title,
    required this.count,
    super.key,
  });
  final IconData icon;
  final String title;
  final int count;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 8),
    color: Theme.of(context).colorScheme.surface,
    child: ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: CircleAvatar(
        backgroundColor: primaryColor.withValues(alpha: 0.16),
        foregroundColor: primaryColor,
        child: Icon(icon, size: 20),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      trailing: Text(
        '$count',
        style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
      ),
    ),
  );
}

class ConversationTile extends StatelessWidget {
  const ConversationTile({
    required this.name,
    required this.preview,
    required this.time,
    required this.onTap,
    this.avatarUrl,
    this.platform,
    super.key,
  });
  final String name, preview, time;
  final VoidCallback onTap;
  final String? avatarUrl;
  final String? platform;
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 8),
    color: Theme.of(context).colorScheme.surface,
    child: ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      leading: PersonAvatar(name: name, imageUrl: avatarUrl),
      title: Text(
        name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(
          children: [
            if (platform != null) ...[
              Icon(platformIcon(platform), size: 14, color: primaryColor),
              const SizedBox(width: 4),
            ],
            Expanded(
              child: Text(
                preview,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
      trailing: Text(
        time,
        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
      ),
    ),
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    required this.icon,
    required this.message,
    this.detail,
    this.actionLabel,
    this.onAction,
    super.key,
  });
  final IconData icon;
  final String message;
  final String? detail;
  final String? actionLabel;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 52, color: Colors.grey.shade400),
          const SizedBox(height: 12),
          Text(
            message,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          if (detail != null) ...[
            const SizedBox(height: 6),
            Text(
              detail!,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600),
            ),
          ],
          if (actionLabel != null) ...[
            const SizedBox(height: 12),
            TextButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    ),
  );
}
