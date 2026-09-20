import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../shell/AppContext';
import { colors, radii, spacing } from '../../design-system/theme';
import {
  metadataFieldDisplayName,
  type PageMetadataDiff,
} from '../../domain/models/contentModels';
import {
  buildMissingSEODiffs,
  groupAcceptedMetadataUpdates,
} from '../../domain/planning/seoDrafts';
import { ConfirmationPolicy } from '../../domain/policies/confirmationPolicy';
import { newActionPlan } from '../../domain/actions/mobileflowAction';
import { siteID } from '../../domain/models/ids';
import { useReducedMotion } from '../../design-system/useReducedMotion';

export function SEODraftReviewSheet({
  visible,
  onClose,
  onOpenPublish,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenPublish: () => void;
}) {
  const { pages, selectedSiteID, executePlan, isExecuting, setActiveTab } =
    useApp();
  const [diffs, setDiffs] = useState<PageMetadataDiff[]>([]);
  const [didApply, setDidApply] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  // Reset when sheet opens so drafts match currently loaded pages
  useEffect(() => {
    if (!visible) return;
    setDiffs(buildMissingSEODiffs(pages));
    setDidApply(false);
    setAppliedCount(0);
    setFailedCount(0);
    setError(null);
  }, [visible, pages]);

  const acceptedCount = diffs.filter((d) => d.isAccepted).length;

  const toggle = (index: number) => {
    setDiffs((prev) =>
      prev.map((d, i) =>
        i === index ? { ...d, isAccepted: !d.isAccepted } : d,
      ),
    );
  };

  const apply = async () => {
    const sid = selectedSiteID ?? siteID('unselected');
    const updates = groupAcceptedMetadataUpdates(diffs);
    if (updates.length === 0) {
      setError('Accept at least one metadata change.');
      return;
    }
    setError(null);
    const policy = ConfirmationPolicy.default;
    const plan = newActionPlan({
      prompt: 'Apply SEO metadata drafts',
      descriptors: updates.map((u) =>
        policy.descriptor(
          {
            type: 'updatePageMetadata',
            input: {
              pageID: u.pageID,
              seoTitle: u.seoTitle,
              seoDescription: u.seoDescription,
            },
          },
          sid,
        ),
      ),
    });
    try {
      const result = await executePlan(plan, { hardConfirmAcknowledged: true });
      setAppliedCount(result.completed);
      setFailedCount(result.failed);
      setDidApply(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!visible) return null;
  return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={didApply ? 'Done' : 'Cancel SEO review'}>
            <Text style={styles.link}>{didApply ? 'Done' : 'Cancel'}</Text>
          </Pressable>
          <Text style={styles.title}>
            {didApply ? 'SEO Applied' : 'SEO Draft Review'}
          </Text>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {didApply ? (
            <View style={styles.card}>
              <Text style={styles.headline}>
                {appliedCount > 0
                  ? `Applied ${appliedCount} metadata change${appliedCount === 1 ? '' : 's'}`
                  : 'No changes applied'}
              </Text>
              {failedCount > 0 ? (
                <Text style={styles.warn}>
                  {failedCount} failed. Check Activity for details.
                </Text>
              ) : null}
              <Text style={styles.sub}>
                Metadata is saved on Webflow. Publish when you want it live.
              </Text>
              {appliedCount > 0 ? (
                <Pressable
                  style={styles.primary}
                  accessibilityRole="button"
                  onPress={() => {
                    onClose();
                    onOpenPublish();
                  }}
                >
                  <Text style={styles.primaryText}>Publish site…</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.secondary}
                  accessibilityRole="button"
                  onPress={() => {
                    onClose();
                    setActiveTab('activity');
                  }}
                >
                  <Text style={styles.secondaryText}>View Activity</Text>
                </Pressable>
              )}
            </View>
          ) : diffs.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.sub}>
                No pages missing SEO title or description in the loaded set.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.hint}>
                Review drafted metadata. Slug changes are excluded from batch
                drafts. {acceptedCount} accepted.
              </Text>
              {diffs.map((diff, index) => (
                <View key={`${diff.pageID}-${diff.field}`} style={styles.card}>
                  <Text style={styles.pageTitle}>{diff.pageTitle}</Text>
                  <Text style={styles.field}>
                    {metadataFieldDisplayName[diff.field]}
                  </Text>
                  <Text style={styles.label}>Current</Text>
                  <Text style={styles.value}>
                    {diff.currentValue || '(empty)'}
                  </Text>
                  <Text style={styles.label}>Proposed</Text>
                  <Text style={styles.value}>{diff.proposedValue}</Text>
                  <View style={styles.row}>
                    <Text style={styles.acceptLabel}>Accept</Text>
                    <Switch
                      value={diff.isAccepted}
                      onValueChange={() => toggle(index)}
                      accessibilityLabel={`Accept ${metadataFieldDisplayName[diff.field]} for ${diff.pageTitle}`}
                      accessibilityRole="switch"
                    />
                  </View>
                </View>
              ))}
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              <Pressable
                style={[styles.primary, isExecuting && styles.disabled]}
                onPress={() => void apply()}
                disabled={isExecuting || acceptedCount === 0}
                accessibilityRole="button"
                accessibilityState={{ disabled: isExecuting || acceptedCount === 0, busy: isExecuting }}
              >
                {isExecuting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>
                    Apply {acceptedCount} change{acceptedCount === 1 ? '' : 's'}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  link: { color: colors.accent, fontWeight: '600', width: 56 },
  headerButton: { minWidth: 56, minHeight: 44, justifyContent: 'center' },
  body: { padding: spacing.lg, paddingBottom: 40 },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  pageTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  field: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    marginTop: 6,
  },
  value: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  acceptLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  headline: { fontSize: 17, fontWeight: '700', color: colors.text },
  sub: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  warn: { fontSize: 13, color: colors.warning, marginTop: spacing.sm },
  error: { color: colors.danger, marginBottom: spacing.sm },
});
