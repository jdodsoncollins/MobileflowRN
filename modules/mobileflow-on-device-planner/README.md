# mobileflow-on-device-planner

Local Expo module for free offline Command planning.

| Platform | Backend | Tier |
| --- | --- | --- |
| iOS 26+ (Apple Intelligence) | Foundation Models / `SystemLanguageModel` | `appleIntelligence` |
| Android (AICore) | Gemini Nano via ML Kit GenAI Prompt | `geminiNano` |
| Flagship / high-RAM Android | Same path, expanded budget | `geminiNanoHigh` |
| Everything else | Not linked / unavailable | `none` → JS heuristic |

## API (JS)

```ts
import {
  getOnDeviceCapability,
  isOnDeviceAvailable,
  planCommandLinesNative,
  isNativePlannerLinked,
} from 'mobileflow-on-device-planner';
```

## Build

Requires a **dev client** or store binary (`npx expo prebuild` then `run:ios` / `run:android`). **Expo Go does not include this module.**
