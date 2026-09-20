import { newActionPlan, type ActionPlan } from '../actions/mobileflowAction';
import { HeuristicActionPlanner } from './heuristicPlanner';
import { PlannedCommandParser } from './plannedCommandParser';
import type { ActionPlanning, PlanningContext } from './planningTypes';

export type PlannerCapability = 'heuristicOnly' | 'onDeviceAvailable';

export type OnDeviceAITier =
  | 'none'
  | 'appleIntelligence'
  | 'geminiNano'
  | 'geminiNanoHigh';

export interface OnDeviceCapabilityInfo {
  available: boolean;
  tier: OnDeviceAITier;
  platform: string;
  modelLabel: string | null;
  maxContextTokens: number;
  detail: string;
}

/**
 * Optional native backend (iOS Apple Intelligence / Android Gemini Nano).
 * Absent ⇒ heuristic only; feature UI stays hidden.
 */
export interface OnDevicePlannerNative {
  isAvailable(): Promise<boolean>;
  /**
   * Return free-text command lines parseable by PlannedCommandParser
   * (PUBLISH_SITE, SEO_FIX pageId, …).
   */
  planCommandLines(prompt: string, contextJSON: string): Promise<string | null>;
  getCapability?(): Promise<OnDeviceCapabilityInfo>;
}

declare global {
  // eslint-disable-next-line no-var
  var __MOBILEFLOW_ON_DEVICE_PLANNER__: OnDevicePlannerNative | undefined;
}

function getNativePlanner(): OnDevicePlannerNative | null {
  if (globalThis.__MOBILEFLOW_ON_DEVICE_PLANNER__) {
    return globalThis.__MOBILEFLOW_ON_DEVICE_PLANNER__;
  }

  // Expo local module (linked after prebuild / dev client)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('mobileflow-on-device-planner') as {
      isOnDeviceAvailable?: () => Promise<boolean>;
      planCommandLinesNative?: (
        prompt: string,
        contextJSON: string,
      ) => Promise<string | null>;
      getOnDeviceCapability?: () => Promise<OnDeviceCapabilityInfo>;
      isNativePlannerLinked?: () => boolean;
    };
    if (mod?.isNativePlannerLinked?.() && mod.isOnDeviceAvailable) {
      return {
        isAvailable: () => mod.isOnDeviceAvailable!(),
        planCommandLines: (p, c) =>
          mod.planCommandLinesNative?.(p, c) ?? Promise.resolve(null),
        getCapability: mod.getOnDeviceCapability
          ? () => mod.getOnDeviceCapability!()
          : undefined,
      };
    }
  } catch {
    // Expo Go / tests without native module
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeModules } = require('react-native') as {
      NativeModules: { MobileflowOnDevicePlanner?: OnDevicePlannerNative };
    };
    return NativeModules.MobileflowOnDevicePlanner ?? null;
  } catch {
    return null;
  }
}

/**
 * Runtime probe. Unsupported devices → heuristicOnly (hide on-device UI).
 */
export async function detectPlannerCapability(): Promise<PlannerCapability> {
  const native = getNativePlanner();
  if (native) {
    try {
      if (await native.isAvailable()) return 'onDeviceAvailable';
    } catch {
      // continue to OS kit
    }
  }
  try {
    const { probeOnDeviceAvailable } = await import(
      '../../services/ai/onDeviceModel'
    );
    if (await probeOnDeviceAvailable()) return 'onDeviceAvailable';
  } catch {
    // Expo Go / tests
  }
  return 'heuristicOnly';
}

