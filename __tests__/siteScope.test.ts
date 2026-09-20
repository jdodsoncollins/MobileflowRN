import { describe, expect, it } from 'vitest';
import { rankSites, siteSubtitle, siteTitle } from '../src/domain/models/siteScope';
import { siteID, workspaceID } from '../src/domain/models/ids';
import type { WebflowSite } from '../src/domain/models/webflowModels';

function site(partial: Partial<WebflowSite> & { name: string }): WebflowSite {
  return {
    id: siteID(partial.name),
    workspaceID: workspaceID('ws'),
    shortName: partial.shortName ?? partial.name.toLowerCase(),
    lastPublished: partial.lastPublished ?? null,
    customDomains: partial.customDomains ?? [],
    draftChangesCount: 0,
    pendingCMSItems: 0,
    seoIssuesCount: 0,
    ...partial,
  };
}

describe('siteScope', () => {
  it('prefers a custom domain host as the title', () => {
    const s = site({
      name: 'Portfolio',
      customDomains: [{ id: 'd1', url: 'https://jeremy.example' }],
    });
    expect(siteTitle(s)).toBe('jeremy.example');
    expect(siteSubtitle(s)).toBe('Portfolio');
  });

  it('filters and ranks published sites first', () => {
    const unpublished = site({ name: 'Drafty', lastPublished: null });
    const live = site({ name: 'Live', lastPublished: '2026-01-01' });
    const ranked = rankSites([unpublished, live], '');
    expect(ranked[0].name).toBe('Live');
    expect(rankSites([unpublished, live], 'draft').map((s) => s.name)).toEqual([
      'Drafty',
    ]);
  });
});
