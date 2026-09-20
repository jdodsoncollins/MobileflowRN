import { describe, expect, it } from 'vitest';
import { HeuristicActionPlanner } from '../src/domain/planning/actionPlanner';
import { pageID, siteID, collectionID, itemID } from '../src/domain/models/ids';
import type { WebflowPage } from '../src/domain/models/webflowModels';

const site = siteID('site_1');
const planner = new HeuristicActionPlanner();

function page(
  partial: Partial<Omit<WebflowPage, 'id' | 'siteID'>> & {
    id: string;
    title: string;
  },
): WebflowPage {
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
    pageType: partial.pageType ?? 'staticPage',
    slugEditable: true,
    hasDraftChanges: false,
  };
}

describe('HeuristicActionPlanner', () => {
  it('publish site produces exactly one publish step', () => {
    const plan = planner.planSync('Publish site to production', {
      siteID: site,
      pages: [],
      collections: [],
    });
    expect(plan.descriptors).toHaveLength(1);
    expect(plan.descriptors[0].action.type).toBe('publishSite');
    expect(plan.descriptors[0].confirmation).toBe('hardConfirm');
  });

  it('publish homepage uses loaded page id only', () => {
    const home = page({ id: 'page_home', title: 'Home', slug: '', pageType: 'home' });
    const plan = planner.planSync('Publish the homepage to production', {
      siteID: site,
      pages: [home],
      collections: [],
    });
    expect(plan.descriptors).toHaveLength(1);
    const action = plan.descriptors[0].action;
    expect(action.type).toBe('publishPage');
    if (action.type === 'publishPage') {
      expect(action.input.pageID).toBe(home.id);
    }
  });

  it('seo plans only loaded pages with missing metadata', () => {
    const pages = [
      page({ id: 'p1', title: 'Home', seoTitle: null, seoDescription: null }),
      page({
        id: 'p2',
        title: 'About',
        seoTitle: 'About',
        seoDescription: 'About us',
      }),
    ];
    const plan = planner.planSync('Draft better title tags for pages missing SEO', {
      siteID: site,
      pages,
      collections: [],
    });
    expect(plan.descriptors.length).toBeGreaterThanOrEqual(1);
    for (const d of plan.descriptors) {
      expect(d.action.type).toBe('updatePageMetadata');
      if (d.action.type === 'updatePageMetadata') {
        expect(d.action.input.pageID).toBe(pageID('p1'));
      }
    }
  });

  it('never invents fixture page ids when context empty', () => {
    const plan = planner.planSync('Fix SEO metadata', {
      siteID: site,
      pages: [],
      collections: [],
    });
    expect(plan.descriptors).toHaveLength(1);
    expect(plan.descriptors[0].action.type).toBe('readSiteSummary');
  });

  it('cms draft uses first loaded collection', () => {
    const plan = planner.planSync('Create a draft CMS item', {
      siteID: site,
      pages: [],
      collections: [
        {
          id: collectionID('col_1'),
          siteID: site,
          name: 'Posts',
          slug: 'posts',
          itemCount: 0,
        },
      ],
    });
    expect(plan.descriptors[0].action.type).toBe('createCMSItem');
  });

  it('publish cms item uses a loaded draft, not site publish', () => {
    const plan = planner.planSync('Publish CMS item Launch post', {
      siteID: site,
      pages: [],
      collections: [
        {
          id: collectionID('col_1'),
          siteID: site,
          name: 'Posts',
          slug: 'posts',
          itemCount: 1,
        },
      ],
      cmsItems: [
        {
          id: itemID('item_1'),
          collectionID: collectionID('col_1'),
          name: 'Launch post',
          slug: 'launch-post',
          isDraft: true,
          isPublished: false,
          missingFields: [],
        },
      ],
    });
    expect(plan.descriptors).toHaveLength(1);
    expect(plan.descriptors[0].action.type).toBe('publishCMSItems');
  });
});
