# MasterBox Admin

Next.js administration console for managing companies, channels, conversations and platform operations.

## Development

```bash
npm install
npm run dev
```

`.npmrc` sets `package-lock=false`, so `npm install` does not update `package-lock.json`. CI installs with `npm ci`, which fails when the lockfile is out of date. After adding or changing a dependency, update the lockfile explicitly:

```bash
npm install --package-lock-only --package-lock=true
```

Configure backend URLs with `GRAPHQL_CONNECTION_*`, `GRAPHQL_WS_CONNECTION_*` and `API_CONNECTION_*`. Set production values explicitly; deployed builds must not depend on localhost defaults.

## Fonts

The console uses Noto Sans TC from `@fontsource/noto-sans-tc`, imported in `src/styles/globals.scss`. Next.js bundles the font files into `/_next/static/media`, and browsers download only the character ranges a page uses. Do not add `fonts.googleapis.com` imports.

To add a weight, import it without the `.css` suffix, for example `@import '@fontsource/noto-sans-tc/600';`. The webpack bundled with Next.js 12 cannot resolve the `.css` form through the package exports.

## Validation

```bash
npm run lint
npm run build
```
