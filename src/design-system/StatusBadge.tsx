import { StyleSheet, Text, View } from 'react-native';
import type { ActivityStatus } from '../domain/models/webflowModels';
import { colors, radii, spacing, typography } from './theme';

const labels: Record<ActivityStatus, string> = {
  completed: 'Completed',
  failed: 'Failed',
  pending: 'Pending',
  queued: 'Queued',
};

export function StatusBadge({ status }: { status: ActivityStatus }) {
  const tone =
    status === 'failed'
      ? 'failed'
      : status === 'completed'
        ? 'completed'
        : 'pending';
  return (
    <View
      style={[styles.badge, styles[`bg_${tone}`]]}
      accessibilityLabel={`Status ${labels[status]}`}
    >
      <Text style={[styles.text, styles[`fg_${tone}`]]}>{labels[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  },
  bg_failed: { backgroundColor: colors.dangerSoft },
  bg_completed: { backgroundColor: colors.successSoft },
  bg_pending: { backgroundColor: colors.pill },
  fg_failed: { color: colors.danger },
  fg_completed: { color: colors.success },
  fg_pending: { color: colors.textSecondary },
});
