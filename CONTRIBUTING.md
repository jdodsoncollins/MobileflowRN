# Contributing

## Setup

```bash
cp .env.example .env
# Fill Webflow client ID, redirect URI, and token proxy URL
npm install
npm run verify:quick
```

Use Node.js 22, matching CI. Keep the Expo SDK and React Native versions aligned through `npx expo install`.

For a native iOS build (simulator or device):

```bash
npx expo prebuild --platform ios
npm run ios:pods
npm run ios
```

`ios/` is gitignored. Prefer `Mobileflow.xcworkspace` after pods install. Decline Xcode’s project-document upgrade — it breaks `pod install` until `npm run ios:pods`. See the README iOS section if CocoaPods SSL fails behind a corporate proxy.

## Pull requests

- Keep changes focused and include tests for domain or service behavior.
- Preserve the plan, confirm, execute safety model and the live-data-only path.
- Do not commit OAuth secrets, access tokens, site data, generated native directories, or build exports.
- Run `npm run doctor`, `npm run audit`, `npm run typecheck`, and `npm test` before opening a pull request.
- Run `npm run verify` when changes affect bundling or platform configuration.
- Describe physical-device checks for OAuth, permissions, accessibility, or native planner changes.

Report security defects through the private process in [SECURITY.md](SECURITY.md).
