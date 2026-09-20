import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../shell/AppContext';
import { colors, spacing, typography } from '../../design-system/theme';
import {
  buildSiteHealthSnapshot,
  findingsToMetadataProposals,
} from '../../domain/planning/siteHealth';
import { SiteHealthPanel } from './SiteHealthScreen';
import {
  BatchMetadataReviewSheet,
  type BatchProposal,
} from './BatchMetadataReviewSheet';
import { AccessibilityIDs } from '../../support/accessibilityIDs';
import { SafeAreaView } from 'react-native-safe-area-context';

export function SiteHealthSheet() {
  const {
    setHealthOpen,
    selectedSite,
    pages,
    collections,
    cmsItems,
  } = useApp();
  const [batchOpen, setBatchOpen] = useState(false);
  const [proposals, setProposals] = useState<BatchProposal[]>([]);

  const snapshot = useMemo(() => {
    if (!selectedSite) return null;
    return buildSiteHealthSnapshot({
      site: selectedSite,
      pages,
      collections,
      cmsItems,
    });
  }, [selectedSite, pages, collections, cmsItems]);

  const openBatch = (findingIds: string[]) => {
    if (!snapshot) return;
    const findings = snapshot.findings.filter((f) => findingIds.includes(f.id));
    const raw = findingsToMetadataProposals(findings);
    const pageById = new Map(pages.map((p) => [p.id, p]));
    setProposals(
      raw.map((r) => ({
        pageID: r.pageID,
        pageTitle: pageById.get(r.pageID)?.title ?? r.pageID,
        field: r.field,
        currentValue: r.currentValue,
        proposedValue: r.proposedValue,
        accepted: true,
      })),
    );
    setBatchOpen(true);
  };

  return (
    <>
        <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID={AccessibilityIDs.siteHealth}>
          <View style={styles.header}>
            <Pressable onPress={() => setHealthOpen(false)} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Done">
              <Text style={styles.link}>Done</Text>
            </Pressable>
            <Text style={styles.title}>Site Health</Text>
            <View style={{ width: 48 }} />
          </View>
          <SiteHealthPanel onOpenBatch={openBatch} />
        </SafeAreaView>
      <BatchMetadataReviewSheet
        visible={batchOpen}
        proposals={proposals}
        onClose={() => setBatchOpen(false)}
      />
    </>
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
  title: { ...typography.headline },
  link: { color: colors.accent, fontWeight: '600', width: 48 },
  headerButton: { minWidth: 48, minHeight: 44, justifyContent: 'center' },
});
