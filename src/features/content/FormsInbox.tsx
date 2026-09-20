import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../shell/AppContext';
import { colors, radii, spacing } from '../../design-system/theme';
import { ConfirmationPolicy } from '../../domain/policies/confirmationPolicy';
import { newActionPlan } from '../../domain/actions/mobileflowAction';
import type { WebflowForm } from '../../domain/models/webflowModels';

export function FormsInbox() {
  const {
    forms,
    formSubmissions,
    loadForms,
    loadFormSubmissions,
    selectedSiteID,
    executePlan,
    isExecuting,
  } = useApp();
  const [selectedForm, setSelectedForm] = useState<WebflowForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadForms();
  }, [loadForms, selectedSiteID]);

  const openForm = (form: WebflowForm) => {
    setSelectedForm(form);
    setMessage(null);
    void loadFormSubmissions(form.id);
  };

  const removeSubmission = (submissionID: string) => {
    if (!selectedSiteID || !selectedForm) return;
    Alert.alert(
      'Delete submission',
      'This permanently removes the submission from Webflow.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const plan = newActionPlan({
                prompt: 'Delete form submission',
                descriptors: [
                  ConfirmationPolicy.default.descriptor(
                    {
                      type: 'deleteFormSubmission',
                      input: {
                        formID: selectedForm.id,
                        submissionID,
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
                  setMessage(result.items[0]?.summary ?? 'Delete failed');
                } else {
                  setMessage('Submission deleted.');
                  await loadFormSubmissions(selectedForm.id);
                }
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : String(error),
                );
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <View>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
      <Text style={styles.sectionLabel}>Forms</Text>
      <View style={styles.card}>
        {forms.length === 0 ? (
          <Text style={styles.emptyBody}>
            No forms loaded. Connect Webflow and grant forms:read, then refresh.
          </Text>
        ) : (
          forms.map((form, index) => (
            <Pressable
              key={form.id}
              onPress={() => openForm(form)}
              accessibilityRole="button"
              accessibilityLabel={`Open submissions for ${form.displayName}`}
              style={[
                styles.row,
                index < forms.length - 1 && styles.rowBorder,
              ]}
            >
              <Text style={styles.title}>{form.displayName}</Text>
              <Text style={styles.meta}>
                {selectedForm?.id === form.id ? 'Open' : 'Inbox'}
              </Text>
            </Pressable>
          ))
        )}
      </View>
      {selectedForm ? (
        <>
          <Text style={styles.sectionLabel}>
            Submissions · {selectedForm.displayName}
          </Text>
          <View style={styles.card}>
            {formSubmissions.length === 0 ? (
              <Text style={styles.emptyBody}>No submissions yet.</Text>
            ) : (
              formSubmissions.map((submission, index) => {
                const preview = Object.entries(submission.data)
                  .slice(0, 3)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(' · ');
                return (
                  <View
                    key={submission.id}
                    style={[
                      styles.submission,
                      index < formSubmissions.length - 1 && styles.rowBorder,
                    ]}
                  >
                    <Text style={styles.meta} selectable>
                      {new Date(submission.submittedAt).toLocaleString()}
                    </Text>
                    <Text style={styles.body} selectable>
                      {preview || submission.id}
                    </Text>
                    <Pressable
                      onPress={() => removeSubmission(submission.id)}
                      disabled={isExecuting}
                      accessibilityRole="button"
                      accessibilityLabel="Delete submission"
                      style={styles.deleteBtn}
                    >
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text, flex: 1 },
  meta: { fontSize: 13, color: colors.textTertiary },
  body: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },
  emptyBody: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  msg: { color: colors.textSecondary, marginBottom: spacing.sm, fontSize: 13 },
  submission: { paddingVertical: spacing.md },
  deleteBtn: { marginTop: spacing.sm, minHeight: 44, justifyContent: 'center' },
  deleteText: { color: colors.danger, fontWeight: '600' },
});
