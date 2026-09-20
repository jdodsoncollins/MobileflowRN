import type { ActionPlan } from '../actions/mobileflowAction';
import type { SiteID } from '../models/ids';
import { HeuristicActionPlanner } from './heuristicPlanner';
import { OnDeviceActionPlanner } from './onDevicePlanner';
import {
  emptyPlanningContext,
  type PlanningContext,
} from './planningTypes';

export type {
  ActionPlanning,
  PlanningContext,
} from './planningTypes';
export {
  emptyPlanningContext,
  isPublishCoolingDown,
} from './planningTypes';
export { HeuristicActionPlanner } from './heuristicPlanner';
export type {
  PlannerCapability,
  OnDeviceAITier,
  OnDeviceCapabilityInfo,
} from './onDevicePlanner';
export {
  detectPlannerCapability,
  detectPlannerCapabilitySync,
  getOnDeviceCapabilityInfo,
} from './onDevicePlanner';

/**
 * Facade used by the app.
 *
 * iOS SwiftUI: optional Apple Intelligence when available.
 * RN: OnDeviceActionPlanner tries native module; always falls back to heuristic.
 * Unsupported devices hide on-device UI via detectPlannerCapability().
 */
export class ActionPlanner {
  private readonly heuristic = new HeuristicActionPlanner();
  private readonly onDevice = new OnDeviceActionPlanner();

  plan(prompt: string, siteID: SiteID): ActionPlan {
    return this.heuristic.planSync(prompt, emptyPlanningContext(siteID));
  }

  async planWithContext(
    prompt: string,
    context: PlanningContext,
  ): Promise<ActionPlan> {
    return this.onDevice.plan(prompt, context);
  }
}
