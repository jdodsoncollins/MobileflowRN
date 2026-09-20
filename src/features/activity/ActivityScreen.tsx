import { useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useApp } from '../../shell/AppContext';
import { RiskBadge } from '../../design-system/RiskBadge';
import { StatusBadge } from '../../design-system/StatusBadge';
import { colors, radii, spacing } from '../../design-system/theme';
import type { ActivityItem } from '../../domain/models/webflowModels';
import { canRevertActivity } from '../../domain/planning/activityRevert';
import { AccessibilityIDs } from '../../support/accessibilityIDs';

type Filter = 'all' | 'completed' | 'failed' | 'pending' | 'highRisk';

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
  { key: 'pending', label: 'Pending' },
  { key: 'highRisk', label: 'High Risk' },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return `${sec} sec`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr`;
  return `${Math.floor(hr / 24)} d`;
}

export function ActivityScreen() {
  const {
    recentActivity,
    clearActivity,
    revertActivityItem,
    isExecuting,
    selectedSiteID,
  } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const onRevert = (item: ActivityItem) => {
    Alert.alert(
      'Revert changes?',
      `Restore previous field values for “${item.title}”. This runs a new plan through the live API.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert',
          style: 'destructive',
          onPress: () => {
            setRevertingId(item.id);
            void revertActivityItem(item)
              .catch((e) => {
                Alert.alert(
                  'Revert failed',
                  e instanceof Error ? e.message : String(e),
                );
              })
              .finally(() => setRevertingId(null));
          },
        },
      ],
    );
  };

  const onClear = () => {
    Alert.alert(
      'Clear activity?',
      'This permanently deletes all local activity history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            void clearActivity()
              .then(() => {
                AccessibilityInfo.announceForAccessibility('Activity cleared');
                Alert.alert(
                  'Activity cleared',
                  'All local activity history was deleted.',
                );
              })
              .catch((error) =>
                Alert.alert(
                  'Clear failed',
                  error instanceof Error ? error.message : String(error),
                ),
              );
          },
        },
      ],
    );
  };

  const items = useMemo(() => {
    return recentActivity.filter((item) => {
      switch (filter) {
        case 'all':
          return true;
        case 'completed':
          return item.status === 'completed';
        case 'failed':
          return item.status === 'failed';
        case 'pending':
          return item.status === 'pending' || item.status === 'queued';
        case 'highRisk':
          return item.risk === 'high' || item.risk === 'destructive';
      }
    });
  }, [recentActivity, filter]);

  return (
    <View style={styles.root} testID={AccessibilityIDs.tabActivity}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        {recentActivity.length > 0 ? (
          <Pressable onPress={onClear} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear activity">
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filters} testID={AccessibilityIDs.activityFilter}>
        {filters.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterChip, filter === f.key && styles.filterActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.key }}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.key && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>◷</Text>
          <Text style={styles.emptyTitle}>No Activity</Text>
          <Text style={styles.emptyBody}>
            Actions you run will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          testID={AccessibilityIDs.activityList}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ActivityRow
              item={item}
              onRevert={() => onRevert(item)}
              reverting={revertingId === item.id || isExecuting}
              selectedSiteID={selectedSiteID}
            />
          )}
        />
      )}

    </View>
  );
}

function ActivityRow({
  item,
  onRevert,
  reverting,
  selectedSiteID,
}: {
  item: ActivityItem;
  onRevert: () => void;
  reverting: boolean;
  selectedSiteID: import('../../domain/models/ids').SiteID | null;
}) {
  const canRevert = canRevertActivity(item, selectedSiteID);

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <View style={styles.badges}>
          <StatusBadge status={item.status} />
          <RiskBadge risk={item.risk} />
        </View>
      </View>
      <Text style={styles.rowSummary}>{item.summary}</Text>
      {item.changes && item.changes.length > 0 ? (
        <Text style={styles.rowMeta}>
          {item.changes.length} field change
          {item.changes.length === 1 ? '' : 's'}
          {item.revertedAt ? ' · reverted' : ''}
        </Text>
      ) : null}
      <View style={styles.rowFooter}>
        <Text style={styles.rowTime}>{relativeTime(item.timestamp)}</Text>
        {canRevert ? (
          <Pressable
            onPress={onRevert}
            disabled={reverting}
            testID={AccessibilityIDs.activityRevert}
            style={styles.revertBtn}
            accessibilityRole="button"
            accessibilityState={{ disabled: reverting, busy: reverting }}
          >
            {reverting ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.revertText}>Revert</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    position: 'relative',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  clearBtn: {
    position: 'absolute',
    right: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 44,
    justifyContent: 'center',
  },
  clearText: { color: colors.accent, fontWeight: '600' },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: spacing.lg,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.pill,
    minHeight: 44,
    justifyContent: 'center',
  },
  filterActive: { backgroundColor: colors.surface },
  filterText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: colors.text, fontWeight: '600' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyIcon: { fontSize: 40, color: colors.textTertiary, marginBottom: spacing.md },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyBody: { fontSize: 15, color: colors.textSecondary },
  list: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  badges: { flexDirection: 'row', gap: 6 },
  rowSummary: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.accent,
    marginBottom: 4,
    fontWeight: '600',
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTime: { fontSize: 12, color: colors.textTertiary },
  revertBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revertText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
