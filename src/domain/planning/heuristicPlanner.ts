import {
  newActionPlan,
  type ActionDescriptor,
} from '../actions/mobileflowAction';
import {
  missingSEODescription,
  missingSEOTitle,
} from '../models/webflowModels';
import { ConfirmationPolicy } from '../policies/confirmationPolicy';
import { PlannedCommandParser } from './plannedCommandParser';
import type { ActionPlanning, PlanningContext } from './planningTypes';

/** Deterministic keyword planner grounded in live pages/collections. */
export class HeuristicActionPlanner implements ActionPlanning {
  readonly policy = ConfirmationPolicy.default;

  async plan(prompt: string, context: PlanningContext) {
    return this.planSync(prompt, context);
  }

  planSync(prompt: string, context: PlanningContext) {
    const siteID = context.siteID;
    const normalized = prompt.toLowerCase();
    const descriptors: ActionDescriptor[] = [];

    if (
      normalized.includes('publish') &&
      (normalized.includes('cms') || normalized.includes('item'))
    ) {
      const draft = (context.cmsItems ?? []).find(
        (item) => item.isDraft && !item.isPublished,
      );
      const item =
        draft ??
        (context.cmsItems ?? []).find((entry) =>
          normalized.includes(entry.name.toLowerCase()),
        );
      if (item) {
        descriptors.push(
          this.policy.descriptor(
            {
              type: 'publishCMSItems',
              input: {
                collectionID: item.collectionID,
                itemIDs: [item.id],
              },
            },
            siteID,
          ),
        );
      }
    }

    if (descriptors.length > 0) {
      return newActionPlan({
        prompt,
        descriptors,
        source: 'heuristic',
      });
    }

    if (normalized.includes('publish') && descriptors.length === 0) {
      const wantsPage =
        normalized.includes('homepage') ||
        normalized.includes('home page') ||
        (normalized.includes('page') && !normalized.includes('pages'));
      if (wantsPage) {
        const page =
          PlannedCommandParser.homepage(context) ?? context.pages[0];
        if (page) {
          descriptors.push(
            this.policy.descriptor(
              {
                type: 'publishPage',
                input: {
                  siteID,
                  pageID: page.id,
                  customDomainIDs: [],
                  publishToWebflowSubdomain: true,
                },
              },
              siteID,
            ),
          );
        } else {
          descriptors.push(
            this.policy.descriptor(
              {
                type: 'publishSite',
                input: {
                  siteID,
                  customDomainIDs: [],
                  publishToWebflowSubdomain: true,
                },
              },
              siteID,
            ),
          );
        }
      } else {
        descriptors.push(
          this.policy.descriptor(
            {
              type: 'publishSite',
              input: {
                siteID,
                customDomainIDs: [],
                publishToWebflowSubdomain: true,
              },
            },
            siteID,
          ),
        );
      }
    } else if (
      normalized.includes('seo') ||
      normalized.includes('metadata') ||
      normalized.includes('title')
    ) {
      const candidates = context.pages.filter(
        (p) => missingSEOTitle(p) || missingSEODescription(p),
      );
      const targets =
        candidates.length === 0
          ? context.pages.slice(0, 3)
          : candidates.slice(0, 5);
      if (targets.length === 0) {
        descriptors.push(
          this.policy.descriptor({ type: 'readSiteSummary', siteID }, siteID),
        );
      } else {
        for (const page of targets) {
          const seoTitle =
            page.seoTitle && page.seoTitle.trim() !== ''
              ? page.seoTitle
              : `${page.title} | ${page.slug === '' ? 'Home' : page.slug}`;
          const seoDescription =
            page.seoDescription && page.seoDescription.trim() !== ''
              ? page.seoDescription
              : `Update the meta description for ${page.title}.`;
          descriptors.push(
            this.policy.descriptor(
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
        }
      }
    } else if (normalized.includes('cms') || normalized.includes('collection')) {
      const collection = context.collections[0];
      if (collection) {
        descriptors.push(
          this.policy.descriptor(
            {
              type: 'createCMSItem',
              input: {
                collectionID: collection.id,
                fields: {
                  name: 'Draft from Mobileflow',
                  slug: `draft-${Math.floor(Date.now() / 1000)}`,
                },
              },
            },
            siteID,
          ),
        );
      } else {
        descriptors.push(
          this.policy.descriptor({ type: 'readSiteSummary', siteID }, siteID),
        );
      }
    } else if (
      normalized.includes('asset') ||
      normalized.includes('photo') ||
      normalized.includes('image')
    ) {
      descriptors.push(
        this.policy.descriptor(
          {
            type: 'uploadAsset',
            input: { siteID, fileName: 'from-phone.jpg' },
          },
          siteID,
        ),
      );
    } else {
      descriptors.push(
        this.policy.descriptor({ type: 'readSiteSummary', siteID }, siteID),
      );
    }

    return newActionPlan({
      prompt,
      descriptors,
      source: 'heuristic',
    });
  }
}
