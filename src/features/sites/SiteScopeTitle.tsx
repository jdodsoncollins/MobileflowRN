import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../shell/AppContext';
import { openSites } from '../../shell/nav';
import { siteTitle } from '../../domain/models/siteScope';
import { connectionIsConnected } from '../../domain/models/webflowModels';
import { SymbolIcon } from '../../design-system/SymbolIcon';
import { colors, typography } from '../../design-system/theme';
import { AccessibilityIDs } from '../../support/accessibilityIDs';

export function SiteScopeTitle() {
  const { selectedSite, connection } = useApp();
  const connected = connectionIsConnected(connection);
  const label = !connected
    ? 'Mobileflow'
    : selectedSite
      ? siteTitle(selectedSite)
      : 'Choose a site';

  return (
    <Pressable
      onPress={() => {
        if (!connected) return;
        openSites();
      }}
      disabled={!connected}
      accessibilityRole="button"
      accessibilityLabel={
        connected ? `Site, ${label}. Opens site picker.` : label
      }
      testID={AccessibilityIDs.siteTitle}
      hitSlop={8}
      style={({ pressed }) => [styles.hit, pressed && connected && styles.pressed]}
    >
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1}>
          {label}
        </Text>
        {connected ? (
          <SymbolIcon
            name="chevron.down"
            size={12}
            color={colors.textSecondary}
            weight="semibold"
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { maxWidth: 220, paddingHorizontal: 4, paddingVertical: 4 },
  pressed: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  title: { ...typography.headline, color: colors.text, fontWeight: '600' },
});
