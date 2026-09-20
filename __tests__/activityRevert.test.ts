import { describe, expect, it } from 'vitest';
import {
  activityWithChanges,
  buildRevertDescriptors,
  canRevertActivity,
  markActivityReverted,
} from '../src/domain/planning/activityRevert';
import { cryptoRandomId } from '../src/domain/actions/mobileflowAction';
import { siteID } from '../src/domain/models/ids';
import type { ActivityItem } from '../src/domain/models/webflowModels';

function baseItem(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: cryptoRandomId(),
    timestamp: new Date().toISOString(),
    siteName: 'Demo',
    title: 'SEO update',
    summary: 'Updated title',
    source: 'manual',
    risk: 'medium',
    status: 'completed',
    siteID: 'site_1',
    ...overrides,
  };
}

describe('activityRevert', () => {
  it('activityWithChanges enables canRevert for completed items', () => {
    const item = activityWithChanges(baseItem(), [
      {
        resourceType: 'page',
        resourceId: 'page_1',
        field: 'seoTitle',
        before: 'Old',
        after: 'New',
      },
    ]);
    expect(item.canRevert).toBe(true);
    expect(item.changes).toHaveLength(1);
  });

  it('buildRevertDescriptors creates reverse page metadata update', () => {
    const item = activityWithChanges(baseItem(), [
      {
        resourceType: 'page',
        resourceId: 'page_1',
        field: 'seoTitle',
        before: 'Old Title',
        after: 'New Title',
      },
      {
        resourceType: 'page',
        resourceId: 'page_1',
        field: 'seoDescription',
        before: 'Old Desc',
        after: 'New Desc',
      },
    ]);
    const descriptors = buildRevertDescriptors(item, siteID('site_1'));
    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]!.action.type).toBe('updatePageMetadata');
    if (descriptors[0]!.action.type === 'updatePageMetadata') {
      expect(descriptors[0]!.action.input.seoTitle).toBe('Old Title');
      expect(descriptors[0]!.action.input.seoDescription).toBe('Old Desc');
    }
  });

  it('returns empty when already reverted', () => {
    const item = markActivityReverted(
      activityWithChanges(baseItem(), [
        {
          resourceType: 'page',
          resourceId: 'page_1',
          field: 'seoTitle',
          before: 'A',
          after: 'B',
        },
      ]),
    );
    expect(item.canRevert).toBe(false);
    expect(item.revertedAt).toBeTruthy();
    expect(buildRevertDescriptors(item, siteID('site_1'))).toEqual([]);
  });

  it('builds CMS item revert when collection encoded in field', () => {
    const item = activityWithChanges(baseItem(), [
      {
        resourceType: 'cmsItem',
        resourceId: 'item_1',
        field: 'col_1::name',
        before: 'Before',
        after: 'After',
      },
    ]);
    const descriptors = buildRevertDescriptors(item, siteID('site_1'));
    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]!.action.type).toBe('updateCMSItem');
  });

  it('allows revert only when the activity belongs to the selected site', () => {
    const item = activityWithChanges(baseItem(), [
      {
        resourceType: 'page',
        resourceId: 'page_1',
        field: 'seoTitle',
        before: 'Before',
        after: 'After',
      },
    ]);

    expect(canRevertActivity(item, siteID('site_1'))).toBe(true);
    expect(canRevertActivity(item, siteID('site_2'))).toBe(false);
    expect(canRevertActivity(item, null)).toBe(false);
  });
});
