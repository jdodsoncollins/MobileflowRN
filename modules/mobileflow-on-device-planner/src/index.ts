import { requireNativeModule, Platform } from 'expo';

export type OnDeviceAITier =
  | 'none'
  | 'appleIntelligence'
  | 'geminiNano'
  | 'geminiNanoHigh';

export interface OnDeviceCapability {
  available: boolean;
  tier: OnDeviceAITier;
  platform: string;
  modelLabel: string | null;
  /** Max approximate context tokens the backend claims (0 if unknown). */
  maxContextTokens: number;
  detail: string;
}

type NativeModuleShape = {
  getCapability(): Promise<OnDeviceCapability>;
  isAvailable(): Promise<boolean>;
  planCommandLines(prompt: string, contextJSON: string): Promise<string | null>;
};

let Native: NativeModuleShape | null = null;
try {
  Native = requireNativeModule<NativeModuleShape>(
    'MobileflowOnDevicePlanner',
  );
} catch {
  Native = null;
}

export function isNativePlannerLinked(): boolean {
  return Native != null;
}

export async function getOnDeviceCapability(): Promise<OnDeviceCapability> {
  if (!Native) {
    return {
      available: false,
      tier: 'none',
      platform: Platform.OS,
      modelLabel: null,
      maxContextTokens: 0,
      detail:
        'Native module not linked (Expo Go or missing prebuild). Using heuristic planner.',
    };
  }
  return Native.getCapability();
}

export async function isOnDeviceAvailable(): Promise<boolean> {
  if (!Native) return false;
  try {
    return await Native.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Ask the on-device model for PlannedCommandParser command lines.
 * Returns null when unavailable or generation fails (caller uses heuristic).
 */
export async function planCommandLinesNative(
  prompt: string,
  contextJSON: string,
): Promise<string | null> {
  if (!Native) return null;
  try {
    const available = await Native.isAvailable();
    if (!available) return null;
    return await Native.planCommandLines(prompt, contextJSON);
  } catch {
    return null;
  }
}
