import { newActionPlan, type ActionDescriptor, type ActionPlan, type PlannerSource } from '../actions/mobileflowAction';
import { collectionID, pageID } from '../models/ids';
import type { WebflowPage } from '../models/webflowModels';
import { ConfirmationPolicy } from '../policies/confirmationPolicy';
import type { PlanningContext } from './planningTypes';

export type PlannedStep =
  | { kind: 'publishSite' }
  | { kind: 'publishPage'; pageID: string }
  | { kind: 'seoFix'; pageID: string }
  | { kind: 'cmsDraft'; collectionID: string }
  | { kind: 'publishCMS'; collectionID: string; itemID: string }
  | { kind: 'readSummary' }
  | { kind: 'uploadAsset' };

export const PlannedCommandParser = {
  planFromCommandLines(
    text: string,
    prompt: string,
    context: PlanningContext,
    source: PlannerSource,
  ): ActionPlan | null {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const steps: PlannedStep[] = [];
    for (const line of lines) {
      const parts = line.split(/\s+/);
      const head = parts[0]?.toUpperCase();
      if (!head) continue;
      switch (head) {
        case 'PUBLISH_SITE':
          steps.push({ kind: 'publishSite' });
          break;
        case 'PUBLISH_PAGE':
          if (parts.length >= 2) steps.push({ kind: 'publishPage', pageID: parts[1] });
          break;
        case 'SEO_FIX':
          if (parts.length >= 2) steps.push({ kind: 'seoFix', pageID: parts[1] });
          break;
        case 'CMS_DRAFT':
          if (parts.length >= 2) steps.push({ kind: 'cmsDraft', collectionID: parts[1] });
          break;
        case 'PUBLISH_CMS':
          if (parts.length >= 3) {
            steps.push({
              kind: 'publishCMS',
              collectionID: parts[1],
              itemID: parts[2],
            });
          }
          break;
        case 'READ_SUMMARY':
          steps.push({ kind: 'readSummary' });
          break;
        case 'UPLOAD_ASSET':
          steps.push({ kind: 'uploadAsset' });
          break;
        default:
          break;
      }
    }
    return this.planFromSteps(steps, prompt, context, source);
  },

  planFromSteps(
    steps: PlannedStep[],
    prompt: string,
    context: PlanningContext,
    source: PlannerSource,
    rationale?: string | null,
  ): ActionPlan | null {
    const policy = ConfirmationPolicy.default;
    const siteID = context.siteID;
    const collapsed = this.collapsePublishSteps(steps, prompt, context);
    const descriptors: ActionDescriptor[] = [];

    for (const step of collapsed) {
      switch (step.kind) {
        case 'publishSite': {
          const descriptor = policy.descriptor(
            {
              type: 'publishSite',
              input: {
                siteID,
                customDomainIDs: [],
                publishToWebflowSubdomain: true,
              },
            },
            siteID,
          );
          if (isPublishCoolingDown(context)) {
            descriptor.summary +=
              ' Note: publish may be rate-limited; wait for cooldown before approve.';
          }
          descriptors.push(descriptor);
          break;
        }
        case 'publishPage': {
          if (!context.pages.some((p) => p.id === step.pageID)) break;
          const descriptor = policy.descriptor(
            {
              type: 'publishPage',
              input: {
                siteID,
                pageID: pageID(step.pageID),
                customDomainIDs: [],
                publishToWebflowSubdomain: true,
              },
            },
            siteID,
          );
          if (isPublishCoolingDown(context)) {
            descriptor.summary +=
              ' Note: publish may be rate-limited; wait for cooldown before approve.';
          }
          descriptors.push(descriptor);
          break;
        }
        case 'seoFix': {
          const page = context.pages.find((p) => p.id === step.pageID);
          if (!page) break;
          const seoTitle =
            page.seoTitle && page.seoTitle.trim() !== ''
              ? page.seoTitle
              : `${page.title}${page.slug ? ` · ${page.slug}` : ''}`;
          const seoDescription =
            page.seoDescription && page.seoDescription.trim() !== ''
              ? page.seoDescription
              : `Concise description for ${page.title}. Review before applying.`;
          descriptors.push(
            policy.descriptor(
              {
                type: 'updatePageMetadata',
                input: {
                  pageID: page.id,
                  seoTitle,
                  seoDescription,
                },
              },
              siteID,
            ),
          );
          break;
        }
        case 'cmsDraft': {
          if (!context.collections.some((c) => c.id === step.collectionID)) break;
          descriptors.push(
            policy.descriptor(
              {
                type: 'createCMSItem',
                input: {
                  collectionID: collectionID(step.collectionID),
                  fields: {
                    name: 'Draft from Mobileflow',
                    slug: `draft-${Math.floor(Date.now() / 1000)}`,
                  },
                },
              },
              siteID,
            ),
          );
          break;
        }
        case 'publishCMS': {
          const item = context.cmsItems?.find((entry) => entry.id === step.itemID);
          if (!item) break;
          if (item.collectionID !== step.collectionID) break;
          descriptors.push(
            policy.descriptor(
              {
                type: 'publishCMSItems',
                input: {
                  collectionID: collectionID(step.collectionID),
                  itemIDs: [item.id],
                },
              },
              siteID,
            ),
          );
          break;
        }
        case 'readSummary':
          descriptors.push(
            policy.descriptor({ type: 'readSiteSummary', siteID }, siteID),
          );
          break;
        case 'uploadAsset':
          descriptors.push(
            policy.descriptor(
              {
                type: 'uploadAsset',
                input: { siteID, fileName: 'from-phone.jpg' },
              },
              siteID,
            ),
          );
          break;
      }
    }

    if (descriptors.length === 0) return null;
    return newActionPlan({
      prompt,
      descriptors,
      source,
      rationale: rationale ?? null,
    });
  },

  collapsePublishSteps(
    steps: PlannedStep[],
    prompt: string,
    context: PlanningContext,
  ): PlannedStep[] {
    const nonPublish: PlannedStep[] = [];
    const pageIDs: string[] = [];
    let hasSite = false;

    for (const step of steps) {
      switch (step.kind) {
        case 'publishSite':
          hasSite = true;
          break;
        case 'publishPage':
          if (
            context.pages.some((p) => p.id === step.pageID) &&
            !pageIDs.includes(step.pageID)
          ) {
            pageIDs.push(step.pageID);
          }
          break;
        default:
          nonPublish.push(step);
      }
    }

    if (!hasSite && pageIDs.length === 0) return nonPublish;

    const normalized = prompt.toLowerCase();
    const prefersPage =
      normalized.includes('homepage') ||
      normalized.includes('home page') ||
      (normalized.includes('page') && !normalized.includes('pages'));

    let publishStep: PlannedStep;
    if (prefersPage) {
      if (pageIDs[0]) {
        publishStep = { kind: 'publishPage', pageID: pageIDs[0] };
      } else {
        const home = this.homepage(context);
        publishStep = home
          ? { kind: 'publishPage', pageID: home.id }
          : { kind: 'publishSite' };
      }
    } else if (hasSite) {
      publishStep = { kind: 'publishSite' };
    } else if (pageIDs[0]) {
      publishStep = { kind: 'publishPage', pageID: pageIDs[0] };
    } else {
      publishStep = { kind: 'publishSite' };
    }

    return [...nonPublish, publishStep];
  },

  homepage(context: PlanningContext): WebflowPage | undefined {
    return (
      context.pages.find((p) => p.pageType === 'home') ??
      context.pages.find((p) => p.slug === '' || p.slug === '/')
    );
  },
};

function isPublishCoolingDown(context: PlanningContext): boolean {
  if (!context.publishCooldownUntil) return false;
  return new Date(context.publishCooldownUntil).getTime() > Date.now();
}
