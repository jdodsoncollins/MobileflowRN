import { describe, expect, it, vi } from 'vitest';
import {
  assertPlanTargetsSite,
  attributeActivityToPlan,
  executeApprovedPlan,
  HardConfirmRequiredError,
  planNeedsHardConfirm,
} from '../src/services/actions/executePlan';
import { ConfirmationPolicy } from '../src/domain/policies/confirmationPolicy';
import { newActionPlan } from '../src/domain/actions/mobileflowAction';
import { pageID, siteID } from '../src/domain/models/ids';
import type { ActionExecutor } from '../src/services/actions/liveActionExecutor';
import type { ActivityItem } from '../src/domain/models/webflowModels';

const policy = ConfirmationPolicy.default;
const site = siteID('site_1');

function makeExecutor(failTitle?: string): ActionExecutor {
  return {
    async execute(descriptor) {
      const failed = failTitle != null && descriptor.title === failTitle;
      const item: ActivityItem = {
        id: descriptor.id,
        timestamp: new Date().toISOString(),
        siteName: 'Test',
        title: descriptor.title,
        summary: failed
          ? 'Failed: Resource not found.'
          : descriptor.summary,
        source: 'command',
        risk: descriptor.risk,
        status: failed ? 'failed' : 'completed',
      };
      return item;
    },
  };
}

describe('executeApprovedPlan', () => {
  it('rejects every cross-site descriptor before execution', () => {
    const otherSite = siteID('site_2');
    const plan = newActionPlan({
      descriptors: [
        policy.descriptor(
          { type: 'readSiteSummary', siteID: otherSite },
          otherSite,
        ),
      ],
    });

    expect(() => assertPlanTargetsSite(plan, site)).toThrow(/different site/i);
    expect(() => assertPlanTargetsSite(plan, null)).toThrow(/select a site/i);
  });

  it('attributes activity to the approved plan site', () => {
    const plan = newActionPlan({
      descriptors: [
        policy.descriptor({ type: 'readSiteSummary', siteID: site }, site),
      ],
    });
    const item: ActivityItem = {
      id: 'activity',
      timestamp: new Date().toISOString(),
      siteName: 'Test',
      title: 'Read site',
      summary: 'Complete',
      source: 'command',
      risk: 'readOnly',
      status: 'completed',
      siteID: 'stale-site',
    };

    expect(attributeActivityToPlan([item], plan, site)[0]?.siteID).toBe(site);
  });

  it('detects hard confirm for publish', () => {
    const plan = newActionPlan({
      descriptors: [
        policy.descriptor(
          {
            type: 'publishSite',
            input: {
              siteID: site,
              customDomainIDs: [],
              publishToWebflowSubdomain: true,
            },
          },
          site,
        ),
      ],
    });
    expect(planNeedsHardConfirm(plan)?.title).toBe('Publish Site');
  });

  it('throws HardConfirmRequiredError until acknowledged', async () => {
    const plan = newActionPlan({
      descriptors: [
        policy.descriptor(
          {
            type: 'publishSite',
            input: {
              siteID: site,
              customDomainIDs: [],
              publishToWebflowSubdomain: true,
            },
          },
          site,
        ),
      ],
    });
    await expect(
      executeApprovedPlan(plan, makeExecutor()),
    ).rejects.toBeInstanceOf(HardConfirmRequiredError);
  });

  it('executes after hard confirm and records failures honestly', async () => {
    const plan = newActionPlan({
      descriptors: [
        policy.descriptor(
          {
            type: 'updatePageMetadata',
            input: {
              pageID: pageID('p1'),
              seoTitle: 'T',
            },
          },
          site,
        ),
        policy.descriptor(
          {
            type: 'publishSite',
            input: {
              siteID: site,
              customDomainIDs: [],
              publishToWebflowSubdomain: true,
            },
          },
          site,
        ),
      ],
    });
    const result = await executeApprovedPlan(plan, makeExecutor('Publish Site'), {
      hardConfirmAcknowledged: true,
    });
    expect(result.items).toHaveLength(2);
    expect(result.completed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.items[1].status).toBe('failed');
    expect(result.items[1].summary).toContain('Resource not found');
  });

  it('runs medium-risk metadata without hard confirm', async () => {
    const execute = vi.fn(async (d) => ({
      id: d.id,
      timestamp: new Date().toISOString(),
      siteName: 'Test',
      title: d.title,
      summary: d.summary,
      source: 'command' as const,
      risk: d.risk,
      status: 'completed' as const,
    }));
    const plan = newActionPlan({
      descriptors: [
        policy.descriptor(
          {
            type: 'updatePageMetadata',
            input: { pageID: pageID('p1'), seoTitle: 'New' },
          },
          site,
        ),
      ],
    });
    const result = await executeApprovedPlan(plan, { execute });
    expect(result.completed).toBe(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
