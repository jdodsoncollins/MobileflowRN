# MobileflowRN agent notes

- Separate app from Takt; do not merge codebases.
- Shell lives in `src/shell` (not `src/app` — Expo Router collision). Routes live in repo-root `app/` with NativeTabs.
- Site scope = selected Webflow site (header title). Do not N+1 CMS/page fetches from the site picker.
- Live Webflow Data API only — no fake demo sites on the live path.
- Mutating actions: ConfirmationPolicy + hard confirm for publish.
- Liquid Glass on navigation chrome only; content = opaque HIG/M3 surfaces.
- Keep `mobileflow-on-device-planner`. Heuristic Command always available; hide LLM chrome when `isOnDeviceAvailable()` is false.
- iOS 26.4+. Do not set `UIDesignRequiresCompatibility`.
- Decline Xcode’s project-document upgrade (it breaks `pod install`). If pods fail with `got Array for attribute shellScript`, run `npm run ios:pods` from the repo root.
- Prefer unit tests for domain/planning and API mapping when changing behavior.
- Update `README.md` and `docs/` when revising the plan.
