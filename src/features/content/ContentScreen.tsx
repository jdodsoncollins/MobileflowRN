import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { useApp } from '../../shell/AppContext';
import { colors, radii, spacing } from '../../design-system/theme';
import {
  missingSEODescription,
  missingSEOTitle,
  pageTypeDisplayName,
  type WebflowCMSItem,
  type WebflowPage,
} from '../../domain/models/webflowModels';
import { connectionIsConnected } from '../../domain/models/webflowModels';
import { AccessibilityIDs } from '../../support/accessibilityIDs';
import { PageMetadataEditorSheet } from './PageMetadataEditorSheet';
import { CMSItemEditorSheet } from './CMSItemEditorSheet';
import { PhotoAssetUploadSheet } from './PhotoAssetUploadSheet';
import { FormsInbox } from './FormsInbox';
import { ConfirmationPolicy } from '../../domain/policies/confirmationPolicy';
import { newActionPlan } from '../../domain/actions/mobileflowAction';
import {
  filterCMSItems,
  type CMSItemStatusFilter,
} from '../../domain/planning/cmsQuery';
import type { CollectionID } from '../../domain/models/ids';

type ContentSegment = 'pages' | 'cms' | 'assets' | 'forms';

const SEGMENTS: readonly { key: ContentSegment; label: string }[] = [
  { key: 'pages', label: 'Pages' },
  { key: 'cms', label: 'CMS' },
  { key: 'assets', label: 'Assets' },
  { key: 'forms', label: 'Forms' },
];

const STATUS_FILTERS: readonly { key: CMSItemStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'published', label: 'Published' },
];

