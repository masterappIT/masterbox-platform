# MasterBox Super Admin

Next.js platform administration console for tenants, subscriptions and platform health.

## Development

```bash
npm install
npm run dev
```

The dev server runs on port 3100.

## Fonts

The console uses Manrope and DM Mono from `@fontsource/manrope` and `@fontsource/dm-mono`, imported in `pages/_app.js`. Next.js bundles the font files into `/_next/static/media`. Do not add `fonts.googleapis.com` imports.

To add a weight, import it without the `.css` suffix, for example `import '@fontsource/manrope/300'`. The webpack bundled with Next.js 12 cannot resolve the `.css` form through the package exports.

## Validation

```bash
npm run build
```
