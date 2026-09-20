import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import {
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';

export const chromeGlassEffectStyle = 'clear' as const;
export const chromeGlassColorScheme = 'auto' as const;

export function canUseNativeLiquidGlass(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

export function useReduceTransparency(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (typeof AccessibilityInfo.isReduceTransparencyEnabled !== 'function') {
      return;
    }
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setEnabled);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setEnabled,
    );
    return () => subscription.remove();
  }, []);

  return enabled;
}
