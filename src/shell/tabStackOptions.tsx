import { Pressable, View } from 'react-native';
import { colors } from '../design-system/theme';
import { SymbolIcon } from '../design-system/SymbolIcon';
import { openCommand, openSettings } from './nav';
import { useApp } from './AppContext';

function CommandHeaderButton() {
  const { onDeviceAvailable } = useApp();
  return (
    <Pressable
      onPress={openCommand}
      accessibilityRole="button"
      accessibilityLabel="Open command"
      hitSlop={8}
      style={{ paddingHorizontal: 8 }}
    >
      <SymbolIcon
        name={onDeviceAvailable ? 'sparkles' : 'text.badge.plus'}
        size={22}
        color={colors.accent}
      />
    </Pressable>
  );
}

/**
 * Inline titles (not large) so the site switcher stays tappable and
 * iOS UIRefreshControl does not stick on “Refreshing…”.
 */
export const tabStackScreenOptions = {
  headerLargeTitle: false,
  headerTransparent: false,
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { fontSize: 17, fontWeight: '600' as const },
  headerTitleAlign: 'center' as const,
  contentStyle: { backgroundColor: colors.background },
  headerLeft: () => (
    <Pressable
      onPress={openSettings}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={8}
      style={{ paddingHorizontal: 8 }}
    >
      <SymbolIcon name="gearshape" size={22} color={colors.accent} />
    </Pressable>
  ),
  headerRight: () => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <CommandHeaderButton />
    </View>
  ),
} as const;
