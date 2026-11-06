# MasterBox Flutter Client

Flutter client for MasterBox mobile and Web/H5. The same application supports the macOS, iOS, Android and Chrome targets where dependencies are available.

## Development

```bash
flutter pub get
flutter run -d chrome
```

The local default endpoints are `http://localhost:4000/graphql`, `http://localhost:4000` and, for the admin site, `http://localhost:3000`. Configure deployed environments explicitly:

```bash
flutter run -d chrome \
  --dart-define=GRAPHQL_ENDPOINT=https://api.example.com/graphql \
  --dart-define=REALTIME_ENDPOINT=https://api.example.com \
  --dart-define=ADMIN_URL=https://admin.example.com
```

`ADMIN_URL` is where a Meta channel connection finishes: the backend only returns to origins it allows, so the browser ends on the admin site's channel page.

The web build calls the API from the browser, so its origin must be listed in the backend's `CORS_ALLOWED_ORIGINS`.

## Validation

```bash
flutter analyze
flutter test
```

## Push notifications

The iPhone gets a notification when a customer writes in a conversation the signed-in account works in: its agent when it is assigned, otherwise everyone with access to the channel. Tapping it opens the conversation. Signing out, or switching push off in Settings, stops them on that phone.

The Chat tab and the app icon show how many of the account's conversations have unread customer messages (`unreadChatRoomCount`). Each notification carries that number for its account, and the open app sets it again whenever messages arrive or a conversation is read. Signing out clears it.

While the app is open the phone shows nothing itself, so the app shows a notice with a link to the conversation, unless that conversation is on screen or the in-app switch in Settings is off. It goes to the same people as a notification: the app asks the backend (`messageNotifiesMe`) and shows the notice if the backend can't answer. In the background or closed, the phone shows the notification and tapping it opens the conversation.

Notifications go straight to Apple (APNs). The app registers its device token with the backend, which signs in with the APNs key, a `.p8` file mounted into the API container (`APNS_KEY_FILE`, see `backend/.env.example`). The key is never in this repository, which is public, or in the image. Without it the API logs `Push notifications are off` and the app says the server has no push set up.

The MasterBox Push key only covers production, so notifications arrive in TestFlight and App Store builds, not in builds run from Xcode onto a phone. The App ID needs the Push Notifications capability.

Android has no push yet: Settings says so, and the app never asks for notification permission there. In-app notices work the same. Adding it needs a push service for Android (Firebase Cloud Messaging), a sender next to `backend/lib/push/apns.js` chosen by the stored `device_tokens.platform`, and an Android `PushClient`.
