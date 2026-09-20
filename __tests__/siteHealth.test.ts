import { describe, expect, it } from 'vitest';
import {
  buildSiteHealthSnapshot,
  findingsToMetadataProposals,
} from '../src/domain/planning/siteHealth';
import {
  collectionID,
  itemID,
  pageID,
  siteID,
  workspaceID,
} from '../src/domain/models/ids';
import type {
  WebflowCMSItem,
  WebflowCollection,
  WebflowPage,
  WebflowSite,
} from '../src/domain/models/webflowModels';
import { LARGE_ASSET_BYTES } from '../src/domain/models/contentModels';

function makeSite(overrides: Partial<WebflowSite> = {}): WebflowSite {
  return {
    id: siteID('site_1'),
    name: 'Demo Site',
    shortName: 'demo',
    workspaceID: workspaceID('ws_1'),
    customDomains: [],
    lastPublished: '2026-01-01T00:00:00.000Z',
    draftChangesCount: 0,
    pendingCMSItems: 0,
    seoIssuesCount: 0,
    ...overrides,
  };
}

function makePage(overrides: Partial<WebflowPage> = {}): WebflowPage {
  return {
    id: pageID('page_1'),
    siteID: siteID('site_1'),
    title: 'Home',
    slug: 'home',
    pageType: 'staticPage',
    locale: 'en',
    seoTitle: null,
    seoDescription: null,
    openGraphTitle: null,
    openGraphDescription: null,
    slugEditable: true,
    hasDraftChanges: false,
    ...overrides,
  };
}

function makeCollection(
  overrides: Partial<WebflowCollection> = {},
): WebflowCollection {
  return {
    id: collectionID('col_1'),
    siteID: siteID('site_1'),
    name: 'Posts',
    slug: 'posts',
    itemCount: 0,
    ...overrides,
  };
}

function makeItem(overrides: Partial<WebflowCMSItem> = {}): WebflowCMSItem {
  return {
    id: itemID('item_1'),
    collectionID: collectionID('col_1'),
    name: 'Post A',
    slug: 'post-a',
    isDraft: false,
    isPublished: true,
    missingFields: [],
    ...overrides,
  };
}

describe('buildSiteHealthSnapshot', () => {
  it('flags missing SEO title and description', () => {
    const snap = buildSiteHealthSnapshot({
      site: makeSite(),
      pages: [makePage()],
      collections: [],
      cmsItems: [],
      now: new Date('2026-07-15T12:00:00.000Z'),
    });
    expect(snap.findings.some((f) => f.fixKind === 'seoTitle')).toBe(true);
    expect(snap.findings.some((f) => f.fixKind === 'seoDescription')).toBe(
      true,
    );
    expect(snap.score).toBeLessThan(100);
  });

  it('flags duplicate SEO titles', () => {
    const snap = buildSiteHealthSnapshot({
      site: makeSite(),
      pages: [
        makePage({
          id: pageID('p1'),
          seoTitle: 'Same',
          seoDescription: 'd1',
        }),
        makePage({
          id: pageID('p2'),
          title: 'About',
          slug: 'about',
          seoTitle: 'Same',
          seoDescription: 'd2',
        }),
      ],
      collections: [],
      cmsItems: [],
    });
    expect(snap.findings.some((f) => f.title.includes('Duplicate'))).toBe(true);
  });

  it('flags duplicate CMS slugs as high severity', () => {
    const snap = buildSiteHealthSnapshot({
      site: makeSite(),
      pages: [],
      collections: [makeCollection()],
      cmsItems: [
        makeItem({ id: itemID('i1'), slug: 'dup' }),
        makeItem({ id: itemID('i2'), name: 'B', slug: 'dup' }),
      ],
    });
    const dup = snap.findings.find((f) => f.id.startsWith('cms-dup-slug'));
    expect(dup?.severity).toBe('high');
  });

  it('deducts score for never-published sites', () => {
    const snap = buildSiteHealthSnapshot({
      site: makeSite({ lastPublished: null }),
      pages: [
        makePage({
          seoTitle: 'Ok title',
          seoDescription: 'Ok description that is long enough.',
          openGraphTitle: 'og',
          openGraphDescription: 'ogd',
        }),
      ],
      collections: [],
      cmsItems: [],
    });
    expect(snap.findings.some((f) => f.id === 'site-never-published')).toBe(
      true,
    );
  });

  it('flags missing alt text and large images', () => {
    const snap = buildSiteHealthSnapshot({
      site: makeSite(),
      pages: [],
      collections: [],
      cmsItems: [],
      assets: [
        {
          id: 'a1',
          fileName: 'hero.png',
          contentType: 'image/png',
          url: 'https://example.com/hero.png',
          uploadedAt: '2026-01-01T00:00:00.000Z',
          sizeBytes: LARGE_ASSET_BYTES,
          altText: null,
        },
      ],
    });
    expect(snap.counts.assets).toBe(1);
    expect(snap.findings.some((f) => f.fixKind === 'assetAlt')).toBe(true);
    expect(snap.findings.some((f) => f.id.startsWith('asset-large'))).toBe(
      true,
    );
  });
});

describe('findingsToMetadataProposals', () => {
  it('maps SEO title/description findings with proposals', () => {
    const snap = buildSiteHealthSnapshot({
      site: makeSite(),
      pages: [makePage({ id: pageID('p1'), title: 'Home', slug: 'home' })],
      collections: [],
      cmsItems: [],
    });
    const proposals = findingsToMetadataProposals(snap.findings);
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.every((p) => p.proposedValue.length > 0)).toBe(true);
    expect(proposals.every((p) => p.pageID === pageID('p1'))).toBe(true);
  });
});
