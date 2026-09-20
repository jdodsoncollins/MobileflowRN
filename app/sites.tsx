import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SitePickerSheet } from '../src/features/sites/SitePickerSheet';
import { colors, spacing, typography } from '../src/design-system/theme';

export default function SitesRoute() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundElevated }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xxl,
          paddingBottom: spacing.sm,
        }}
      >
        <Text style={typography.headline}>Sites</Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close site picker"
          hitSlop={12}
        >
          <Text style={{ ...typography.headline, color: colors.accent }}>Done</Text>
        </Pressable>
      </View>
      <SitePickerSheet />
    </View>
  );
}
