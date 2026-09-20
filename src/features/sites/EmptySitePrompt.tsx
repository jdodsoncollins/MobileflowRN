import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../design-system/GlassChrome';
import { colors, spacing, typography } from '../../design-system/theme';
import { openSites } from '../../shell/nav';

export function EmptySitePrompt({ message }: { message: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.body}>{message}</Text>
      <PrimaryButton title="Choose a site" onPress={openSites} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  body: { ...typography.subhead, color: colors.textSecondary },
});
