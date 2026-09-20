import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import type { WebflowCMSItem } from '../../domain/models/webflowModels';
import { ConfirmationPolicy } from '../../domain/policies/confirmationPolicy';
import { newActionPlan } from '../../domain/actions/mobileflowAction';
import { useReducedMotion } from '../../design-system/useReducedMotion';

export function CMSItemEditorSheet({
  item,
  visible,
  onClose,
  onPublished,
}: {
  item: WebflowCMSItem | null;
  visible: boolean;
  onClose: () => void;
  onPublished?: () => void;
}) {
  const { executePlan, isExecuting, selectedSiteID } = useApp();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [didSave, setDidSave] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!item || !visible) return;
    setName(item.name);
    setSlug(item.slug);
    const fields: Record<string, string> = {};
    for (const f of item.missingFields) fields[f] = '';
    setExtra(fields);
    setError(null);
    setDidSave(false);
  }, [item, visible]);

  if (!item) return null;

  const save = async () => {
    if (!selectedSiteID) {
      setError('Select a site first.');
      return;
    }
    setError(null);
    const fields: Record<string, string> = {
      name,
      slug,
      ...extra,
    };
    const plan = newActionPlan({
      prompt: 'Save CMS draft',
      descriptors: [
        ConfirmationPolicy.default.descriptor(
          {
            type: 'updateCMSItem',
            input: {
              collectionID: item.collectionID,
              itemID: item.id,
              fields,
            },
          },
          selectedSiteID,
        ),
      ],
    });
    try {
      const result = await executePlan(plan, { hardConfirmAcknowledged: true });
      if (result.failed > 0) {
        setError(
          result.items.find((i) => i.status === 'failed')?.summary ?? 'Save failed',
        );
        setDidSave(false);
      } else {
        setDidSave(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const publishItem = () => {
    if (!selectedSiteID) {
      setError('Select a site first.');
      return;
    }
    Alert.alert(
      'Publish CMS item',
      `Publish “${item.name}” to the live collection? This does not publish the whole site.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setError(null);
              const plan = newActionPlan({
                prompt: `Publish CMS item ${item.name}`,
                descriptors: [
                  ConfirmationPolicy.default.descriptor(
                    {
                      type: 'publishCMSItems',
                      input: {
                        collectionID: item.collectionID,
                        itemIDs: [item.id],
                      },
                    },
                    selectedSiteID,
                  ),
                ],
              });
              try {
                const result = await executePlan(plan, {
                  hardConfirmAcknowledged: true,
                });
                if (result.failed > 0) {
                  setError(
                    result.items.find((entry) => entry.status === 'failed')
                      ?.summary ?? 'Publish failed',
                  );
                } else {
                  onPublished?.();
                  onClose();
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

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Close CMS item editor">
            <Text style={styles.link}>Close</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={{ width: 48 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.badges}>
            {item.isDraft ? (
              <Text style={styles.badge}>Draft</Text>
            ) : null}
            {item.isPublished ? (
              <Text style={[styles.badge, styles.live]}>Live</Text>
            ) : null}
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Item name"
          />
          <Text style={styles.label}>Slug</Text>
          <TextInput
            style={styles.input}
            value={slug}
            onChangeText={setSlug}
            autoCapitalize="none"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Item slug"
          />

          {Object.keys(extra).map((key) => (
            <View key={key}>
              <Text style={styles.label}>{key}</Text>
              <TextInput
                style={styles.input}
                value={extra[key] ?? ''}
                onChangeText={(v) => setExtra((prev) => ({ ...prev, [key]: v }))}
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel={key}
              />
            </View>
          ))}

          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          {didSave ? (
            <View style={styles.next}>
              <Text style={styles.hint}>
                Draft is saved on Webflow. Publish this item when you want it
                live. Site-wide publish is a separate action.
              </Text>
              <Pressable
                style={styles.secondary}
                onPress={publishItem}
                disabled={isExecuting}
                accessibilityRole="button"
                accessibilityState={{ disabled: isExecuting }}
              >
                <Text style={styles.secondaryText}>Publish item…</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            style={[styles.primary, isExecuting && styles.disabled]}
            disabled={isExecuting}
            onPress={() => void save()}
            accessibilityRole="button"
            accessibilityState={{ disabled: isExecuting, busy: isExecuting }}
          >
            {isExecuting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>
                {didSave ? 'Save again' : 'Save Draft'}
              </Text>
            )}
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
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  link: { color: colors.accent, fontWeight: '600', width: 48 },
  headerButton: { minWidth: 48, minHeight: 44, justifyContent: 'center' },
  body: { padding: spacing.lg, paddingBottom: 40 },
  badges: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    backgroundColor: colors.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  live: { color: colors.success, backgroundColor: colors.successSoft },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 44,
  },
  error: { color: colors.danger, marginTop: spacing.md },
  next: { marginTop: spacing.md },
  hint: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  primary: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    marginTop: spacing.sm,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryText: { color: colors.fab, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
