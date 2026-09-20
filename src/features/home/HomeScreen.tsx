import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useApp } from '../../shell/AppContext';
import { EmptySitePrompt } from '../sites/EmptySitePrompt';
import { CommandFAB } from '../../design-system/CommandFAB';
import { openCommand } from '../../shell/nav';
import {
  colors,
  layout,
  radii,
  spacing,
  typography,
} from '../../design-system/theme';
import {
  ContentCard,
  PrimaryButton,
  SectionLabel,
} from '../../design-system/GlassChrome';
import {
  connectionIsConnected,
  connectionSites,
} from '../../domain/models/webflowModels';
import { AccessibilityIDs } from '../../support/accessibilityIDs';
import { buildSiteHealthSnapshot } from '../../domain/planning/siteHealth';
import { useEffect, useMemo } from 'react';

export function HomeScreen() {
  const {
    connection,
    selectedSite,
    selectedSiteID,
    selectSite,
    seoIssuePages,
    setSeoDraftOpen,
    setPublishOpen,
    setHealthOpen,
    setActiveTab,
    connect,
    pages,
    collections,
    cmsItems,
    assets,
    locales,
    comments,
    analyze,
    loadAnalyze,
    loadComments,
    isBusy,
    isRehydrating,
    lastError,
  } = useApp();

  const connected = connectionIsConnected(connection);
  const sites = connectionSites(connection);
  const connecting = connection.status === 'connecting' || isBusy;

  useEffect(() => {
    if (!selectedSiteID) return;
    void loadAnalyze();
    void loadComments();
  }, [selectedSiteID, loadAnalyze, loadComments]);

  const openComments = comments.filter((thread) => !thread.isResolved).length;

  const healthScore = useMemo(() => {
    if (!selectedSite) return null;
    return buildSiteHealthSnapshot({
      site: selectedSite,
      pages,
      collections,
      cmsItems,
      assets,
    }).score;
  }, [selectedSite, pages, collections, cmsItems, assets]);

  return (
    <View style={styles.root} testID={AccessibilityIDs.tabHome}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!connected ? null : !selectedSite ? (
          <EmptySitePrompt message="Pick a site to inspect pages, CMS, and publish." />
        ) : null}

        {lastError ? (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{lastError}</Text>
          </View>
        ) : null}

        {isRehydrating ? (
          <ContentCard>
            <Text style={styles.bodyMuted}>Restoring session…</Text>
          </ContentCard>
        ) : !connected ? (
          <ContentCard>
            <Text style={styles.cardTitle}>Connect Webflow</Text>
            <Text style={styles.bodyMuted}>
              Authorize your workspace to load live sites, pages, and CMS. The
              live path never invents demo sites.
            </Text>
            <View style={styles.btnGap}>
              <PrimaryButton
                title={connecting ? 'Connecting…' : 'Connect'}
                onPress={() => void connect()}
                disabled={connecting}
                loading={connecting}
                testID={AccessibilityIDs.connectButton}
              />
            </View>
          </ContentCard>
        ) : (
          <>
            <Text style={styles.siteName}>
              {selectedSite?.name ?? 'Select a site'}
            </Text>
            {selectedSite ? (
              <Text style={styles.workspace}>
                Workspace {selectedSite.workspaceID.slice(0, 7)}…
              </Text>
            ) : null}

            <SectionLabel>Sites</SectionLabel>
            <View testID={AccessibilityIDs.siteList}>
            <ContentCard style={styles.listCard}>
              {sites.map((site, index) => {
                const selected = site.id === selectedSiteID;
                return (
                  <Pressable
                    key={site.id}
                    onPress={() => selectSite(site.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.siteRow,
                      index < sites.length - 1 && styles.siteRowBorder,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <View style={styles.siteTextCol}>
                      <Text
                        style={[
                          styles.siteRowName,
                          selected && styles.siteRowNameSelected,
                        ]}
                      >
                        {site.name}
                      </Text>
                      {site.lastPublished ? (
                        <Text style={styles.siteRowMeta}>
                          Last published{' '}
                          {new Date(site.lastPublished).toLocaleDateString()}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? (
                      <View style={styles.checkCircle}>
                        <Text style={styles.check}>✓</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ContentCard>
            </View>

            {locales.length > 0 ? (
              <>
                <SectionLabel>Locales</SectionLabel>
                <ContentCard>
                  <Text style={styles.bodyMuted}>
                    {locales
                      .filter((locale) => locale.enabled)
                      .map((locale) =>
                        locale.isPrimary
                          ? `${locale.tag} (primary)`
                          : locale.tag,
                      )
                      .join(' · ') || 'Primary locale only'}
                  </Text>
                </ContentCard>
              </>
            ) : null}

            <SectionLabel>Analyze</SectionLabel>
            <ContentCard>
              <Text style={styles.attentionTitle}>
                {analyze.status === 'ready'
                  ? analyze.sessions != null
                    ? `${analyze.sessions.toLocaleString()} sessions`
                    : 'Traffic'
                  : 'Analyze'}
              </Text>
              <Text style={styles.bodyMuted}>{analyze.detail}</Text>
              {analyze.topPages.map((page) => (
                <Text key={page.path} style={styles.bodyMuted}>
                  {page.path} · {page.count.toLocaleString()}
                </Text>
              ))}
            </ContentCard>

            <SectionLabel>Comments</SectionLabel>
            <Pressable
              onPress={() => setActiveTab('content')}
              accessibilityRole="button"
              accessibilityLabel="Open comments inbox"
            >
              <ContentCard>
                <Text style={styles.attentionTitle}>
                  {openComments} open
                </Text>
                <Text style={styles.bodyMuted}>
                  Designer comment threads. Reply from Content → Comments.
                </Text>
              </ContentCard>
            </Pressable>

            <SectionLabel>Site Health</SectionLabel>
            <Pressable
              onPress={() => setHealthOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open Site Health audit"
              testID={AccessibilityIDs.siteHealth}
            >
              <ContentCard style={styles.attentionCard}>
                <Text style={styles.attentionTitle}>
                  Health score {healthScore ?? '—'}
                </Text>
                <Text style={styles.bodyMuted}>
                  Audit SEO, CMS, assets, and publish readiness. Select
                  findings and batch-review proposed fixes.
                </Text>
              </ContentCard>
            </Pressable>

            {seoIssuePages.length > 0 ? (
              <>
                <SectionLabel>Needs attention</SectionLabel>
                <Pressable
                  onPress={() => {
                    setActiveTab('content');
                    setSeoDraftOpen(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${seoIssuePages.length} pages missing SEO — review`}
                >
                  <ContentCard style={styles.attentionCard}>
                    <Text style={styles.attentionTitle}>SEO metadata</Text>
                    <Text style={styles.bodyMuted}>
                      {seoIssuePages.length} page
                      {seoIssuePages.length === 1 ? '' : 's'} missing title or
                      description — tap to review
                    </Text>
                  </ContentCard>
                </Pressable>
              </>
            ) : null}

            <View style={styles.btnGap}>
              <PrimaryButton
                title="Publish site…"
                onPress={() => setPublishOpen(true)}
              />
            </View>
          </>
        )}
      </ScrollView>
      {Platform.OS === 'android' ? <CommandFAB onPress={openCommand} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: layout.contentBottomInset,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.largeTitle,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.footnote,
    marginBottom: spacing.xl,
  },
  siteName: {
    ...typography.title2,
  },
  workspace: {
    ...typography.footnote,
    marginBottom: spacing.sm,
  },
  listCard: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  siteRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rowPressed: {
    backgroundColor: colors.pill,
  },
  siteTextCol: { flex: 1, paddingRight: spacing.md },
  siteRowName: {
    ...typography.headline,
    color: colors.accent,
    fontWeight: '500',
  },
  siteRowNameSelected: {
    fontWeight: '700',
  },
  siteRowMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  attentionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.warningSoft,
    backgroundColor: colors.backgroundElevated,
  },
  attentionTitle: {
    ...typography.headline,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    ...typography.title3,
    marginBottom: spacing.sm,
  },
  bodyMuted: {
    ...typography.subhead,
    lineHeight: 22,
  },
  btnGap: { marginTop: spacing.xl },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.footnote,
    color: colors.danger,
    fontWeight: '600',
  },
});
