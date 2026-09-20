import { describe, expect, it } from 'vitest';
import {
  buildContentFingerprint,
  detectStalePages,
  hashPage,
  isFingerprintStale,
} from '../src/domain/planning/staleData';
import { pageID, siteID } from '../src/domain/models/ids';
import type { WebflowPage } from '../src/domain/models/webflowModels';

function page(overrides: Partial<WebflowPage> = {}): WebflowPage {
  return {
    id: pageID('page_1'),
    siteID: siteID('site_1'),
    title: 'Home',
    slug: 'home',
    pageType: 'staticPage',
    locale: 'en',
    seoTitle: 'Title',
    seoDescription: 'Desc',
    openGraphTitle: null,
    openGraphDescription: null,
    slugEditable: true,
    hasDraftChanges: false,
    ...overrides,
  };
}

describe('staleData', () => {
  it('hashPage changes when SEO fields change', () => {
    const a = page();
    const b = page({ seoTitle: 'Changed' });
    expect(hashPage(a)).not.toBe(hashPage(b));
  });

  it('detectStalePages returns pages that diverged from baseline', () => {
    const baseline = buildContentFingerprint([page()]);
    const current = [page({ seoDescription: 'new' })];
    expect(detectStalePages(baseline, current)).toEqual([pageID('page_1')]);
  });

  it('isFingerprintStale when page count changes', () => {
    const baseline = buildContentFingerprint([page()]);
    expect(
      isFingerprintStale(baseline, [
        page(),
        page({ id: pageID('page_2'), title: 'About', slug: 'about' }),
      ]),
    ).toBe(true);
  });

  it('isFingerprintStale false when unchanged', () => {
    const pages = [page()];
    const baseline = buildContentFingerprint(pages);
    expect(isFingerprintStale(baseline, pages)).toBe(false);
  });
});
