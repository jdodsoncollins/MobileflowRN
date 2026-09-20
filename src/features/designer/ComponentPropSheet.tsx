import { useState } from 'react';
import {
  ActivityIndicator,
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
import { colors, radii, spacing } from '../../design-system/theme';
import { ConfirmationPolicy } from '../../domain/policies/confirmationPolicy';
import { newActionPlan } from '../../domain/actions/mobileflowAction';
import { designerOperationIsAvailable } from '../../services/mcp/webflowMCPClient';
import { useReducedMotion } from '../../design-system/useReducedMotion';

/** Update a component prop by live IDs only. */
export function ComponentPropSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { executePlan, isExecuting, selectedSiteID, mcpTools } = useApp();
  const [componentID, setComponentID] = useState('');
  const [propName, setPropName] = useState('');
  const [value, setValue] = useState('');
  const [branchID, setBranchID] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const writeOk =
    selectedSiteID != null &&
    designerOperationIsAvailable(mcpTools, 'updateComponentProp');

  const apply = async () => {
    if (!selectedSiteID) {
      setError('Select a site first.');
      return;
    }
    if (!componentID.trim() || !propName.trim()) {
      setError('Component ID and prop name are required.');
      return;
    }
    if (!writeOk) {
      setError(
        'No compatible headless MCP tool for component props. Refresh MCP after connecting Webflow.',
      );
      return;
    }
    setError(null);
    setOk(null);
    const plan = newActionPlan({
      prompt: 'Update component prop',
      descriptors: [
        ConfirmationPolicy.default.descriptor(
          {
            type: 'updateComponentProp',
            input: {
              componentID: componentID.trim(),
              propName: propName.trim(),
              value: value.trim(),
              branchID: branchID.trim() || undefined,
            },
          },
          selectedSiteID,
        ),
      ],
    });
    try {
      const result = await executePlan(plan, { hardConfirmAcknowledged: true });
      if (result.failed > 0) {
        setError(result.items[0]?.summary ?? 'Update failed');
      } else {
        setOk('Component prop update completed.');
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
          <Pressable onPress={onClose} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Close component prop editor">
            <Text style={styles.link}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Component Prop</Text>
          <View style={{ width: 48 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            Live IDs only. Headless MCP 2.0 writes need a selected site and a
            compatible tool schema — Designer Bridge is not required.
          </Text>
          {!writeOk ? (
            <Text style={styles.warn}>
              No verified compatible component prop write tool is available.
            </Text>
          ) : null}
          <Text style={styles.label}>Component ID</Text>
           <TextInput style={styles.input} value={componentID} onChangeText={setComponentID} autoCapitalize="none" placeholderTextColor={colors.textTertiary} accessibilityLabel="Component ID" />
          <Text style={styles.label}>Prop name</Text>
           <TextInput style={styles.input} value={propName} onChangeText={setPropName} autoCapitalize="none" placeholderTextColor={colors.textTertiary} accessibilityLabel="Prop name" />
          <Text style={styles.label}>Branch ID (optional)</Text>
           <TextInput style={styles.input} value={branchID} onChangeText={setBranchID} autoCapitalize="none" placeholderTextColor={colors.textTertiary} accessibilityLabel="Branch ID optional" />
          <Text style={styles.label}>Value</Text>
           <TextInput style={styles.input} value={value} onChangeText={setValue} placeholderTextColor={colors.textTertiary} accessibilityLabel="Prop value" />
           {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
           {ok ? <Text style={styles.ok} accessibilityLiveRegion="polite">{ok}</Text> : null}
           <Pressable style={[styles.primary, (isExecuting || !writeOk) && styles.disabled]} disabled={isExecuting || !writeOk} onPress={() => void apply()} accessibilityRole="button" accessibilityState={{ disabled: isExecuting || !writeOk, busy: isExecuting }}>
            {isExecuting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Apply Prop Update</Text>}
          </Pressable>
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
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  link: { color: colors.accent, fontWeight: '600', width: 48 },
  headerButton: { minWidth: 48, minHeight: 44, justifyContent: 'center' },
  body: { padding: spacing.lg },
  hint: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
  warn: { color: colors.warning, marginBottom: spacing.md, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 44,
  },
  primary: {
    marginTop: spacing.xl,
    backgroundColor: colors.fab,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, marginTop: spacing.md },
  ok: { color: colors.success, marginTop: spacing.md, fontWeight: '600' },
});
