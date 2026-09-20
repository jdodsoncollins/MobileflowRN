# Live OAuth verify checklist

Run on a **physical device** using a development or store build. Expo Go cannot receive the app's `mobileflow://` custom-scheme OAuth callback, so it cannot verify this flow.

Values come from `.env` (`EXPO_PUBLIC_WEBFLOW_CLIENT_ID`, `EXPO_PUBLIC_OAUTH_REDIRECT_URI`, `EXPO_PUBLIC_TOKEN_PROXY_URL`). The client secret stays on the token proxy only.

## Prerequisites

1. Token proxy live at `EXPO_PUBLIC_TOKEN_PROXY_URL` (client secret only in that host's environment)
2. Redirect URI registered in the Webflow app dashboard, matching `EXPO_PUBLIC_OAUTH_REDIRECT_URI`. Use the **www** host (for this project: `https://www.jeremycollins.net/mobileflow-callback`). Apex 308-redirects to www and in-app Safari reloads after Google login.
3. App: from the repository root, run `npm install && npm start` (or a release/dev client build)
4. Install a **development build or store build** on a physical phone. Expo Go cannot complete `mobileflow://` OAuth for this app.
5. After authorizing in the system browser, the “Returning to Mobileflow…” page should open the app automatically; if not, tap **Return to Mobileflow app**.

## Steps

1. Cold launch → **Connect** (or restore SecureStore session; **no invented sites**)
2. OAuth completes → only **authorized** sites appear
3. Site select → page/CMS counts match Dashboard
4. Content → **Draft Missing Metadata** → Apply → Activity shows completed or real failure
5. CMS → open a collection → search/filter → **Publish** on a draft item → hard confirm → item is live (site is not republished)
6. Content → **Forms** → open submissions → delete requires confirmation
7. **Publish site…** → preflight → hard confirm → once succeeds
8. Publish again &lt;60s → rate-limit banner; no silent double publish
9. Command “Publish the homepage…” → **exactly one** publish step after hard confirm
10. Kill & relaunch → Activity still present
11. Assets = Photo → Asset only (success after a real upload)
12. Advanced → MCP headless tools after connect; Designer Bridge not required for variable/component writes; no sample variables

## Automated smoke (Maestro)

With Maestro installed and a device/emulator:

```bash
maestro test .maestro/smoke.yaml
```

This flow does **not** complete real OAuth (no secrets in CI). It verifies shell tabs and empty states.
