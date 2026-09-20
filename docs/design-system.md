# Design system — HIG + Material 3

MobileflowRN UI targets **Apple Human Interface Guidelines** (including **Liquid Glass** for navigation chrome) and **Material Design 3**, using one token set with platform-aware values.

## Hierarchy

| Layer | Material | Examples |
| --- | --- | --- |
| **Content** | Opaque tonal surfaces | Lists, cards, forms, banners |
| **Navigation** | Liquid Glass (blur + sheen) | Floating tab bar, toolbar icon buttons, FAB ring |

Apple: *Liquid Glass is for the navigation layer that floats above content — not for list rows or forms.*  
Material: *Tonal surfaces, active indicators, 48dp touch targets, primary FAB.*

## Tokens

- `src/design-system/theme.ts` — colors, type, spacing (8pt), radii, elevation, layout insets  
- `GlassChrome.tsx` — `GlassSurface`, `GlassIconButton`, `PrimaryButton`, `ContentCard`  
- iOS tab chrome is Expo Router `NativeTabs` (`NativeTabs.Trigger.*` children on SDK 58). `FloatingTabBar.tsx` is unused on iOS.  
- `CommandFAB.tsx` — Android Command control; iOS opens Command from the header sparkles button  

## Principles applied

1. **Clear hierarchy** — content solid; chrome translucent  
2. **Touch targets** at least 44pt on iOS and 48dp on Android
3. **Inline nav titles** (site switcher); not large titles  
4. **Active indicator** on selected tab (M3) inside glass capsule (HIG)  
5. **Content bottom inset** so lists clear floating chrome  
6. **Brand primary** purple used sparingly for actions and selection  
7. **Semantic chips** for risk/status stay in the content layer  
8. **Appearance** stays light until a complete dark palette exists
9. **Motion** respects the operating system's Reduce Motion setting

## Platform notes

- **iOS:** system NativeTabs; `UIGlassEffect` via `expo-glass-effect` on chrome; BlurView fallback. Inline nav titles (site switcher). Do not use large titles (RefreshControl loop).  
- **Android:** Material-leaning surfaces `#F7F5FA` / `#FFFBFE`, slightly stronger elevation  
- **Web:** solid glass fallback (no BlurView)  
