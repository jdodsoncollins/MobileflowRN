# Mobileflow

Phone-native Webflow control plane. Plan a change, confirm it, then execute it against the live [Webflow Data API](https://developers.webflow.com/data/reference). There is no demo-site fallback on the live path.

Source is [MIT](LICENSE). The `private` flag in `package.json` only prevents accidental npm publication.

## Features

| Area | What you get |
|------|----------------|
| **Home** | Selected site briefing, locales, Analyze traffic (when the add-on is on), comments, health score, SEO debt, and site-wide publish |
| **Content** | Pages (optional locale filter), CMS search/filter/pagination, item-level CMS publish, photo → asset upload, forms inbox, Designer comments |
| **Site Health** | SEO, CMS, assets (alt text, large images), locales, and publish-readiness findings with batch SEO review |
| **Command** | Keyword planner always available. Optional on-device model (Apple Intelligence / Gemini Nano) when the OS supports it |
| **Activity** | Real API success and failure, publish rate limiting, revert where change records exist |
| **Advanced** | Headless Designer MCP tools (variables, component props). A live Designer session is optional |
| **Auth** | Webflow OAuth with PKCE. Client secret stays on your token proxy |

### Safety rules

1. The live path loads authorized Webflow data and does not inject fixtures.
2. The OAuth client secret stays on the token proxy. It never ships in the app.
3. Activity records API success and failure as returned.
4. Plans use loaded page, collection, and item IDs only.
5. Publishing a site or CMS item requires explicit confirmation.

## Tech stack

| Layer | Choice |
|------|--------|
| Runtime | [Expo](https://expo.dev) SDK `58.0.0-preview.0`, React Native `0.87.1`, React `19.2.3` |
| Language | TypeScript 6 |
| Navigation | Expo Router, NativeTabs, native form sheets |
| UI | Liquid Glass on navigation chrome; opaque HIG / Material 3 content surfaces |
| Lists | `@shopify/flash-list` |
| Auth storage | `expo-secure-store` |
| On-device planning | `mobileflow-on-device-planner` local module, then `expo-ai-kit` (`llm: true`) for the OS built-in model |
| Tests | Vitest |
| Webflow | Data API v2, OAuth, optional MCP 2.x |

| | |
| --- | --- |
| Default bundle IDs | iOS `com.example.mobileflowrn`, Android same (override in `.env`) |
| URL scheme | `mobileflow://` (override with `EXPO_PUBLIC_SCHEME`) |
| Appearance | Light |
| iOS | 26.4+ (SDK 58 emits UIScene + NativeTabs; open `ios/Mobileflow.xcworkspace`) |
| Android | API 35+ |

## Bootstrap

```bash
git clone https://github.com/jdodsoncollins/MobileflowRN.git
cd MobileflowRN
cp .env.example .env
```

Edit `.env` before you run the app.

### 1. Create a Webflow app

1. Open [Webflow Developers](https://developers.webflow.com) and create an app.
2. Add the scopes listed in `src/services/auth/endpoints.ts` (`sites`, `pages`, `cms`, `assets`, `forms`, `comments`, `components`, `authorized_user`, `branches`). Existing sessions must reconnect after a scope change.
3. Register a redirect URI. Either:
   - `mobileflow://oauth/callback`, or
   - an HTTPS page that 302s to `mobileflow://oauth/callback` (needed when the Webflow dashboard requires HTTPS).
4. Copy the **client ID** into `EXPO_PUBLIC_WEBFLOW_CLIENT_ID`. Keep the **client secret** on the server — never put it in `.env` as `EXPO_PUBLIC_*`.

### 2. Host a token proxy

The app posts the authorization code to `EXPO_PUBLIC_TOKEN_PROXY_URL`. That endpoint must:

- Accept `grant_type=authorization_code` (and optionally `refresh_token`)
- Add the client secret server-side
- Call `https://api.webflow.com/oauth/access_token`
- Return the JSON token response

Prefer a `www` host if your apex domain 308-redirects; some clients mishandle POST redirects.

Set:

```bash
EXPO_PUBLIC_WEBFLOW_CLIENT_ID=your_public_client_id
EXPO_PUBLIC_OAUTH_REDIRECT_URI=https://www.example.com/mobileflow-callback
EXPO_PUBLIC_TOKEN_PROXY_URL=https://www.example.com/mobileflow-token
```

Use your own reverse-DNS bundle ID for store builds:

```bash
EXPO_PUBLIC_BUNDLE_ID=com.example.mobileflowrn
EXPO_PUBLIC_ANDROID_PACKAGE=com.example.mobileflowrn
EXPO_PUBLIC_APPLE_TEAM_ID=
```

### 3. Install and verify

```bash
npm install
npm run typecheck
npm test
npm start
```

Expo Go is enough for JavaScript-only UI on a device on the same network. OAuth with `mobileflow://` and the native planner need a development client or store build.

### iOS simulator / Xcode (dev client)

`ios/` and `android/` are generated and gitignored. Create them once, then install pods:

```bash
npx expo prebuild --platform ios
npm run ios:pods
npm run ios
```

Or open `ios/Mobileflow.xcworkspace` in Xcode (not the `.xcodeproj`) after `ios:pods`. Always run Expo CLI from the repo root (the directory with `package.json`), not from `ios/`.

**Do not accept Xcode’s “Upgrade project document compatibility” prompt.** That rewrite stores Run Script `shellScript` as an array; CocoaPods 1.17 still requires a string (`pod install` then fails with `got Array for attribute shellScript`). If you already upgraded, from the repo root:

```bash
npm run ios:pods
npx expo run:ios --device
```

Requirements:

- Xcode with an iOS Simulator runtime
- CocoaPods (`brew install cocoapods` if `pod` is missing)
- Node 22 (matches CI)

If `pod install` fails with SSL certificate errors behind a TLS-inspecting proxy, point OpenSSL/Ruby at a CA bundle that includes the proxy root (the `ios:pods` script does this when `~/.claude/system-ca-certs.pem` or `NODE_EXTRA_CA_CERTS` is present):

```bash
export SSL_CERT_FILE=/path/to/combined-ca.pem
export GIT_SSL_CAINFO="$SSL_CERT_FILE"
npm run ios:pods
```

## Command planning

Heuristic (keyword) Command is always available.

When an on-device model is present, Command tries, in order:

1. `mobileflow-on-device-planner` (Apple Intelligence / Gemini Nano native module)
2. `expo-ai-kit` `generateObject` against the OS built-in model
3. Heuristic fallback

On-device chrome (sparkles, capability badge) is hidden when no model is available. Plans still go through `PlannedCommandParser` so the model cannot invent IDs.

## Verification

```bash
npm run verify:quick
npm run doctor
npm run audit
npm run prebuild:check
npm run verify
```

`npm test` reports the current test and assertion totals. `npm run verify` typechecks, runs tests, exports Android and web bundles, and checks their artifacts. GitHub Actions also runs Expo Doctor, dependency audit, Android prebuild, and exports on pushes and pull requests to `main`.

Optional device smoke test:

```bash
npm run smoke:maestro
```

See [`docs/live-oauth-verify.md`](docs/live-oauth-verify.md) for the physical-device OAuth checklist.

## Project layout

```text
app/                    # Expo Router (NativeTabs + form sheets)
app.config.ts           # Expo config (identity and OAuth from `.env`)
.env.example            # Required env keys for a real build
src/
  shell/                # AppProvider (not src/app)
  domain/               # Actions, models, planning, and policies
  services/             # Auth, API, MCP, execution, and storage
  features/             # Screens and task-focused sheets
  design-system/        # Shared visual and interaction primitives
  support/
modules/                # Local Expo native modules (on-device planner)
__tests__/              # Vitest tests
```

## Documentation

- [Design constraints](docs/design-constraints.md)
- [Design system](docs/design-system.md)
- [Live OAuth verification](docs/live-oauth-verify.md)
- [On-device planner](docs/on-device-planner.md)
- [Privacy](PRIVACY.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## License

[MIT](LICENSE), copyright 2026 Jeremy Collins.
