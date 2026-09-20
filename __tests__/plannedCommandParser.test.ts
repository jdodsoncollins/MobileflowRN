import { describe, expect, it } from 'vitest';
import { PlannedCommandParser } from '../src/domain/planning/plannedCommandParser';
import { pageID, siteID, collectionID, itemID } from '../src/domain/models/ids';
import type { WebflowPage } from '../src/domain/models/webflowModels';

const site = siteID('site_1');

const home: WebflowPage = {
  id: pageID('page_home'),
  siteID: site,
  title: 'Home',
  slug: '',
  seoTitle: null,
  seoDescription: null,
  openGraphTitle: null,
  openGraphDescription: null,
  locale: null,
  pageType: 'home',
  slugEditable: true,
  hasDraftChanges: false,
};

describe('PlannedCommandParser', () => {
  it('never invents missing page ids', () => {
    const plan = PlannedCommandParser.planFromCommandLines(
      'SEO_FIX not_a_real_page\nPUBLISH_PAGE ghost',
      'fix seo',
      { siteID: site, pages: [home], collections: [] },
      'heuristic',
    );
    expect(plan).toBeNull();
  });

  it('collapses multiple publish steps to one', () => {
    const plan = PlannedCommandParser.planFromSteps(
      [
        { kind: 'publishSite' },
        { kind: 'publishPage', pageID: home.id },
        { kind: 'seoFix', pageID: home.id },
      ],
      'publish homepage',
      { siteID: site, pages: [home], collections: [] },
      'heuristic',
    );
    expect(plan).not.toBeNull();
    const publishes = plan!.descriptors.filter(
      (d) =>
        d.action.type === 'publishSite' || d.action.type === 'publishPage',
    );
    expect(publishes).toHaveLength(1);
    expect(publishes[0].action.type).toBe('publishPage');
  });

  it('cms draft requires loaded collection', () => {
    const plan = PlannedCommandParser.planFromCommandLines(
      'CMS_DRAFT col_1',
      'cms',
      {
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
      },
      'heuristic',
    );
    expect(plan?.descriptors[0].action.type).toBe('createCMSItem');
  });

  it('publishes a loaded CMS item and ignores unknown item ids', () => {
    const collection = {
      id: collectionID('col_1'),
      siteID: site,
      name: 'Posts',
      slug: 'posts',
      itemCount: 1,
    };
    const cmsItem = {
      id: itemID('item_1'),
      collectionID: collection.id,
      name: 'Draft post',
      slug: 'draft-post',
      isDraft: true,
      isPublished: false,
      missingFields: [],
    };
    const plan = PlannedCommandParser.planFromCommandLines(
      'PUBLISH_CMS col_1 item_1',
      'publish cms item',
      {
        siteID: site,
        pages: [],
        collections: [collection],
        cmsItems: [cmsItem],
      },
      'heuristic',
    );
    expect(plan?.descriptors[0].action.type).toBe('publishCMSItems');

    const missing = PlannedCommandParser.planFromCommandLines(
      'PUBLISH_CMS col_1 ghost',
      'publish cms item',
      {
        siteID: site,
        pages: [],
        collections: [collection],
        cmsItems: [cmsItem],
      },
      'heuristic',
    );
    expect(missing).toBeNull();
  });
});
