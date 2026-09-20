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
import type { WebflowPage } from '../../domain/models/webflowModels';
import { pageTypeDisplayName } from '../../domain/models/webflowModels';
import { ConfirmationPolicy } from '../../domain/policies/confirmationPolicy';
import { newActionPlan } from '../../domain/actions/mobileflowAction';
import { useReducedMotion } from '../../design-system/useReducedMotion';

export function PageMetadataEditorSheet({
  page,
  visible,
  onClose,
  onOpenPublish,
}: {
  page: WebflowPage | null;
  visible: boolean;
  onClose: () => void;
  onOpenPublish: () => void;
}) {
  const { executePlan, isExecuting, selectedSite } = useApp();
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [didSave, setDidSave] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!page || !visible) return;
    setSeoTitle(page.seoTitle ?? '');
    setSeoDescription(page.seoDescription ?? '');
    setOgTitle(page.openGraphTitle ?? '');
    setOgDescription(page.openGraphDescription ?? '');
    setSlug(page.slug);
    setSaveError(null);
    setDidSave(false);
  }, [page, visible]);

  if (!page) return null;

  const save = async (includeSlug: boolean) => {
    setSaveError(null);
    const plan = newActionPlan({
      prompt: 'Save page metadata',
      descriptors: [
        ConfirmationPolicy.default.descriptor(
          {
            type: 'updatePageMetadata',
            input: {
              pageID: page.id,
              slug: includeSlug ? slug : undefined,
              seoTitle: seoTitle || null,
              seoDescription: seoDescription || null,
              openGraphTitle: ogTitle || null,
              openGraphDescription: ogDescription || null,
            },
          },
          page.siteID,
        ),
      ],
    });
    try {
      const result = await executePlan(plan, {
        hardConfirmAcknowledged: includeSlug,
      });
      if (result.failed > 0) {
        setSaveError(
          result.items.find((i) => i.status === 'failed')?.summary ?? 'Save failed',
        );
        setDidSave(false);
      } else {
        setDidSave(true);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  const onSavePress = () => {
    const slugChanged = page.slugEditable && slug !== page.slug;
    if (slugChanged) {
      Alert.alert(
        'Confirm slug change',
        `URL will change from “${page.slug || '/'}” to “${slug}”. This may break existing links.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Change slug',
            style: 'destructive',
            onPress: () => {
              void save(true);
            },
          },
        ],
      );
      return;
    }
    void save(false);
  };

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Close metadata editor">
            <Text style={styles.link}>Close</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {page.title}
          </Text>
          <View style={{ width: 48 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.meta}>
            {pageTypeDisplayName[page.pageType]}
            {page.locale ? ` · ${page.locale}` : ''}
            {selectedSite ? ` · ${selectedSite.name}` : ''}
          </Text>

          <Text style={styles.label}>SEO Title</Text>
          <TextInput
            style={styles.input}
            value={seoTitle}
            onChangeText={setSeoTitle}
            placeholder="SEO title"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="SEO title"
          />
          {seoTitle.length > 0 ? (
            <Text
              style={[
                styles.charCount,
                seoTitle.length > 60 && styles.charWarn,
              ]}
            >
              {seoTitle.length} characters
            </Text>
          ) : null}

          <Text style={styles.label}>Meta Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={seoDescription}
            onChangeText={setSeoDescription}
            multiline
            placeholder="Meta description"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Meta description"
          />

          <Text style={styles.label}>Open Graph Title</Text>
          <TextInput
            style={styles.input}
            value={ogTitle}
            onChangeText={setOgTitle}
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Open Graph title"
          />

          <Text style={styles.label}>Open Graph Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={ogDescription}
            onChangeText={setOgDescription}
            multiline
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Open Graph description"
          />

          {page.slugEditable ? (
            <>
              <Text style={styles.label}>
                Slug <Text style={styles.highRisk}>High risk</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={slug}
                onChangeText={setSlug}
                autoCapitalize="none"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Page slug"
                accessibilityHint="Changing this value can break existing links"
              />
              <Text style={styles.hint}>
                Changing slugs can break URLs and requires confirmation.
              </Text>
            </>
          ) : (
            <Text style={styles.hint}>Slug locked for this page type.</Text>
          )}

          {saveError ? <Text style={styles.error} accessibilityRole="alert">{saveError}</Text> : null}
          {didSave ? (
            <View style={styles.next}>
              <Text style={styles.hint}>
                Metadata is saved on Webflow. Publish when you want it live.
              </Text>
              <Pressable style={styles.secondary} onPress={onOpenPublish} accessibilityRole="button">
                <Text style={styles.secondaryText}>Publish site…</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            style={[styles.primary, isExecuting && styles.disabled]}
              disabled={isExecuting}
              onPress={onSavePress}
              accessibilityRole="button"
              accessibilityState={{ disabled: isExecuting, busy: isExecuting }}
          >
            {isExecuting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>
                {didSave ? 'Save again' : 'Save Metadata'}
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
  meta: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  highRisk: { color: colors.danger },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 44,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },
  charWarn: { color: colors.warning },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  error: { color: colors.danger, marginTop: spacing.md },
  next: { marginTop: spacing.md },
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
