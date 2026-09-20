import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  evaluatePublishPreflight,
  type PublishTargets,
} from '../../domain/planning/publishPlanning';
import { ConfirmationPolicy } from '../../domain/policies/confirmationPolicy';
import { newActionPlan } from '../../domain/actions/mobileflowAction';

export function PublishSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const {
    selectedSite,
    connection,
    publishRateLimit,
    executePlan,
    isExecuting,
    pages,
    setActiveTab,
  } = useApp();

  const [publishToWebflowSubdomain, setPublishToWebflowSubdomain] =
    useState(true);
  const [selectedDomainIDs, setSelectedDomainIDs] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  // Refresh cooldown countdown while open
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [visible]);

  useEffect(() => {
    setSelectedDomainIDs([]);
  }, [selectedSite?.id]);

  const targets: PublishTargets = useMemo(
    () => ({
      scope: 'site',
      selectedDomainIDs,
      publishToWebflowSubdomain,
      pageID: pages[0]?.id ?? null,
    }),
    [publishToWebflowSubdomain, selectedDomainIDs, pages],
  );

  const cooldownUntil = selectedSite
    ? publishRateLimit.nextAllowed(selectedSite.id)
    : null;
  const preflight = useMemo(() => {
    if (!selectedSite) return null;
    void tick;
    return evaluatePublishPreflight({
      site: selectedSite,
      targets,
      connection,
      cooldownUntil: cooldownUntil?.toISOString() ?? null,
    });
  }, [selectedSite, targets, connection, cooldownUntil, tick]);

  const remaining = selectedSite
    ? publishRateLimit.remainingSeconds(selectedSite.id)
    : null;

  const onPublish = () => {
    if (!selectedSite || !preflight?.canPublish) return;
    setError(null);
    setDoneMsg(null);

    Alert.alert(
      'Confirm publish',
      `Publish ${selectedSite.name} to ${
        publishToWebflowSubdomain ? 'Webflow subdomain' : 'selected targets'
      }? This is a high-risk live action.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const policy = ConfirmationPolicy.default;
              const plan = newActionPlan({
                prompt: 'Publish site',
                descriptors: [
                  policy.descriptor(
                    {
                      type: 'publishSite',
                      input: {
                        siteID: selectedSite.id,
                        customDomainIDs: selectedDomainIDs,
                        publishToWebflowSubdomain,
                      },
                    },
                    selectedSite.id,
                  ),
                ],
              });
              try {
                const result = await executePlan(plan, {
                  hardConfirmAcknowledged: true,
                });
                if (result.failed > 0) {
                  setError(
                    result.items.find((i) => i.status === 'failed')?.summary ??
                      'Publish failed',
                  );
                } else {
                  setDoneMsg('Publish completed. See Activity.');
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            })();
          },
        },
      ],
    );
  };

  if (!visible) return null;
  return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Close publish sheet">
            <Text style={styles.link}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Publish</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {!selectedSite ? (
            <Text style={styles.sub}>Select a connected site first.</Text>
          ) : (
            <>
              <Text style={styles.siteName}>{selectedSite.name}</Text>
              <Text style={styles.sub}>
                Hard confirm required. Rate limit ~1 successful publish / min.
              </Text>

              {remaining != null ? (
                <View style={styles.rateBanner}>
                  <Text style={styles.rateText}>
                    Webflow publish limit (~1/min). Wait {remaining}s before
                    retry.
                  </Text>
                </View>
              ) : null}

              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Webflow subdomain</Text>
                  <Switch
                    value={publishToWebflowSubdomain}
                    onValueChange={setPublishToWebflowSubdomain}
                    accessibilityLabel="Publish to Webflow subdomain"
                    accessibilityRole="switch"
                  />
                </View>
                {selectedSite.customDomains.length > 0 ? (
                  selectedSite.customDomains.map((domain) => {
                    const selected = selectedDomainIDs.includes(domain.id);
                    return (
                      <Pressable
                        key={domain.id}
                        style={styles.domainRow}
                        onPress={() =>
                          setSelectedDomainIDs((current) =>
                            selected
                              ? current.filter((id) => id !== domain.id)
                              : [...current, domain.id],
                          )
                        }
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={`Publish to ${domain.url}`}
                      >
                        <Text style={styles.domainCheck}>{selected ? '✓' : '○'}</Text>
                        <Text style={styles.domainURL}>{domain.url}</Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.hint}>
                    No custom domains loaded — subdomain publish is the default
                    target.
                  </Text>
                )}
              </View>

              <Text style={styles.section}>Preflight</Text>
              <View style={styles.card}>
                {preflight?.checks.map((c) => (
                  <View key={c.name} style={styles.checkRow}>
                    <Text style={c.passed ? styles.pass : styles.fail}>
                      {c.passed ? '✓' : '✗'}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.checkName}>{c.name}</Text>
                      {c.detail ? (
                        <Text style={styles.checkDetail}>{c.detail}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>

              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              {doneMsg ? <Text style={styles.ok} accessibilityLiveRegion="polite">{doneMsg}</Text> : null}

              <Pressable
                style={[
                  styles.primary,
                  (!preflight?.canPublish || isExecuting) && styles.disabled,
                ]}
                disabled={!preflight?.canPublish || isExecuting}
                onPress={onPublish}
                accessibilityRole="button"
                accessibilityHint="Opens a final confirmation before publishing"
                accessibilityState={{ disabled: !preflight?.canPublish || isExecuting, busy: isExecuting }}
              >
                {isExecuting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>Publish site</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.secondary}
                onPress={() => {
                  onClose();
                  setActiveTab('activity');
                }}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryText}>View Activity</Text>
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
  link: { color: colors.accent, fontWeight: '600', width: 48 },
  headerButton: { minWidth: 48, minHeight: 44, justifyContent: 'center' },
  body: { padding: spacing.lg, paddingBottom: 40 },
  siteName: { fontSize: 22, fontWeight: '700', color: colors.text },
  sub: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  rateBanner: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rateText: { color: colors.warning, fontWeight: '600', fontSize: 13 },
  section: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, color: colors.textTertiary, marginTop: spacing.sm },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginTop: spacing.sm,
  },
  domainCheck: { width: 28, color: colors.accent, fontSize: 18 },
  domainURL: { color: colors.text, fontSize: 14, flex: 1 },
  checkRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pass: { color: colors.success, fontWeight: '700', width: 18 },
  fail: { color: colors.danger, fontWeight: '700', width: 18 },
  checkName: { fontSize: 14, fontWeight: '600', color: colors.text },
  checkDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  primary: {
    backgroundColor: colors.fab,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    alignItems: 'center',
    padding: spacing.md,
    marginTop: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, marginBottom: spacing.sm },
  ok: { color: colors.success, marginBottom: spacing.sm, fontWeight: '600' },
});
