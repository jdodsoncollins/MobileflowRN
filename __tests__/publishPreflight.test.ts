import { describe, expect, it } from 'vitest';
import {
  evaluatePublishPreflight,
  emptyPublishTargets,
} from '../src/domain/planning/publishPlanning';
import { siteID, workspaceID } from '../src/domain/models/ids';

const site = {
  id: siteID('s1'),
  workspaceID: workspaceID('w1'),
  name: 'Test',
  shortName: 'test',
  lastPublished: null,
  customDomains: [],
  locales: [],
  draftChangesCount: 0,
  pendingCMSItems: 0,
  seoIssuesCount: 0,
};

describe('PublishPreflight', () => {
  it('blocks when disconnected', () => {
    const pre = evaluatePublishPreflight({
      site,
      targets: {
        ...emptyPublishTargets,
        publishToWebflowSubdomain: true,
      },
      connection: { status: 'disconnected' },
      cooldownUntil: null,
    });
    expect(pre.canPublish).toBe(false);
    expect(pre.checks.find((c) => c.name === 'OAuth connected')?.passed).toBe(
      false,
    );
  });

  it('blocks during cooldown', () => {
    const until = new Date(Date.now() + 45_000).toISOString();
    const pre = evaluatePublishPreflight({
      site,
      targets: {
        ...emptyPublishTargets,
        publishToWebflowSubdomain: true,
      },
      connection: { status: 'connected', sites: [site] },
      cooldownUntil: until,
    });
    expect(pre.canPublish).toBe(false);
    expect(pre.rateLimitWarning).toContain('Wait');
  });

  it('allows when connected with target and no cooldown', () => {
    const pre = evaluatePublishPreflight({
      site,
      targets: {
        ...emptyPublishTargets,
        publishToWebflowSubdomain: true,
      },
      connection: { status: 'connected', sites: [site] },
      cooldownUntil: null,
    });
    expect(pre.canPublish).toBe(true);
  });
});
