import { describe, expect, it } from 'vitest';
import {
  buildMissingSEODiffs,
  groupAcceptedMetadataUpdates,
} from '../src/domain/planning/seoDrafts';
import { pageID, siteID } from '../src/domain/models/ids';
import type { WebflowPage } from '../src/domain/models/webflowModels';

const site = siteID('s1');

function page(partial: {
  id: string;
  title: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  slug?: string;
}): WebflowPage {
  return {
    id: pageID(partial.id),
    siteID: site,
    title: partial.title,
    slug: partial.slug ?? '',
    seoTitle: partial.seoTitle ?? null,
    seoDescription: partial.seoDescription ?? null,
    openGraphTitle: null,
    openGraphDescription: null,
    locale: null,
    pageType: 'staticPage',
    slugEditable: true,
    hasDraftChanges: false,
  };
}

describe('seoDrafts', () => {
  it('builds diffs only for missing SEO fields and excludes slug', () => {
    const diffs = buildMissingSEODiffs([
      page({ id: 'p1', title: 'Home', seoTitle: null, seoDescription: null }),
      page({
        id: 'p2',
        title: 'About',
        seoTitle: 'About',
        seoDescription: 'About us',
      }),
    ]);
    expect(diffs).toHaveLength(2);
    expect(diffs.every((d) => d.field !== 'slug')).toBe(true);
    expect(diffs.every((d) => d.pageID === pageID('p1'))).toBe(true);
    expect(diffs.every((d) => d.isAccepted)).toBe(true);
  });

  it('groups accepted updates per page', () => {
    const diffs = buildMissingSEODiffs([
      page({ id: 'p1', title: 'Home', seoTitle: null, seoDescription: null }),
    ]);
    diffs[1].isAccepted = false;
    const grouped = groupAcceptedMetadataUpdates(diffs);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].seoTitle).toBeTruthy();
    expect(grouped[0].seoDescription).toBeUndefined();
  });
});
