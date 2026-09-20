import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useApp } from '../../shell/AppContext';
import { colors, radii, spacing } from '../../design-system/theme';
import { ConfirmationPolicy } from '../../domain/policies/confirmationPolicy';
import { newActionPlan } from '../../domain/actions/mobileflowAction';
import {
  commentPlainText,
  type WebflowCommentThread,
} from '../../domain/models/webflowModels';

export function CommentsInbox() {
  const {
    comments,
    commentReplies,
    loadComments,
    loadCommentReplies,
    selectedSiteID,
    executePlan,
    isExecuting,
    pages,
  } = useApp();
  const [selected, setSelected] = useState<WebflowCommentThread | null>(null);
  const [reply, setReply] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadComments();
  }, [loadComments, selectedSiteID]);

  const openThread = (thread: WebflowCommentThread) => {
    setSelected(thread);
    setReply('');
    setMessage(null);
    void loadCommentReplies(thread.id);
  };

  const pageTitle = (thread: WebflowCommentThread) => {
    const page = pages.find((entry) => entry.id === thread.pageID);
    return page?.title ?? 'Page';
  };

  const sendReply = () => {
    if (!selectedSiteID || !selected || !reply.trim()) return;
    Alert.alert('Post reply', 'This posts to the Designer comment thread.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reply',
        onPress: () => {
          void (async () => {
            const plan = newActionPlan({
              prompt: 'Reply to comment',
              descriptors: [
                ConfirmationPolicy.default.descriptor(
                  {
                    type: 'replyToComment',
                    input: {
                      siteID: selectedSiteID,
                      threadID: selected.id,
                      content: reply.trim(),
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
                setMessage(result.items[0]?.summary ?? 'Reply failed');
              } else {
                setMessage('Reply posted.');
                setReply('');
                await loadCommentReplies(selected.id);
                await loadComments();
              }
            } catch (error) {
              setMessage(error instanceof Error ? error.message : String(error));
            }
          })();
        },
      },
    ]);
  };

  const openThreads = comments.filter((thread) => !thread.isResolved);

  return (
    <View>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
      <Text style={styles.sectionLabel}>Open comments</Text>
      <View style={styles.card}>
        {openThreads.length === 0 ? (
          <Text style={styles.emptyBody}>
            No open Designer comments. Connect with comments:read, or there is
            nothing unresolved on this site.
          </Text>
        ) : (
          openThreads.map((thread, index) => (
            <Pressable
              key={thread.id}
              onPress={() => openThread(thread)}
              accessibilityRole="button"
              accessibilityLabel={`Open comment from ${thread.author.name}`}
              style={[
                styles.row,
                index < openThreads.length - 1 && styles.rowBorder,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>
                  {commentPlainText(thread.content) || 'Comment'}
                </Text>
                <Text style={styles.meta}>
                  {thread.author.name} · {pageTitle(thread)}
                </Text>
              </View>
              <Text style={styles.meta}>
                {selected?.id === thread.id ? 'Open' : 'Inbox'}
              </Text>
            </Pressable>
          ))
        )}
      </View>
      {selected ? (
        <>
          <Text style={styles.sectionLabel}>Thread</Text>
          <View style={styles.card}>
            <Text style={styles.body} selectable>
              {commentPlainText(selected.content)}
            </Text>
            {commentReplies.map((entry) => (
              <View key={entry.id} style={styles.reply}>
                <Text style={styles.meta}>{entry.author.name}</Text>
                <Text style={styles.body} selectable>
                  {commentPlainText(entry.content)}
                </Text>
              </View>
            ))}
            <TextInput
              style={styles.input}
              value={reply}
              onChangeText={setReply}
              placeholder="Reply…"
              placeholderTextColor={colors.textTertiary}
              multiline
              accessibilityLabel="Comment reply"
            />
            <Pressable
              onPress={sendReply}
              disabled={isExecuting || !reply.trim()}
              accessibilityRole="button"
              accessibilityState={{
                disabled: isExecuting || !reply.trim(),
              }}
              style={styles.replyBtn}
            >
              <Text style={styles.replyText}>Post reply</Text>
            </Pressable>
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
    borderCurve: 'continuous',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: spacing.md,
    gap: 8,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text, flex: 1 },
  meta: { fontSize: 13, color: colors.textTertiary },
  body: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  emptyBody: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  msg: { color: colors.textSecondary, marginBottom: spacing.sm, fontSize: 13 },
  reply: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    marginTop: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 72,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
    borderCurve: 'continuous',
  },
  replyBtn: {
    marginTop: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  replyText: { color: colors.accent, fontWeight: '600' },
});
