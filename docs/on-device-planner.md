# On-device Command planner (RN)

## Product goal

Optional free offline planning for Command. Always falls back to the **keyword planner**. On unsupported devices the on-device UI is **hidden**.

The Expo 58 stack also includes `expo-ai-kit@0.17` (`llm: true`) for the OS built-in model (Apple Foundation Models on iOS 26.4+, AFM 3 Core on iOS 27, Gemini Nano on Android 15+). Command planning still goes through `mobileflow-on-device-planner` with heuristic fallback. Hide on-device chrome when `isOnDeviceAvailable()` is false.

## iOS — Apple Intelligence first

| Item | Detail |
| --- | --- |
| Module | `modules/mobileflow-on-device-planner` (Expo native module) |
| Framework | Foundation Models / `SystemLanguageModel` (same path as SwiftUI) |
| OS | iOS **26.4+** with Apple Intelligence availability |
| Tier | `appleIntelligence` |
| Output | Command lines → JS `PlannedCommandParser` (loaded IDs only) |
| Build | Requires `npx expo prebuild` + **dev client** or store build (not Expo Go) |
| Stack | `expo-ai-kit` is linked for OS-managed models; Command still uses this module |

Swift entry: `MobileflowOnDevicePlannerModule.swift`  
Mirrors iOS app `FoundationModelsActionPlanner` instructions grammar.

## Android — Gemini Nano + fragmentation tiers

| Tier | When | Context budget (hint) |
| --- | --- | --- |
| `none` | No AICore / Nano / ML Kit GenAI | Heuristic only |
| `geminiNano` | Gemini Nano path available | ~2048 tokens |
| `geminiNanoHigh` | Higher-capability devices (Pixel 8 Pro/9/10 class, flagship series, API 35+ with headroom) | ~8192 tokens |

Implementation: `GeminiNanoBackend.kt` via **ML Kit GenAI Prompt API** (Gemini Nano on AICore). Reflection soft-probes beta API shapes so builds degrade cleanly.

Fragmentation is **allowed and expected**: more capable phones get `geminiNanoHigh` metadata and slightly larger step budgets; weaker/unsupported phones stay on keyword planning with no dead UI.

Dependency (native build): `com.google.mlkit:genai-prompt:1.0.0-beta1`  
Docs: https://developers.google.com/ml-kit/genai/prompt/android

## JS wiring

```
ActionPlanner.planWithContext
  → OnDeviceActionPlanner
      → mobileflow-on-device-planner (if linked + available)
      → expo-ai-kit generateObject (OS built-in model, if available)
      → PlannedCommandParser (loaded IDs only)
      → else HeuristicActionPlanner
```

On-device chrome is hidden when `detectPlannerCapability()` is `heuristicOnly`.

Capability:

```ts
import {
  detectPlannerCapability,
  getOnDeviceCapabilityInfo,
} from '@/domain/planning';
```

Tests inject `global.__MOBILEFLOW_ON_DEVICE_PLANNER__`.

## Limits

- Planning only; execute still uses live Webflow Data API (network).
- No free-form agent; only parser command lines.
- Expo Go: native module **not** linked → heuristic only.
- Nano quality and device support vary by OEM/OS model packs.
- Apple controls which devices get Foundation Models.

## Local native build

```bash
cd MobileflowRN
npm install
npx expo prebuild
# iOS (macOS): npx expo run:ios
# Android: npx expo run:android
```
