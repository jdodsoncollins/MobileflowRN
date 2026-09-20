import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { closeModal, navigateTab } from '../../shell/nav';
import { RiskBadge } from '../../design-system/RiskBadge';
import { colors, radii, spacing } from '../../design-system/theme';
import { siteID } from '../../domain/models/ids';
import {
  emptyPlanningContext,
  type PlanningContext,
} from '../../domain/planning/actionPlanner';
import { CommandSuggestions } from '../../domain/planning/commandSuggestions';
import type { ActionPlan } from '../../domain/actions/mobileflowAction';
import { plannerSourceDisplayName } from '../../domain/actions/mobileflowAction';
import {
  HardConfirmRequiredError,
  planNeedsHardConfirm,
} from '../../services/actions/executePlan';
import { connectionIsConnected } from '../../domain/models/webflowModels';
import {
  detectPlannerCapability,
  type PlannerCapability,
} from '../../domain/planning/actionPlanner';

export function CommandSheet() {
  const {
    planner,
    pages,
    collections,
    cmsItems,
    selectedSiteID,
    onDeviceAvailable,
    setPendingPlan,
    pendingPlan,
    executePlan,
    isExecuting,
    connection,
    agentInstructions,
    publishRateLimit,
  } = useApp();
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [plannerCap, setPlannerCap] =
    useState<PlannerCapability>('heuristicOnly');

  useEffect(() => {
    void detectPlannerCapability().then(setPlannerCap);
  }, []);

  const context: PlanningContext = useMemo(() => {
    const sid = selectedSiteID ?? siteID('unselected');
    const cooldown = selectedSiteID
      ? publishRateLimit.nextAllowed(selectedSiteID)
      : null;
    return {
      ...emptyPlanningContext(sid),
      pages,
      collections,
      cmsItems,
      agentInstructions: agentInstructions ?? null,
      publishCooldownUntil: cooldown ? cooldown.toISOString() : null,
    };
  }, [
    selectedSiteID,
    pages,
    collections,
    cmsItems,
    agentInstructions,
    publishRateLimit,
  ]);

  const suggestions = useMemo(
    () => CommandSuggestions.forContext(context),
    [context],
  );

  const activePlan = plan ?? pendingPlan;
  const hardStep = activePlan ? planNeedsHardConfirm(activePlan) : null;
  const connected = connectionIsConnected(connection);

  const runPlan = async (text: string) => {
    setIsPlanning(true);
    setExecuteError(null);
    setLastResult(null);
    try {
      const next = await planner.planWithContext(text, context);
      setPlan(next);
      setPendingPlan(next);
    } finally {
      setIsPlanning(false);
    }
  };

  const runExecute = async (hardConfirmAcknowledged: boolean) => {
    if (!activePlan) return;
    setExecuteError(null);
    setLastResult(null);
    try {
      const result = await executePlan(activePlan, { hardConfirmAcknowledged });
      setLastResult(
        `${result.completed} completed, ${result.failed} failed. ${result.storageWarning ?? 'See Activity.'}`,
      );
      setPlan(null);
      setPendingPlan(null);
      closeModal();
      navigateTab('activity');
    } catch (e) {
      if (e instanceof HardConfirmRequiredError) {
        Alert.alert(
          'Confirm high-risk action',
          e.descriptor.summary ||
            'This action can affect the live site.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Confirm',
              style: 'destructive',
              onPress: () => {
                void runExecute(true);
              },
            },
          ],
        );
        return;
      }
      setExecuteError(e instanceof Error ? e.message : String(e));
    }
  };

  const onApprove = () => {
    if (!connected) {
      setExecuteError('Connect Webflow before executing a plan.');
      return;
    }
    void runExecute(false);
  };

  return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">Command</Text>
          <Pressable
            style={styles.close}
            onPress={() => closeModal()}
            disabled={isExecuting}
            accessibilityRole="button"
            accessibilityLabel="Cancel command"
            accessibilityState={{ disabled: isExecuting }}
          >
            <Text style={styles.closeText}>Cancel</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          Plan → confirm → execute. Writes only run after you approve. Failed
          API calls are recorded as failed — never as completed.
        </Text>
        {plannerCap === 'onDeviceAvailable' && onDeviceAvailable ? (
          <Text style={styles.onDeviceBadge}>
            On-device model available. Plans stay on this device.
          </Text>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="e.g. Draft better title tags for pages missing SEO"
          placeholderTextColor={colors.textTertiary}
          value={prompt}
          onChangeText={setPrompt}
          multiline
          editable={!isExecuting}
          accessibilityLabel="Command"
          accessibilityHint="Describe the Webflow changes you want to plan"
        />

        <Pressable
          style={[styles.primary, (!prompt.trim() || isPlanning || isExecuting) && styles.disabled]}
          onPress={() => void runPlan(prompt)}
          disabled={!prompt.trim() || isPlanning || isExecuting}
          accessibilityRole="button"
          accessibilityLabel="Generate plan"
          accessibilityState={{
            disabled: !prompt.trim() || isPlanning || isExecuting,
            busy: isPlanning,
          }}
        >
          {isPlanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Generate Plan</Text>
          )}
        </Pressable>

        <Text style={styles.section}>Suggestions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {suggestions.map((s) => (
            <Pressable
              key={s}
              style={styles.chip}
              disabled={isExecuting}
              onPress={() => {
                setPrompt(s);
                void runPlan(s);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Use suggestion: ${s}`}
              accessibilityState={{ disabled: isExecuting }}
            >
              <Text style={styles.chipText}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {activePlan ? (
          <ScrollView style={styles.planBox} keyboardShouldPersistTaps="handled">
            <Text style={styles.section}>
              Plan · {plannerSourceDisplayName[activePlan.source]}
            </Text>
            {activePlan.descriptors.map((d) => (
              <View key={d.id} style={styles.planRow}>
                <View style={styles.planHeader}>
                  <Text style={styles.planTitle}>{d.title}</Text>
                  <RiskBadge risk={d.risk} />
                </View>
                <Text style={styles.planSummary}>{d.summary}</Text>
                <Text style={styles.planMeta}>
                  Confirm: {d.confirmation}
                  {d.requiresLiveSession ? ' · Live session' : ''}
                </Text>
              </View>
            ))}

            {hardStep ? (
              <Text style={styles.hardNote}>
                Includes high-risk step “{hardStep.title}” — hard confirm
                required before execute.
              </Text>
            ) : null}

            {executeError ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {executeError}
              </Text>
            ) : null}
            {lastResult ? (
              <Text style={styles.resultText} accessibilityLiveRegion="polite">
                {lastResult}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.approve,
                (isExecuting || !connected) && styles.disabled,
              ]}
              onPress={onApprove}
              disabled={isExecuting || !connected}
              accessibilityRole="button"
              accessibilityState={{
                disabled: isExecuting || !connected,
                busy: isExecuting,
              }}
            >
              {isExecuting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>
                  {connected ? 'Approve & Execute' : 'Connect to execute'}
                </Text>
              )}
            </Pressable>

            <Text style={styles.note}>
              Plans use loaded page IDs only. Activity will show real success or
              failure for each step.
            </Text>
          </ScrollView>
        ) : null}

      </SafeAreaView>
      </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  onDeviceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    minHeight: 88,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  primary: {
    marginTop: spacing.md,
    backgroundColor: colors.fab,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 48,
  },
  approve: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 48,
  },
  disabled: { opacity: 0.5 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  section: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipText: { color: colors.accent, fontWeight: '500', fontSize: 13 },
  planBox: { marginTop: spacing.sm, flex: 1 },
  planRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  planSummary: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
  },
  planMeta: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textTertiary,
  },
  hardNote: {
    fontSize: 13,
    color: colors.warning,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  note: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  resultText: {
    fontSize: 13,
    color: colors.success,
    marginTop: spacing.sm,
  },
  close: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    minHeight: 44,
  },
  closeText: { color: colors.accent, fontWeight: '600', fontSize: 16 },
});
