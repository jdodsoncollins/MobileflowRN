# Mobileflow.icon (code-authored Icon Composer package)

`.icon` is a **directory package**:

```
Mobileflow.icon/
  icon.json          # structure, fills, light/dark/tinted, layer flags
  Assets/
    monogram.png     # flat white m, transparent bg
    rim.png          # gradient ring only, transparent center + outside
```

## What is code vs image

| Piece | Where |
| --- | --- |
| Background face | **`icon.json` `fill` + `fill-specializations`** (Default / Dark / Tinted) — not baked into PNGs |
| Rim (circle) | `Assets/rim.png` (magenta → purple → cyan ring) |
| Monogram | `Assets/monogram.png` (flat white `m`, no glow, no emboss) |
| Glow / glass / emboss | **None** — `glass: false`, `shadow.kind: none`, `specular: false` |

## Regenerate

```bash
python3 scripts/build-mobileflow-icon.py
# or: npm run icon:generate  (rebuilds layers + .icon + Expo fallback PNG)
```

## Open / wire

```bash
open -a "Icon Composer" assets/icon-composer/Mobileflow.icon
```

Add `Mobileflow.icon` to the Xcode target (same level as Assets, not inside `.xcassets`). Point **App Icon** at it for Liquid Glass. Expo still uses `assets/icon.png` as the flattened fallback until prebuild picks up the `.icon`.

## Preview with ictool

```bash
ICTOOL="/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool"
$ICTOOL assets/icon-composer/Mobileflow.icon --export-image \
  --output-file /tmp/mf.png --platform iOS --rendition Default --width 1024 --height 1024 --scale 1
```