async function kitCapabilityInfo(): Promise<OnDeviceCapabilityInfo | null> {
  try {
    const { probeOnDeviceAvailable, platformOnDeviceKind } = await import(
      '../../services/ai/onDeviceModel'
    );
    if (!(await probeOnDeviceAvailable())) return null;
    const kind = platformOnDeviceKind();
    return {
      available: true,
      tier: kind === 'apple-foundation' ? 'appleIntelligence' : 'geminiNano',
      platform: kind === 'apple-foundation' ? 'ios' : 'android',
      modelLabel:
        kind === 'apple-foundation'
          ? 'Apple Intelligence (on-device)'
          : 'Gemini Nano (on-device)',
      maxContextTokens: 4096,
      detail: 'OS built-in model available. Plans use loaded IDs only.',
    };
  } catch {
    return null;
  }
}

export async function getOnDeviceCapabilityInfo(): Promise<OnDeviceCapabilityInfo> {
  const native = getNativePlanner();
  if (native?.getCapability) {
    try {
      const info = await native.getCapability();
      if (info.available) return info;
    } catch {
      // fall through
    }
  }
  if (native) {
    const available = await native.isAvailable().catch(() => false);
    if (available) {
      return {
        available: true,
        tier: 'geminiNano',
        platform: 'native',
        modelLabel: 'On-device model',
        maxContextTokens: 2048,
        detail: 'On-device model available.',
      };
    }
  }
  const kit = await kitCapabilityInfo();
  if (kit) return kit;
  return {
    available: false,
    tier: 'none',
    platform: 'unknown',
    modelLabel: null,
    maxContextTokens: 0,
    detail:
      'On-device model not available. Keyword planner remains available.',
  };
}

/** Sync snapshot for first paint; prefer async detect for accuracy. */
export function detectPlannerCapabilitySync(): PlannerCapability {
  if (globalThis.__MOBILEFLOW_ON_DEVICE_PLANNER__) {
    return 'onDeviceAvailable';
  }
  return 'heuristicOnly';
}

/**
 * Tries on-device model when available; always falls back to heuristic.
 * Output must ground through PlannedCommandParser (loaded IDs only).
 */
export class OnDeviceActionPlanner implements ActionPlanning {
  private readonly fallback = new HeuristicActionPlanner();

  async plan(prompt: string, context: PlanningContext): Promise<ActionPlan> {
    const native = getNativePlanner();
    if (native) {
      try {
        const available = await native.isAvailable();
        if (available) {
          const lines = await native.planCommandLines(
            prompt,
            JSON.stringify({
              siteID: context.siteID,
              pageIDs: context.pages.map((p) => p.id),
              collectionIDs: context.collections.map((c) => c.id),
              agentInstructions: context.agentInstructions ?? null,
            }),
          );
          if (lines) {
            const source =
              (await native.getCapability?.())?.tier === 'appleIntelligence'
                ? 'foundationModels'
                : 'onDevice';
            const parsed = PlannedCommandParser.planFromCommandLines(
              lines,
              prompt,
              context,
              source,
            );
            if (parsed && parsed.descriptors.length > 0) {
              return parsed;
            }
          }
        }
      } catch {
        // fall through to OS kit
      }
    }
    try {
      const { generateCommandLinesWithKit } = await import(
        '../../services/ai/onDeviceModel'
      );
      const lines = await generateCommandLinesWithKit(
        prompt,
        JSON.stringify({
          siteID: context.siteID,
          pageIDs: context.pages.map((p) => p.id),
          collectionIDs: context.collections.map((c) => c.id),
          itemIDs: (context.cmsItems ?? []).map((item) => item.id),
          agentInstructions: context.agentInstructions ?? null,
        }),
      );
      if (lines) {
        const parsed = PlannedCommandParser.planFromCommandLines(
          lines,
          prompt,
          context,
          'foundationModels',
        );
        if (parsed && parsed.descriptors.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fall through
    }
    const heuristic = await this.fallback.plan(prompt, context);
    return newActionPlan({
      id: heuristic.id,
      prompt: heuristic.prompt,
      descriptors: heuristic.descriptors,
      createdAt: heuristic.createdAt,
      source: 'heuristic',
      rationale: heuristic.rationale,
    });
  }
}