export function ContentScreen() {
  const {
    connection,
    pages,
    collections,
    cmsItems,
    setSeoDraftOpen,
    setPublishOpen,
    loadCMSItems,
    selectedSiteID,
    executePlan,
    isExecuting,
    cmsItemHasMore,
    cmsItemTotal,
  } = useApp();
  const [segment, setSegment] = useState<ContentSegment>('pages');
  const [editPage, setEditPage] = useState<WebflowPage | null>(null);
  const [editItem, setEditItem] = useState<WebflowCMSItem | null>(null);
  const [assetOpen, setAssetOpen] = useState(false);
  const [cmsMsg, setCmsMsg] = useState<string | null>(null);
  const [cmsQuery, setCmsQuery] = useState('');
  const [cmsStatus, setCmsStatus] = useState<CMSItemStatusFilter>('all');
  const [activeCollection, setActiveCollection] = useState<{
    id: CollectionID;
    name: string;
  } | null>(null);

  const connected = connectionIsConnected(connection);
  const seoDebt = pages.filter(
    (p) => missingSEOTitle(p) || missingSEODescription(p),
  );

  const visibleItems = useMemo(
    () => filterCMSItems(cmsItems, { query: cmsQuery, status: cmsStatus }),
    [cmsItems, cmsQuery, cmsStatus],
  );

  useEffect(() => {
    if (!activeCollection) return;
    const handle = setTimeout(() => {
      void loadCMSItems(activeCollection.id, {
        offset: 0,
        query: cmsQuery.trim() || undefined,
        live: cmsStatus === 'published' ? true : undefined,
      });
    }, 280);
    return () => clearTimeout(handle);
  }, [activeCollection, cmsQuery, cmsStatus, loadCMSItems]);

  const openCollection = (collectionId: string, collectionName: string) => {
    setActiveCollection({
      id: collectionId as CollectionID,
      name: collectionName,
    });
    setCmsMsg(null);
  };

  const reloadActiveCollection = async () => {
    if (!activeCollection) return;
    await loadCMSItems(activeCollection.id, {
      offset: 0,
      query: cmsQuery.trim() || undefined,
      live: cmsStatus === 'published' ? true : undefined,
    });
  };

  const loadMoreItems = () => {
    if (!activeCollection || !cmsItemHasMore) return;
    void loadCMSItems(activeCollection.id, {
      offset: cmsItems.length,
      query: cmsQuery.trim() || undefined,
      append: true,
      live: cmsStatus === 'published' ? true : undefined,
    });
  };

  const publishItem = (item: WebflowCMSItem) => {
    if (!selectedSiteID) return;
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
                  setCmsMsg(result.items[0]?.summary ?? 'Publish failed');
                } else {
                  setCmsMsg('Item published.');
                  await reloadActiveCollection();
                }
              } catch (error) {
                setCmsMsg(
                  error instanceof Error ? error.message : String(error),
                );
              }
            })();
          },
        },
      ],
    );
  };

  const createDraft = async (collectionId: string, collectionName: string) => {
    if (!selectedSiteID) return;
    setCmsMsg(null);
    const plan = newActionPlan({
      prompt: `Create draft in ${collectionName}`,
      descriptors: [
        ConfirmationPolicy.default.descriptor(
          {
            type: 'createCMSItem',
            input: {
              collectionID: collectionId as never,
              fields: {
                name: 'Draft from Mobileflow',
                slug: `draft-${Math.floor(Date.now() / 1000)}`,
              },
            },
          },
          selectedSiteID,
        ),
      ],
    });
    try {
      const result = await executePlan(plan, { hardConfirmAcknowledged: true });
      if (result.failed > 0) {
        setCmsMsg(result.items[0]?.summary ?? 'Create failed');
      } else {
        setCmsMsg('Draft created.');
        openCollection(collectionId, collectionName);
        await loadCMSItems(collectionId as CollectionID, {
          offset: 0,
          query: cmsQuery.trim() || undefined,
        });
      }
    } catch (error) {
      setCmsMsg(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <View style={styles.root} testID={AccessibilityIDs.tabContent}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title} accessibilityRole="header">
          Content
        </Text>

        <View style={styles.segment} accessibilityRole="tablist">
          {SEGMENTS.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => setSegment(key)}
              style={[styles.segItem, segment === key && styles.segActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: segment === key }}
              accessibilityLabel={label}
            >
              <Text
                style={[
                  styles.segText,
                  segment === key && styles.segTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {!connected ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Connect to load content</Text>
            <Text style={styles.emptyBody}>
              Pages, CMS collections, assets, and form submissions come from the
              live Webflow Data API after OAuth.
            </Text>
          </View>
        ) : segment === 'pages' ? (
          <>
            {seoDebt.length > 0 ? (
              <Pressable
                style={styles.draftChip}
                onPress={() => setSeoDraftOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Draft missing metadata for ${seoDebt.length} pages`}
              >
                <Text style={styles.draftChipText}>
                  ✦ Draft Missing Metadata ({seoDebt.length})
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.publishChip}
              onPress={() => setPublishOpen(true)}
              accessibilityRole="button"
            >
              <Text style={styles.publishChipText}>Publish site…</Text>
            </Pressable>
            <Text style={styles.sectionLabel}>Pages</Text>
            <View style={[styles.card, pages.length > 0 && { minHeight: 240 }]}>
              {pages.length === 0 ? (
                <Text style={styles.emptyBody}>No pages loaded yet.</Text>
              ) : (
                <FlashList
                  data={pages}
                  keyExtractor={(page) => page.id}
                  renderItem={({ item: page, index: i }) => (
                    <Pressable
                      onPress={() => setEditPage(page)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit metadata for ${page.title}`}
                      style={[
                        styles.pageRow,
                        i < pages.length - 1 && styles.rowBorder,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.pageHeader}>
                          <Text style={styles.pageTitle}>{page.title}</Text>
                          <Text style={styles.pageType}>
                            {pageTypeDisplayName[page.pageType]}
                          </Text>
                        </View>
                        <View style={styles.badges}>
                          {missingSEOTitle(page) ? (
                            <Text style={styles.warnBadge}>Missing Title</Text>
                          ) : null}
                          {missingSEODescription(page) ? (
                            <Text style={styles.warnBadge}>
                              Missing Description
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  )}
                />
              )}
            </View>
          </>
        ) : segment === 'cms' ? (
          <>
            <Text style={styles.sectionLabel}>Collections</Text>
            {cmsMsg ? <Text style={styles.msg}>{cmsMsg}</Text> : null}
            <View style={styles.card}>
              {collections.length === 0 ? (
                <Text style={styles.emptyBody}>No collections loaded.</Text>
              ) : (
                collections.map((collection, index) => (
                  <View
                    key={collection.id}
                    style={[
                      styles.pageRow,
                      index < collections.length - 1 && styles.rowBorder,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pageTitle}>{collection.name}</Text>
                      <Text style={styles.pageType}>
                        {collection.slug || 'collection'}
                        {activeCollection?.id === collection.id
                          ? ' · Open'
                          : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        openCollection(collection.id, collection.name)
                      }
                      style={styles.smallBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Load items in ${collection.name}`}
                    >
                      <Text style={styles.smallBtnText}>Items</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        void createDraft(collection.id, collection.name)
                      }
                      style={styles.smallBtn}
                      disabled={isExecuting}
                      accessibilityRole="button"
                      accessibilityLabel={`Create draft in ${collection.name}`}
                      accessibilityState={{ disabled: isExecuting }}
                    >
                      <Text style={styles.smallBtnText}>+ Draft</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
            {activeCollection ? (
              <>
                <Text style={styles.sectionLabel}>
                  Items · {activeCollection.name}
                </Text>
                <TextInput
                  style={styles.search}
                  value={cmsQuery}
                  onChangeText={setCmsQuery}
                  placeholder="Search by name or slug"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Search CMS items"
                />
                <View style={styles.filterRow}>
                  {STATUS_FILTERS.map(({ key, label }) => (
                    <Pressable
                      key={key}
                      onPress={() => setCmsStatus(key)}
                      style={[
                        styles.filterChip,
                        cmsStatus === key && styles.filterChipActive,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: cmsStatus === key }}
                      accessibilityLabel={`Filter ${label}`}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          cmsStatus === key && styles.filterChipTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.metaCount}>
                  {visibleItems.length} shown
                  {cmsItemTotal > 0 ? ` · ${cmsItemTotal} total` : ''}
                </Text>
                <View style={styles.card}>
                  {visibleItems.length === 0 ? (
                    <Text style={styles.emptyBody}>
                      No items match this search.
                    </Text>
                  ) : (
                    visibleItems.map((item, index) => (
                      <View
                        key={item.id}
                        style={[
                          styles.pageRow,
                          index < visibleItems.length - 1 && styles.rowBorder,
                        ]}
                      >
                        <Pressable
                          onPress={() => setEditItem(item)}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit CMS item ${item.name}`}
                          style={{ flex: 1 }}
                        >
                          <Text style={styles.pageTitle}>{item.name}</Text>
                          <Text style={styles.pageType}>
                            {item.isDraft && !item.isPublished
                              ? 'Draft'
                              : 'Published'}{' '}
                            · {item.slug}
                          </Text>
                        </Pressable>
                        {item.isDraft && !item.isPublished ? (
                          <Pressable
                            onPress={() => publishItem(item)}
                            disabled={isExecuting}
                            style={styles.smallBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`Publish ${item.name}`}
                            accessibilityState={{ disabled: isExecuting }}
                          >
                            <Text style={styles.smallBtnText}>Publish</Text>
                          </Pressable>
                        ) : null}
                        <Text style={styles.chevron}>›</Text>
                      </View>
                    ))
                  )}
                </View>
                {cmsItemHasMore ? (
                  <Pressable
                    style={styles.loadMore}
                    onPress={loadMoreItems}
                    disabled={isExecuting}
                    accessibilityRole="button"
                    accessibilityLabel="Load more CMS items"
                  >
                    <Text style={styles.loadMoreText}>Load more</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </>
        ) : segment === 'forms' ? (
          <FormsInbox />
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Photo → Asset</Text>
            <Text style={styles.emptyBody}>
              Upload from the camera roll. No mock media library. Success only
              after a real Webflow upload.
            </Text>
            <Pressable
              style={styles.publishChip}
              onPress={() => setAssetOpen(true)}
              accessibilityRole="button"
            >
              <Text style={styles.publishChipText}>Open upload…</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <PageMetadataEditorSheet
        page={editPage}
        visible={editPage != null}
        onClose={() => setEditPage(null)}
        onOpenPublish={() => {
          setEditPage(null);
          setPublishOpen(true);
        }}
      />
      <CMSItemEditorSheet
        item={editItem}
        visible={editItem != null}
        onClose={() => setEditItem(null)}
        onPublished={() => {
          void reloadActiveCollection();
        }}
      />
      <PhotoAssetUploadSheet
        visible={assetOpen}
        onClose={() => setAssetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  title: {
    fontSize: 34,
    fontWeight: '700',
    marginBottom: spacing.lg,
    color: colors.text,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.pill,
    borderRadius: radii.pill,
    padding: 4,
    marginBottom: spacing.lg,
  },
  segItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  segActive: { backgroundColor: colors.surface },
  segText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  segTextActive: { color: colors.text, fontWeight: '600' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 8,
    minHeight: 48,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  pageType: { fontSize: 13, color: colors.textTertiary },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  warnBadge: {
    fontSize: 12,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  chevron: { fontSize: 22, color: colors.textTertiary, marginLeft: 8 },
  draftChip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  draftChipText: { color: colors.accent, fontWeight: '600', fontSize: 15 },
  publishChip: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  publishChipText: { color: colors.fab, fontWeight: '600', fontSize: 15 },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    minHeight: 44,
    justifyContent: 'center',
  },
  smallBtnText: { color: colors.accent, fontWeight: '600', fontSize: 12 },
  msg: { color: colors.textSecondary, marginBottom: spacing.sm, fontSize: 13 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyBody: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 44,
    marginBottom: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.pill,
    minHeight: 36,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.accentSoft,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.accent,
  },
  metaCount: {
    fontSize: 13,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  loadMore: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadMoreText: { color: colors.accent, fontWeight: '600', fontSize: 15 },
});
