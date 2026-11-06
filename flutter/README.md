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

The phone gets a notification when a customer writes in a conversation the signed-in account works in: its agent when it is assigned, otherwise everyone with access to the channel. Tapping it opens the conversation. Signing out, or switching push off in Settings, stops them on that phone.

Notifications go through Firebase Cloud Messaging; Firebase hands the iOS ones to APNs with the APNs key uploaded to the Firebase project. Nothing about the Firebase project is kept in this repository, which is public:

- **App**: the project settings are given at build time. Copy `firebase-defines.example.json` to `firebase-defines.json` (ignored by git), fill it in from the Firebase console (Project settings → Your apps), and build with `--dart-define-from-file=firebase-defines.json`. A build without them works as before, only without push, and Settings says so.
- **Server**: the Firebase service account key, mounted into the API container; `FCM_SERVICE_ACCOUNT_FILE` points at it (see `backend/.env.example`). Without it the API logs `Push notifications are off` and the app says the server has no push set up.

```bash
flutter build ipa --build-number 17 \
  --dart-define=GRAPHQL_ENDPOINT=https://api.masterbox.masterappinc.com/graphql \
  --dart-define=REALTIME_ENDPOINT=https://api.masterbox.masterappinc.com \
  --dart-define=ADMIN_URL=https://admin.masterbox.masterappinc.com \
  --dart-define-from-file=firebase-defines.json
```

While the app is open the phone shows nothing itself, so the app shows a notice with a link to the conversation, unless that conversation is on screen or the in-app switch in Settings is off. In the background or closed, the phone shows the notification and tapping it opens the conversation. An Android app the user force-stopped gets nothing until it is opened again; that is Android's rule.

The MasterBox Push APNs key only covers production, so iOS notifications arrive in TestFlight and App Store builds, not in builds run from Xcode onto a phone.
