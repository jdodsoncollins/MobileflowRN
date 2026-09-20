import { describe, expect, it } from 'vitest';
import { buildBoundedPlannerContextJSON } from '../src/domain/planning/plannerContext';
import { emptyPlanningContext } from '../src/domain/planning/planningTypes';
import { buildSiteHealthSnapshot } from '../src/domain/planning/siteHealth';
import { pageID, siteID, workspaceID } from '../src/domain/models/ids';
import type { WebflowPage, WebflowSite } from '../src/domain/models/webflowModels';

const site: WebflowSite = {
  id: siteID('site_1'),
  name: 'Demo Site',
  shortName: 'demo',
  workspaceID: workspaceID('ws_1'),
  customDomains: [],
  locales: [],
  lastPublished: '2026-01-01T00:00:00.000Z',
  draftChangesCount: 0,
  pendingCMSItems: 0,
  seoIssuesCount: 0,
};

const page: WebflowPage = {
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
};

describe('buildBoundedPlannerContextJSON', () => {
  it('includes agent instructions and never invents ids', () => {
    const ctx = {
      ...emptyPlanningContext(siteID('site_1')),
      pages: [page],
      collections: [],
      agentInstructions: 'Keep titles short',
    };
    const health = buildSiteHealthSnapshot({
      site,
      pages: [page],
      collections: [],
      cmsItems: [],
    });
    const json = buildBoundedPlannerContextJSON({ context: ctx, health });
    const parsed = JSON.parse(json) as {
      agentInstructions: string;
      siteID: string;
      rules: { neverInventIds: boolean };
      healthScore: number;
      findings: unknown[];
    };
    expect(parsed.agentInstructions).toBe('Keep titles short');
    expect(parsed.siteID).toBe('site_1');
    expect(parsed.rules.neverInventIds).toBe(true);
    expect(typeof parsed.healthScore).toBe('number');
    expect(parsed.findings.length).toBeGreaterThan(0);
  });

  it('caps pages and findings', () => {
    const pages = Array.from({ length: 40 }, (_, i) => ({
      ...page,
      id: pageID(`page_${i}`),
      title: `P${i}`,
      slug: `p-${i}`,
    }));
    const ctx = {
      ...emptyPlanningContext(siteID('site_1')),
      pages,
      collections: [],
    };
    const health = buildSiteHealthSnapshot({
      site,
      pages,
      collections: [],
      cmsItems: [],
    });
    const parsed = JSON.parse(
      buildBoundedPlannerContextJSON({
        context: ctx,
        health,
        maxPages: 5,
        maxFindings: 3,
      }),
    ) as { pages: unknown[]; findings: unknown[] };
    expect(parsed.pages).toHaveLength(5);
    expect(parsed.findings.length).toBeLessThanOrEqual(3);
  });
});
