import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useApp } from '../../shell/AppContext';
import {
  colors,
  layout,
  radii,
  spacing,
  typography,
} from '../../design-system/theme';
import { ContentCard, PrimaryButton, SectionLabel } from '../../design-system/GlassChrome';
import {
  buildSiteHealthSnapshot,
  type HealthFinding,
  type HealthSeverity,
} from '../../domain/planning/siteHealth';

export function SiteHealthPanel({
  onOpenBatch,
}: {
  onOpenBatch: (findingIds: string[]) => void;
}) {
  const { selectedSite, pages, collections, cmsItems, assets, loadAssets } =
    useApp();
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadAssets();
  }, [loadAssets, selectedSite?.id]);

  const snapshot = useMemo(() => {
    if (!selectedSite) return null;
    return buildSiteHealthSnapshot({
      site: selectedSite,
      pages,
      collections,
      cmsItems,
      assets,
    });
  }, [selectedSite, pages, collections, cmsItems, assets]);

  if (!selectedSite || !snapshot) {
    return (
      <ContentCard>
        <Text style={styles.muted}>Select a connected site to run Site Health.</Text>
      </ContentCard>
    );
  }

  const toggle = (id: string) =>
    setSelected((s) => ({ ...s, [id]: !s[id] }));

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const batchable = snapshot.findings.filter(
    (f) =>
      selected[f.id] &&
      (f.fixKind === 'seoTitle' || f.fixKind === 'seoDescription') &&
      f.proposedValue,
  );

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Site Health</Text>
      <Text style={styles.subtitle}>{snapshot.siteName}</Text>

      <ContentCard style={styles.scoreCard}>
        <Text style={styles.score}>{snapshot.score}</Text>
        <Text style={styles.muted}>Health score (0–100)</Text>
        <Text style={styles.counts}>
          {snapshot.counts.high} high · {snapshot.counts.medium} medium ·{' '}
          {snapshot.counts.low} low · {snapshot.counts.info} info
        </Text>
        <Text style={styles.meta}>
          Based on {snapshot.counts.pages} pages · {snapshot.counts.collections}{' '}
          collections · {snapshot.counts.cmsItems} CMS items ·{' '}
          {snapshot.counts.assets} assets
        </Text>
      </ContentCard>

      <SectionLabel>Findings</SectionLabel>
      {snapshot.findings.length === 0 ? (
        <ContentCard>
          <Text style={styles.muted}>No issues found in loaded data.</Text>
        </ContentCard>
      ) : (
        snapshot.findings.map((f) => (
          <FindingRow
            key={f.id}
            finding={f}
            checked={!!selected[f.id]}
            onToggle={() => toggle(f.id)}
          />
        ))
      )}

      {batchable.length > 0 ? (
        <View style={styles.footer}>
          <PrimaryButton
            title={`Review ${batchable.length} SEO fixes…`}
            onPress={() => onOpenBatch(batchable.map((f) => f.id))}
          />
        </View>
      ) : selectedIds.length > 0 ? (
        <Text style={styles.hint}>
          Selected findings are not batch-SEO fixes (or lack proposals). SEO
          title/description issues can be batch-reviewed.
        </Text>
      ) : null}
    </ScrollView>
  );
}

function FindingRow({
  finding,
  checked,
  onToggle,
}: {
  finding: HealthFinding;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.finding}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${finding.severity} severity: ${finding.title}`}
      accessibilityHint={finding.suggestedFix}
    >
      <View style={styles.findingHead}>
        <View style={[styles.sev, sevStyle(finding.severity)]}>
          <Text style={styles.sevText}>{finding.severity}</Text>
        </View>
        <Text style={styles.findingTitle}>{finding.title}</Text>
        <Text style={styles.check}>{checked ? '☑' : '☐'}</Text>
      </View>
      <Text style={styles.evidence}>{finding.evidence}</Text>
      <Text style={styles.fix}>Fix: {finding.suggestedFix}</Text>
      {finding.proposedValue ? (
        <Text style={styles.proposal} numberOfLines={2}>
          Proposed: {finding.proposedValue}
        </Text>
      ) : null}
    </Pressable>
  );
}

function sevStyle(s: HealthSeverity) {
  switch (s) {
    case 'high':
      return { backgroundColor: colors.dangerSoft };
    case 'medium':
      return { backgroundColor: colors.warningSoft };
    case 'low':
      return { backgroundColor: colors.accentSoft };
    default:
      return { backgroundColor: colors.pill };
  }
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: layout.contentBottomInset },
  title: { ...typography.title2 },
  subtitle: { ...typography.footnote, marginBottom: spacing.lg },
  scoreCard: { alignItems: 'flex-start', marginBottom: spacing.md },
  score: { fontSize: 48, fontWeight: '700', color: colors.accent },
  muted: { ...typography.subhead },
  counts: { ...typography.footnote, marginTop: spacing.sm, fontWeight: '600' },
  meta: { ...typography.caption, marginTop: spacing.xs },
  finding: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    minHeight: 44,
  },
  findingHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sev: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  sevText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  findingTitle: { ...typography.headline, flex: 1 },
  check: { fontSize: 18, color: colors.accent },
  evidence: { ...typography.footnote, marginTop: spacing.sm },
  fix: { ...typography.caption, marginTop: 4, color: colors.accent },
  proposal: { ...typography.caption, marginTop: 4, fontStyle: 'italic' },
  footer: { marginTop: spacing.lg },
  hint: { ...typography.footnote, marginTop: spacing.md },
});
