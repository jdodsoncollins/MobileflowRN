import type { ActionDescriptor } from '../actions/mobileflowAction';
import { ConfirmationPolicy } from '../policies/confirmationPolicy';
import type { SiteID } from '../models/ids';
import type {
  ActivityChangeRecord,
  ActivityItem,
} from '../models/webflowModels';
import { pageID, collectionID, itemID } from '../models/ids';

/** Build reverse update descriptors from activity change records. */
export function buildRevertDescriptors(
  item: ActivityItem,
  siteID: SiteID,
): ActionDescriptor[] {
  if (!item.changes?.length || item.revertedAt) return [];
  const policy = ConfirmationPolicy.default;
  const byPage = new Map<
    string,
    { seoTitle?: string; seoDescription?: string; openGraphTitle?: string; openGraphDescription?: string; slug?: string }
  >();
  const byCms: Array<{ collectionID: string; itemID: string; fields: Record<string, string> }> = [];

  for (const c of item.changes) {
    if (c.resourceType === 'page') {
      const cur = byPage.get(c.resourceId) ?? {};
      if (c.field === 'seoTitle') cur.seoTitle = c.before;
      if (c.field === 'seoDescription') cur.seoDescription = c.before;
      if (c.field === 'openGraphTitle') cur.openGraphTitle = c.before;
      if (c.field === 'openGraphDescription') cur.openGraphDescription = c.before;
      if (c.field === 'slug') cur.slug = c.before;
      byPage.set(c.resourceId, cur);
    } else if (c.resourceType === 'cmsItem') {
      // collectionId encoded as collectionId:itemId optional — use resourceId as item only
      byCms.push({
        collectionID: c.field.includes('::') ? c.field.split('::')[0]! : '',
        itemID: c.resourceId,
        fields: { [c.field.includes('::') ? c.field.split('::')[1]! : c.field]: c.before },
      });
    }
  }

  const descriptors: ActionDescriptor[] = [];
  for (const [pid, fields] of byPage) {
    descriptors.push(
      policy.descriptor(
        {
          type: 'updatePageMetadata',
          input: {
            pageID: pageID(pid),
            seoTitle: fields.seoTitle,
            seoDescription: fields.seoDescription,
            openGraphTitle: fields.openGraphTitle,
            openGraphDescription: fields.openGraphDescription,
            slug: fields.slug,
          },
        },
        siteID,
      ),
    );
  }
  for (const row of byCms) {
    if (!row.collectionID) continue;
    descriptors.push(
      policy.descriptor(
        {
          type: 'updateCMSItem',
          input: {
            collectionID: collectionID(row.collectionID),
            itemID: itemID(row.itemID),
            fields: row.fields,
          },
        },
        siteID,
      ),
    );
  }
  return descriptors;
}

export function canRevertActivity(
  item: ActivityItem,
  selectedSiteID: SiteID | null,
): boolean {
  return (
    selectedSiteID != null &&
    item.siteID === selectedSiteID &&
    !!item.canRevert &&
    !!item.changes?.length &&
    !item.revertedAt &&
    item.status === 'completed'
  );
}

export function markActivityReverted(item: ActivityItem): ActivityItem {
  return {
    ...item,
    canRevert: false,
    revertedAt: new Date().toISOString(),
    summary: `${item.summary} · reverted`,
  };
}

export function activityWithChanges(
  item: ActivityItem,
  changes: ActivityChangeRecord[],
): ActivityItem {
  return {
    ...item,
    changes,
    canRevert: changes.length > 0 && item.status === 'completed',
  };
}
