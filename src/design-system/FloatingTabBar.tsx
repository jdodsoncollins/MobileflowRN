import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassSurface } from './GlassChrome';
import { colors, layout, radii, spacing, typography } from './theme';
import type { AppTab } from '../shell/AppContext';

type TabItem = {
  key: AppTab;
  label: string;
  icon: string;
  testID: string;
};

/**
 * Floating capsule tab bar — Liquid Glass navigation layer (HIG)
 * + Material 3 bottom nav active indicator.
 * Content scrolls underneath (inset margins).
 */
export function FloatingTabBar({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: TabItem[];
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, spacing.sm);

  return (
    <View
      style={[styles.wrap, styles.pointerBoxNone, { paddingBottom: bottom }]}
      accessibilityRole="tablist"
    >
      <GlassSurface style={styles.bar} intensity={64}>
        <View style={styles.row}>
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => onChange(tab.key)}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
                accessibilityHint={`Switches to the ${tab.label} tab`}
                testID={tab.testID}
              >
                <View style={[styles.indicator, active && styles.indicatorOn]}>
                  <Text
                    style={[styles.icon, active && styles.iconOn]}
                    allowFontScaling
                  >
                    {tab.icon}
                  </Text>
                </View>
                <Text
                  style={[styles.label, active && styles.labelOn]}
                  numberOfLines={2}
                  allowFontScaling
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.tabBarMargin,
    zIndex: 20,
  },
  pointerBoxNone: {
    pointerEvents: 'box-none',
  },

  bar: {
    borderRadius: radii.pill,
    minHeight: layout.tabBarHeight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: 2,
  },
  indicator: {
    minWidth: 56,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  indicatorOn: {
    backgroundColor: colors.accentSoft,
  },
  icon: {
    fontSize: 18,
    color: colors.tabInactive,
  },
  iconOn: {
    color: colors.tabActive,
  },
  label: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '500',
    color: colors.tabInactive,
    textAlign: 'center',
    flexShrink: 1,
  },
  labelOn: {
    color: colors.tabActive,
    fontWeight: '700',
  },
});
