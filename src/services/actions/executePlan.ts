import type {
  ActionDescriptor,
  ActionPlan,
  ConfirmationRequirement,
} from '../../domain/actions/mobileflowAction';
import type { ActivityItem } from '../../domain/models/webflowModels';
import type { SiteID } from '../../domain/models/ids';
import type { ActionExecutor } from './liveActionExecutor';

const HARD: ConfirmationRequirement[] = ['hardConfirm', 'destructiveConfirm'];

export function planNeedsHardConfirm(plan: ActionPlan): ActionDescriptor | null {
  return plan.descriptors.find((d) => HARD.includes(d.confirmation)) ?? null;
}

export interface ExecutePlanResult {
  items: ActivityItem[];
  completed: number;
  failed: number;
  storageWarning: string | null;
}

/**
 * Runs each approved descriptor through the live executor in order.
 * Records every result (success or failure) — never pretends success.
 */
export async function executeApprovedPlan(
  plan: ActionPlan,
  executor: ActionExecutor,
  opts?: {
    /** When false, throw if any step needs hard confirm (caller should prompt). */
    hardConfirmAcknowledged?: boolean;
  },
): Promise<ExecutePlanResult> {
  if (!opts?.hardConfirmAcknowledged) {
    const hard = planNeedsHardConfirm(plan);
    if (hard) {
      throw new HardConfirmRequiredError(hard);
    }
  }

  const items: ActivityItem[] = [];
  let completed = 0;
  let failed = 0;

  for (const descriptor of plan.descriptors) {
    const item = await executor.execute(descriptor);
    items.push(item);
    if (item.status === 'completed') completed += 1;
    else if (item.status === 'failed') failed += 1;
  }

  return { items, completed, failed, storageWarning: null };
}

export function assertPlanTargetsSite(
  plan: ActionPlan,
  selectedSiteID: SiteID | null,
): SiteID {
  if (!selectedSiteID) {
    throw new Error('Select a site before executing a plan.');
  }
  if (plan.descriptors.some((descriptor) => descriptor.siteID !== selectedSiteID)) {
    throw new Error(
      'This plan targets a different site. Review it again for the selected site.',
    );
  }
  return selectedSiteID;
}

export function attributeActivityToPlan(
  items: ActivityItem[],
  plan: ActionPlan,
  planSiteID: SiteID,
): ActivityItem[] {
  return items.map((item, index) => ({
    ...item,
    siteID: plan.descriptors[index]?.siteID ?? planSiteID,
  }));
}

export class HardConfirmRequiredError extends Error {
  readonly descriptor: ActionDescriptor;

  constructor(descriptor: ActionDescriptor) {
    super(
      `Hard confirmation required for: ${descriptor.title}`,
    );
    this.name = 'HardConfirmRequiredError';
    this.descriptor = descriptor;
  }
}
