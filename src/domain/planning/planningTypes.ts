import type { ActionPlan } from '../actions/mobileflowAction';
import type { SiteID } from '../models/ids';
import type {
  WebflowCMSItem,
  WebflowCollection,
  WebflowPage,
} from '../models/webflowModels';

/** Context for planning from live site data (never preview fixtures on live paths). */
export interface PlanningContext {
  siteID: SiteID;
  pages: WebflowPage[];
  collections: WebflowCollection[];
  cmsItems?: WebflowCMSItem[];
  agentInstructions?: string | null;
  /** ISO date when set and in the future — planners prefer non-publish steps. */
  publishCooldownUntil?: string | null;
}

export function emptyPlanningContext(siteID: SiteID): PlanningContext {
  return {
    siteID,
    pages: [],
    collections: [],
    cmsItems: [],
    agentInstructions: null,
    publishCooldownUntil: null,
  };
}

export function isPublishCoolingDown(
  context: PlanningContext,
  now = Date.now(),
): boolean {
  if (!context.publishCooldownUntil) return false;
  return new Date(context.publishCooldownUntil).getTime() > now;
}

export interface ActionPlanning {
  plan(prompt: string, context: PlanningContext): Promise<ActionPlan>;
}
