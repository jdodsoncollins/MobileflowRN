import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../../shell/AppContext';
import { closeModal } from '../../shell/nav';
import { rankSites, siteSubtitle, siteTitle } from '../../domain/models/siteScope';
import { connectionSites } from '../../domain/models/webflowModels';
import { colors, radii, spacing, typography } from '../../design-system/theme';
import { SectionLabel } from '../../design-system/GlassChrome';
import { AccessibilityIDs } from '../../support/accessibilityIDs';

export function SitePickerSheet() {
  const { connection, selectedSiteID, selectSite, isBusy } = useApp();
  const [query, setQuery] = useState('');
  const sites = connectionSites(connection);
  const ranked = useMemo(() => rankSites(sites, query), [sites, query]);

  return (
    <View style={styles.root} testID={AccessibilityIDs.sitePicker}>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Filter sites"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Filter sites"
      />
      <SectionLabel>{query.trim() ? 'Matches' : 'Sites'}</SectionLabel>
      {ranked.length === 0 ? (
        <Text style={styles.empty}>
          {isBusy ? 'Loading sites…' : 'No sites match this filter.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {ranked.map((site, i) => {
            const selected = selectedSiteID === site.id;
            return (
              <Pressable
                key={site.id}
                onPress={() => {
                  selectSite(site.id);
                  closeModal();
                }}
                accessibilityRole="button"
                accessibilityLabel={`${siteTitle(site)}${selected ? ', selected' : ''}`}
                accessibilityHint="Selects this site without changing tabs"
                style={[
                  styles.row,
                  i < ranked.length - 1 && styles.rowBorder,
                  selected && styles.rowSelected,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {siteTitle(site)}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {siteSubtitle(site)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, gap: spacing.md },
  search: {
    ...typography.body,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowSelected: { backgroundColor: colors.accentSoft },
  name: { ...typography.headline, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  empty: { ...typography.subhead, color: colors.textSecondary },
});
