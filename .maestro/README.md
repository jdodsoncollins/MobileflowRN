# Maestro smoke flows

Install: https://maestro.mobile.dev/

```bash
# Start Metro / Expo first, open app on device
maestro test .maestro/smoke.yaml
```

`smoke.yaml` targets Expo Go host by default. For a standalone build, set `appId` to `com.jcollins.MobileflowRN` (Android) or the iOS bundle id.

Full live OAuth is manual — see `docs/live-oauth-verify.md`.
