import { StyleSheet, Text, View } from 'react-native';
import type { ActionRisk } from '../domain/actions/mobileflowAction';
import { colors, radii, spacing, typography } from './theme';

const labels: Record<ActionRisk, string> = {
  readOnly: 'Read only',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  destructive: 'Destructive',
};

/** Compact status chip — content layer (not Liquid Glass). */
export function RiskBadge({ risk }: { risk: ActionRisk }) {
  const tone =
    risk === 'high' || risk === 'destructive'
      ? 'high'
      : risk === 'medium'
        ? 'medium'
        : 'low';
  return (
    <View
      style={[styles.badge, styles[`bg_${tone}`]]}
      accessibilityLabel={`Risk ${labels[risk]}`}
    >
      <Text style={[styles.text, styles[`fg_${tone}`]]}>{labels[risk]}</Text>
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
  bg_low: { backgroundColor: colors.successSoft },
  bg_medium: { backgroundColor: colors.warningSoft },
  bg_high: { backgroundColor: colors.dangerSoft },
  fg_low: { color: colors.success },
  fg_medium: { color: colors.warning },
  fg_high: { color: colors.danger },
});
