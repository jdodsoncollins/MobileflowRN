import { useEffect, useState } from 'react';
import {
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
import { colors, radii, spacing } from '../../design-system/theme';
import { connectionIsConnected } from '../../domain/models/webflowModels';
import {
  detectPlannerCapability,
  getOnDeviceCapabilityInfo,
  type OnDeviceCapabilityInfo,
  type PlannerCapability,
} from '../../domain/planning/actionPlanner';
import { bundledOAuthConfig } from '../../services/auth';
import { useReducedMotion } from '../../design-system/useReducedMotion';

export function SettingsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const {
    connection,
    disconnect,
    connect,
    isBusy,
    lastError,
    selectedSite,
    agentInstructions,
    saveAgentInstructions,
  } = useApp();
  const connected = connectionIsConnected(connection);
  const [plannerCap, setPlannerCap] =
    useState<PlannerCapability>('heuristicOnly');
  const [aiInfo, setAiInfo] = useState<OnDeviceCapabilityInfo | null>(null);
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [instructionsSaved, setInstructionsSaved] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!visible) return;
    void detectPlannerCapability().then(setPlannerCap);
    void getOnDeviceCapabilityInfo().then(setAiInfo);
    setInstructionsDraft(agentInstructions ?? '');
    setInstructionsSaved(false);
  }, [visible, agentInstructions]);

  if (!visible) return null;
  return (
      <KeyboardAvoidingView
        style={[styles.root, { flex: 1 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.title}>Settings</Text>
          <Pressable
            onPress={onClose}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.link}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>Webflow</Text>
          <View style={styles.card}>
            <Text style={styles.rowLabel}>
              Status: {connected ? 'Connected' : 'Disconnected'}
            </Text>
            <Text style={styles.hint}>
              OAuth uses the public client ID and token proxy from your env
              file. The client secret never ships in the app.
            </Text>
            {bundledOAuthConfig.tokenExchangeURL ? (
              <Text style={styles.mono}>
                Proxy: {bundledOAuthConfig.tokenExchangeURL}
              </Text>
            ) : (
              <Text style={styles.hint}>
                Token proxy is not configured. Copy `.env.example` to `.env`
                and set EXPO_PUBLIC_TOKEN_PROXY_URL.
              </Text>
            )}
            {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
            {connected ? (
              <Pressable
                style={styles.dangerBtn}
                disabled={isBusy}
                onPress={() => {
                  void disconnect();
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: isBusy, busy: isBusy }}
              >
                <Text style={styles.dangerText}>Disconnect</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.primary}
                disabled={isBusy}
                onPress={() => {
                  void connect();
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: isBusy, busy: isBusy }}
              >
                <Text style={styles.primaryText}>Connect Webflow</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.section}>Site agent instructions</Text>
          <View style={styles.card}>
            <Text style={styles.rowLabel}>
              {selectedSite
                ? selectedSite.name
                : 'Select a site to edit instructions'}
            </Text>
            <Text style={styles.hint}>
              Device-local guidance for the planner (tone, brand terms, SEO
              rules). Not stored in Webflow.
            </Text>
            <TextInput
              style={styles.input}
              multiline
              editable={!!selectedSite}
              placeholder="e.g. Prefer short titles; include brand name; no invented product claims"
              placeholderTextColor={colors.textTertiary}
              value={instructionsDraft}
              onChangeText={(t) => {
                setInstructionsDraft(t);
                setInstructionsSaved(false);
              }}
              accessibilityLabel="Site agent instructions"
              accessibilityHint="Stores planner guidance on this device"
            />
            <Pressable
              style={[styles.primary, !selectedSite && styles.disabled]}
              disabled={!selectedSite}
              onPress={() => {
                void saveAgentInstructions(instructionsDraft).then(() =>
                  setInstructionsSaved(true),
                );
              }}
              accessibilityRole="button"
              accessibilityState={{ disabled: !selectedSite }}
            >
              <Text style={styles.primaryText}>
                {instructionsSaved ? 'Saved' : 'Save instructions'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.section}>Command planner</Text>
          <View style={styles.card}>
            {plannerCap === 'onDeviceAvailable' ? (
              <>
                <Text style={styles.rowLabel}>
                  On-device model available
                  {aiInfo?.modelLabel ? ` · ${aiInfo.modelLabel}` : ''}
                </Text>
                {aiInfo?.tier && aiInfo.tier !== 'none' ? (
                  <Text style={styles.hint}>
                    Tier: {aiInfo.tier}
                    {aiInfo.maxContextTokens > 0
                      ? ` · ~${aiInfo.maxContextTokens} context tokens`
                      : ''}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.rowLabel}>
                Keyword planner only (on-device model hidden on this device)
              </Text>
            )}
            <Text style={styles.hint}>
              {aiInfo?.detail ??
                'iOS: Apple Intelligence when supported. Android: Gemini Nano via AICore when supported (higher tier on more capable devices). Unsupported devices keep heuristic planning only.'}
            </Text>
          </View>

          <Text style={styles.section}>Setup</Text>
          <View style={styles.card}>
            <Text style={styles.hint}>
              1. Copy `.env.example` to `.env` and set your Webflow client ID,
              redirect URI, and token proxy URL{'\n'}
              2. Create a Webflow app with the Mobileflow scopes{'\n'}
              3. Redirect URI must match the registered callback{'\n'}
              4. Deploy the token exchange proxy with the client secret{'\n'}
              5. Connect here — authorized sites load from the live Data API only
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
      </KeyboardAvoidingView>
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
  headerButton: {
    minWidth: 48,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerSpacer: { width: 48 },
  link: { color: colors.accent, fontWeight: '600', width: 48 },
  body: { padding: spacing.lg, paddingBottom: 40 },
  section: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  mono: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    fontFamily: 'monospace',
  },
  error: { color: colors.danger, marginTop: spacing.sm },
  primary: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  dangerBtn: {
    marginTop: spacing.lg,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    minHeight: 48,
    justifyContent: 'center',
  },
  dangerText: { color: colors.danger, fontWeight: '700' },
  input: {
    marginTop: spacing.md,
    minHeight: 96,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  disabled: { opacity: 0.5 },
});
