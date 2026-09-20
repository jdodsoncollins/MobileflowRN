import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../shell/AppContext';
import { colors, radii, spacing } from '../../design-system/theme';
import { liveSessionIsConnected } from '../../domain/models/webflowModels';
import { designerOperationIsAvailable } from '../../services/mcp/webflowMCPClient';
import { AccessibilityIDs } from '../../support/accessibilityIDs';
import {
  detectPlannerCapability,
  type PlannerCapability,
} from '../../domain/planning/actionPlanner';
import { VariableUpdateSheet } from './VariableUpdateSheet';
import { ComponentPropSheet } from './ComponentPropSheet';

export function AdvancedScreen() {
  const {
    liveSessionStatus,
    mcpTools,
    refreshMCP,
    connection,
    selectedSiteID,
    designerContext,
  } = useApp();
  const liveCanvas = liveSessionIsConnected(liveSessionStatus);
  const mcpReady = mcpTools.length > 0;
  const siteReady = selectedSiteID != null;
  const variableWriteAvailable =
    siteReady && designerOperationIsAvailable(mcpTools, 'updateVariable');
  const componentWriteAvailable =
    siteReady && designerOperationIsAvailable(mcpTools, 'updateComponentProp');
  const [plannerCap, setPlannerCap] =
    useState<PlannerCapability>('heuristicOnly');
  const [varOpen, setVarOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);

  useEffect(() => {
    if (connection.status === 'connected') {
      void refreshMCP();
    }
  }, [connection.status, refreshMCP]);

  useEffect(() => {
    void detectPlannerCapability().then(setPlannerCap);
  }, []);

  return (
    <View style={styles.root} testID={AccessibilityIDs.tabAdvanced}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Advanced</Text>

        <View style={[styles.card, styles.statusCard]}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.cardTitle}>Webflow MCP</Text>
              <Text style={styles.cardSub}>
                {mcpReady
                  ? `${mcpTools.length} tools · headless (MCP 2.0)`
                  : connection.status === 'connected'
                    ? 'No tools loaded — retry after reconnect'
                    : 'Connect Webflow to load tools'}
              </Text>
            </View>
            <View
              style={[
                styles.livePill,
                mcpReady ? styles.liveOn : styles.liveOff,
              ]}
            >
              <Text style={styles.liveText}>
                {mcpReady ? 'Ready' : 'Offline'}
              </Text>
            </View>
          </View>
          {liveCanvas && liveSessionStatus.status === 'connected' ? (
            <Text style={styles.meta}>
              Optional live session · mode {liveSessionStatus.mode}
            </Text>
          ) : (
            <Text style={styles.meta}>
              Designer Bridge is not required for headless variable / component
              writes.
            </Text>
          )}
          <View style={styles.rowBtns}>
            <Pressable
              style={styles.softBtn}
              onPress={() => void refreshMCP()}
              accessibilityRole="button"
              accessibilityLabel="Refresh MCP tools"
            >
              <Text style={styles.softBtnText}>Refresh MCP</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Designer context</Text>
        <View style={styles.card}>
          <Text style={styles.cardSub}>
            Best-effort from headless MCP tools; never fixture IDs. Live canvas
            session is optional.
          </Text>
          <Text style={styles.meta}>
            Site: {designerContext.siteID ?? '—'}
          </Text>
          <Text style={styles.meta}>
            Page: {designerContext.pageID ?? '—'}
          </Text>
          <Text style={styles.meta}>
            Mode: {designerContext.mode ?? '—'}
          </Text>
          <Text style={styles.meta}>
            Variables loaded: {designerContext.variableIDs.length}
            {designerContext.variableIDs.length
              ? ` · ${designerContext.variableIDs.slice(0, 3).join(', ')}${
                  designerContext.variableIDs.length > 3 ? '…' : ''
                }`
              : ''}
          </Text>
          <Text style={styles.meta}>
            Components loaded: {designerContext.componentIDs.length}
          </Text>
          {designerContext.rawNotes ? (
            <Text style={styles.cardSub} numberOfLines={4}>
              {designerContext.rawNotes}
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>MCP tool registry</Text>
        <View style={styles.card}>
          {mcpTools.length === 0 ? (
            <Text style={styles.cardSub}>
              No tools loaded. Connect Webflow, then tap Refresh MCP.
            </Text>
          ) : (
            mcpTools.map((t) => (
              <View key={t.name} style={styles.toolRow}>
                <Text style={styles.rowTitle}>{t.name}</Text>
                <Text style={styles.cardSub}>
                  {t.description || '—'}
                  {t.requiresLiveSession ? ' · live session' : ' · headless'}
                  {t.isReadOnly ? ' · read' : ' · write'}
                </Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionLabel}>Safe writes (live IDs)</Text>
        <View style={styles.card}>
          <Text style={styles.cardSub}>
            Headless MCP 2.0 writes need a selected site and a compatible tool
            schema. Enter verified IDs only — no sample design-system lists.
          </Text>
          <Pressable
            style={[
              styles.writeBtn,
              !variableWriteAvailable && styles.writeBtnDisabled,
            ]}
            onPress={() => setVarOpen(true)}
            accessibilityRole="button"
            accessibilityState={{ disabled: !variableWriteAvailable }}
            disabled={!variableWriteAvailable}
          >
            <Text style={styles.writeBtnText}>Update Variable…</Text>
          </Pressable>
          <Pressable
            style={[
              styles.writeBtn,
              !componentWriteAvailable && styles.writeBtnDisabled,
            ]}
            onPress={() => setCompOpen(true)}
            accessibilityRole="button"
            accessibilityState={{ disabled: !componentWriteAvailable }}
            disabled={!componentWriteAvailable}
          >
            <Text style={styles.writeBtnText}>Update Component Prop…</Text>
          </Pressable>
        </View>

        {plannerCap === 'onDeviceAvailable' ? (
          <>
            <Text style={styles.sectionLabel}>On-device planner</Text>
            <View style={styles.card}>
              <Text style={styles.cardSub}>
                Local model available. Command may use it with heuristic
                fallback.
              </Text>
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Data API (no MCP)</Text>
        <View style={styles.card}>
          <Text style={styles.cardSub}>
            Publish, CMS, page metadata, and photo upload use the Webflow Data
            API and do not need MCP or Designer.
          </Text>
        </View>
      </ScrollView>

      <VariableUpdateSheet visible={varOpen} onClose={() => setVarOpen(false)} />
      <ComponentPropSheet visible={compOpen} onClose={() => setCompOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  statusCard: { backgroundColor: colors.accentSoft },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm },
  livePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  liveOn: { backgroundColor: '#CFFAFE' },
  liveOff: { backgroundColor: colors.pill },
  liveText: { fontSize: 12, fontWeight: '600', color: colors.accent },
  rowBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  softBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  softBtnText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  toolRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  writeBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  writeBtnDisabled: { opacity: 0.7 },
  writeBtnText: { color: colors.accent, fontWeight: '700' },
});
