import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassSurface } from './GlassChrome';
import { AccessibilityIDs } from '../support/accessibilityIDs';
import { colors, elevation, layout, spacing } from './theme';
import { useReducedMotion } from './useReducedMotion';

/**
 * Command FAB — floats in navigation layer (Liquid Glass shell + brand fill).
 * M3: primary FAB; HIG: prominent continuous control above tab chrome.
 */
export function CommandFAB({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const bottom =
    Math.max(insets.bottom, spacing.sm) + layout.tabBarHeight + spacing.md;

  return (
    <View style={[styles.wrap, styles.pointerBoxNone, { bottom }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Open command"
        accessibilityHint="Opens the command planning sheet"
        testID={AccessibilityIDs.commandFAB}
        style={({ pressed }) => [
          pressed && (reduceMotion ? styles.pressedStatic : styles.pressed),
        ]}
      >
        <GlassSurface style={styles.ring} intensity={40}>
          <View style={[styles.core, elevation.high]}>
            <Text style={styles.glyph}>✦</Text>
          </View>
        </GlassSurface>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 25,
  },
  pointerBoxNone: {
    pointerEvents: 'box-none',
  },

  ring: {
    width: layout.fabSize + 8,
    height: layout.fabSize + 8,
    borderRadius: (layout.fabSize + 8) / 2,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: layout.fabSize,
    height: layout.fabSize,
    borderRadius: layout.fabSize / 2,
    backgroundColor: colors.fab,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    color: colors.fabOn,
    fontSize: 22,
    fontWeight: '600',
  },
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.92,
  },
  pressedStatic: { opacity: 0.72 },
});
