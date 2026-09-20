import { type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import {
  colors,
  elevation,
  isIOS,
  radii,
  spacing,
  touch,
  typography,
} from './theme';
import { useReducedMotion } from './useReducedMotion';
import {
  canUseNativeLiquidGlass,
  chromeGlassColorScheme,
  chromeGlassEffectStyle,
  useReduceTransparency,
} from './liquidGlass';

/**
 * Liquid Glass / M3 floating chrome for the *navigation layer only*
 * (tab bars, toolbar pills, floating buttons). Do not wrap content cards.
 */
export function GlassSurface({
  children,
  style,
  intensity = Platform.OS === 'ios' ? 55 : 40,
  interactive = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  interactive?: boolean;
}) {
  const reduceTransparency = useReduceTransparency();
  const nativeGlass = !reduceTransparency && canUseNativeLiquidGlass();

  if (nativeGlass) {
    return (
      <GlassView
        glassEffectStyle={chromeGlassEffectStyle}
        colorScheme={chromeGlassColorScheme}
        isInteractive={interactive}
        style={[{ overflow: 'hidden', borderRadius: radii.pill }, style]}
      >
        {children}
      </GlassView>
    );
  }

  if (Platform.OS === 'web' || reduceTransparency) {
    return (
      <View style={[styles.glassFallback, elevation.mid, style]}>{children}</View>
    );
  }
  return (
    <View style={[styles.glassOuter, elevation.mid, style]}>
      <BlurView
        intensity={intensity}
        tint={Platform.OS === 'ios' ? 'systemChromeMaterialLight' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.glassSheen, styles.pointerNone]} />
      <View style={styles.glassInner}>{children}</View>
    </View>
  );
}

/** Circular glass toolbar control (HIG toolbar / M3 icon button). */
export function GlassIconButton({
  label,
  onPress,
  children,
  disabled,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconHit,
        pressed && (reduceMotion ? styles.pressedStatic : styles.pressed),
        disabled && styles.disabled,
      ]}
    >
      <GlassSurface style={styles.iconGlass} intensity={48}>
        <View style={styles.iconContent}>{children}</View>
      </GlassSurface>
    </Pressable>
  );
}

/** Primary filled button — content layer (not glass). M3 filled / iOS prominent. */
export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  testID,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={loading ? `${title}, in progress` : title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryBtn,
        pressed && styles.primaryPressed,
        (disabled || loading) && styles.disabled,
      ]}
    >
      <Text
        style={styles.primaryLabel}
        accessibilityLiveRegion={loading ? 'polite' : 'none'}
      >
        {loading ? 'In progress…' : title}
      </Text>
    </Pressable>
  );
}

/** Opaque content card (HIG grouped / M3 surface container). */
export function ContentCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, elevation.low, style]}>{children}</View>;
}

/** Section header label. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={styles.sectionLabel} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  glassOuter: {
    overflow: 'hidden',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFill,
  },
  glassFallback: {
    overflow: 'hidden',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassFillStrong,
  },
  glassSheen: {
    ...StyleSheet.absoluteFill,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassHighlight,
  },
  pointerNone: {
    pointerEvents: 'none',
  },
  glassInner: {
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  iconHit: {
    minWidth: touch.min,
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlass: {
    width: touch.icon,
    height: touch.icon,
    borderRadius: touch.icon / 2,
    overflow: 'hidden',
  },
  iconContent: {
    width: touch.icon,
    height: touch.icon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  pressedStatic: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  primaryBtn: {
    minHeight: touch.min,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  primaryPressed: { backgroundColor: colors.fabPressed },
  primaryLabel: {
    ...typography.headline,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: Platform.OS === 'android' ? 0 : StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionLabel: {
    ...typography.label,
    textTransform: Platform.OS === 'ios' ? 'uppercase' : 'none',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    letterSpacing: Platform.OS === 'ios' ? 0.4 : 0.1,
  },
});
