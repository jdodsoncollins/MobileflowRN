import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../shell/AppContext';
import { colors, radii, spacing, typography } from '../../design-system/theme';
import type { PageID } from '../../domain/models/ids';
import {
  buildContentFingerprint,
  isFingerprintStale,
} from '../../domain/planning/staleData';
import { ConfirmationPolicy } from '../../domain/policies/confirmationPolicy';
import { newActionPlan } from '../../domain/actions/mobileflowAction';
import type { ActivityChangeRecord } from '../../domain/models/webflowModels';
import { activityWithChanges } from '../../domain/planning/activityRevert';
import { cryptoRandomId } from '../../domain/actions/mobileflowAction';
import { useReducedMotion } from '../../design-system/useReducedMotion';

export interface BatchProposal {
  pageID: PageID;
  pageTitle: string;
  field: 'seoTitle' | 'seoDescription';
  currentValue: string;
  proposedValue: string;
  accepted: boolean;
}

export function BatchMetadataReviewSheet({
  visible,
  proposals,
  onClose,
}: {
  visible: boolean;
  proposals: BatchProposal[];
  onClose: () => void;
}) {
  const {
    pages,
    selectedSiteID,
    selectedSite,
    executePlan,
    isExecuting,
    loadSiteContent,
    appendActivity,
  } = useApp();
  const [rows, setRows] = useState<BatchProposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [staleWarn, setStaleWarn] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const reduceMotion = useReducedMotion();

  const baselineRef = useRef(buildContentFingerprint(pages));

  useEffect(() => {
    if (visible) {
      baselineRef.current = buildContentFingerprint(pages);
      setRows(proposals.map((p) => ({ ...p, accepted: true })));
      setError(null);
      setStaleWarn(null);
      setDone(false);
    }
  }, [visible, proposals]);

  const accepted = rows.filter((r) => r.accepted);

  const apply = async () => {
    if (!selectedSiteID || !selectedSite) {
      setError('Select a site first.');
      return;
    }
    try {
      setError(null);
      const refreshedPages = await loadSiteContent(selectedSiteID);
      if (isFingerprintStale(baselineRef.current, refreshedPages)) {
        setStaleWarn(
          'Loaded page data changed since these proposals were built. Re-open Site Health and review a fresh batch.',
        );
        return;
      }
      setStaleWarn(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }

    const byPage = new Map<
      string,
      { pageID: PageID; seoTitle?: string; seoDescription?: string; before: ActivityChangeRecord[] }
    >();
    for (const r of accepted) {
      const cur = byPage.get(r.pageID) ?? {
        pageID: r.pageID,
        before: [] as ActivityChangeRecord[],
      };
      if (r.field === 'seoTitle') {
        cur.seoTitle = r.proposedValue;
        cur.before.push({
          resourceType: 'page',
          resourceId: r.pageID,
          field: 'seoTitle',
          before: r.currentValue,
          after: r.proposedValue,
        });
      } else {
        cur.seoDescription = r.proposedValue;
        cur.before.push({
          resourceType: 'page',
          resourceId: r.pageID,
          field: 'seoDescription',
          before: r.currentValue,
          after: r.proposedValue,
        });
      }
      byPage.set(r.pageID, cur);
    }

    const policy = ConfirmationPolicy.default;
    const plan = newActionPlan({
      prompt: 'Batch SEO metadata apply',
      descriptors: [...byPage.values()].map((u) =>
        policy.descriptor(
          {
            type: 'updatePageMetadata',
            input: {
              pageID: u.pageID,
              seoTitle: u.seoTitle,
              seoDescription: u.seoDescription,
            },
          },
          selectedSiteID,
        ),
      ),
    });

    try {
      const result = await executePlan(plan, { hardConfirmAcknowledged: true });
      // Enrich last activities with change records for revert
      const allChanges = [...byPage.values()].flatMap((u) => u.before);
      if (result.completed > 0 && allChanges.length > 0) {
        try {
          await appendActivity(
            activityWithChanges(
            {
              id: cryptoRandomId(),
              timestamp: new Date().toISOString(),
              siteName: selectedSite.name,
              siteID: selectedSiteID,
              title: 'Batch SEO apply',
              summary: `Applied ${result.completed} updates (${result.failed} failed)`,
              source: 'manual',
              risk: 'medium',
              status: result.failed > 0 ? 'failed' : 'completed',
            },
            allChanges,
            ),
          );
        } catch {
          result.storageWarning =
            'The updates succeeded, but the enriched Activity record could not be saved.';
        }
      }
      setDone(true);
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(
          `Batch finished. ${result.completed} completed, ${result.failed} failed.`,
        );
      }
      if (result.failed > 0) {
        setError(`${result.failed} step(s) failed. See Activity.`);
      } else if (result.storageWarning) {
        setError(result.storageWarning);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Modal visible={visible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={done ? 'Done' : 'Cancel batch review'}>
            <Text style={styles.link}>{done ? 'Done' : 'Cancel'}</Text>
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">Batch SEO review</Text>
          <View style={{ width: 56 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            Approve, reject, or edit each proposal. Nothing applies until you
            confirm the batch.
          </Text>
          {staleWarn ? <Text style={styles.warn} accessibilityRole="alert" accessibilityLiveRegion="assertive">{staleWarn}</Text> : null}
          {rows.map((r, i) => (
            <View key={`${r.pageID}-${r.field}`} style={styles.card}>
              <View style={styles.rowHead}>
                <Text style={styles.page}>{r.pageTitle}</Text>
                <Pressable style={styles.toggle} onPress={() => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, accepted: !x.accepted } : x)))} accessibilityRole="checkbox" accessibilityLabel={`${r.pageTitle} ${r.field}`} accessibilityState={{ checked: r.accepted }}>
                  <Text style={styles.accept}>{r.accepted ? 'Accepted' : 'Rejected'}</Text>
                </Pressable>
              </View>
              <Text style={styles.field}>{r.field}</Text>
              <Text style={styles.label}>Current</Text>
              <Text style={styles.value}>{r.currentValue || '(empty)'}</Text>
              <Text style={styles.label}>Proposed</Text>
              <TextInput
                style={styles.input}
                value={r.proposedValue}
                editable={r.accepted}
                accessibilityLabel={`Proposed ${r.field} for ${r.pageTitle}`}
                onChangeText={(t) =>
                  setRows((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, proposedValue: t } : x)),
                  )
                }
              />
            </View>
          ))}
          {error ? <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</Text> : null}
          {done && !error ? (
            <Text style={styles.ok} accessibilityLiveRegion="polite">Batch finished. See Activity for details and revert.</Text>
          ) : null}
          {!done ? (
            <Pressable
              style={[styles.primary, (isExecuting || accepted.length === 0) && styles.disabled]}
              disabled={isExecuting || accepted.length === 0}
              onPress={() => void apply()}
              accessibilityRole="button"
              accessibilityState={{ disabled: isExecuting || accepted.length === 0, busy: isExecuting }}
            >
              {isExecuting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>
                  Apply {accepted.length} change{accepted.length === 1 ? '' : 's'}
                </Text>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
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
  title: { ...typography.headline },
  link: { color: colors.accent, fontWeight: '600', width: 56 },
  headerButton: { minWidth: 56, minHeight: 44, justifyContent: 'center' },
  body: { padding: spacing.lg, paddingBottom: 40 },
  hint: { ...typography.footnote, marginBottom: spacing.md },
  warn: { color: colors.warning, marginBottom: spacing.md, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  page: { ...typography.headline, flex: 1 },
  accept: { color: colors.accent, fontWeight: '700' },
  toggle: { minHeight: 44, minWidth: 88, alignItems: 'flex-end', justifyContent: 'center' },
  field: { ...typography.caption, marginTop: 4, color: colors.accent },
  label: { ...typography.caption, marginTop: spacing.sm },
  value: { ...typography.footnote },
  input: {
    marginTop: 4,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    minHeight: 44,
  },
  primary: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, marginTop: spacing.md },
  ok: { color: colors.success, marginTop: spacing.md, fontWeight: '600' },
});
