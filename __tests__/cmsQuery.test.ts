import { describe, expect, it } from 'vitest';
import {
  CMS_PAGE_SIZE,
  cmsItemMatchesQuery,
  filterCMSItems,
} from '../src/domain/planning/cmsQuery';
import { collectionID, itemID } from '../src/domain/models/ids';
import type { WebflowCMSItem } from '../src/domain/models/webflowModels';

function item(overrides: Partial<WebflowCMSItem> = {}): WebflowCMSItem {
  return {
    id: itemID('item_1'),
    collectionID: collectionID('col_1'),
    name: 'Launch post',
    slug: 'launch-post',
    isDraft: true,
    isPublished: false,
    missingFields: [],
    ...overrides,
  };
}

describe('cmsQuery', () => {
  it('uses a 25-item page size', () => {
    expect(CMS_PAGE_SIZE).toBe(25);
  });

  it('matches name or slug case-insensitively', () => {
    const post = item();
    expect(cmsItemMatchesQuery(post, 'LAUNCH')).toBe(true);
    expect(cmsItemMatchesQuery(post, 'launch-post')).toBe(true);
    expect(cmsItemMatchesQuery(post, 'missing')).toBe(false);
  });

  it('filters by draft and published status', () => {
    const draft = item({ id: itemID('d1'), isDraft: true, isPublished: false });
    const live = item({
      id: itemID('p1'),
      name: 'Live',
      slug: 'live',
      isDraft: false,
      isPublished: true,
    });
    expect(filterCMSItems([draft, live], { status: 'draft' })).toEqual([draft]);
    expect(filterCMSItems([draft, live], { status: 'published' })).toEqual([
      live,
    ]);
    expect(
      filterCMSItems([draft, live], { query: 'launch', status: 'all' }),
    ).toEqual([draft]);
  });
});
