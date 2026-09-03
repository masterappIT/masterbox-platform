# MasterBox Flutter Client

Flutter client for MasterBox mobile and Web/H5. The same application supports the macOS, iOS, Android and Chrome targets where dependencies are available.

## Development

```bash
flutter pub get
flutter run -d chrome
```

The local default endpoints are `http://localhost:4000/graphql` and `http://localhost:4000`. Configure deployed environments explicitly:

```bash
flutter run -d chrome \
  --dart-define=GRAPHQL_ENDPOINT=https://api.example.com/graphql \
  --dart-define=REALTIME_ENDPOINT=https://api.example.com
```

## Validation

```bash
flutter analyze
flutter test
```
