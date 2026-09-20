import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { JSONSchema } from 'expo-ai-kit';

const SYSTEM_PROMPT =
  'You write Mobileflow command lines from structured site context. Output JSON only. Never invent IDs. Never output tokens or secrets.';

export const COMMAND_LINES_SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    lines: {
      type: 'string',
      description:
        'One command per line. Allowed heads: PUBLISH_SITE, PUBLISH_PAGE <pageId>, SEO_FIX <pageId>, CMS_DRAFT <collectionId>, PUBLISH_CMS <collectionId> <itemId>, READ_SUMMARY, UPLOAD_ASSET. Use only IDs from context.',
    },
  },
  required: ['lines'],
};

export function platformOnDeviceKind(): 'apple-foundation' | 'gemini-nano' | null {
  if (Platform.OS === 'ios') return 'apple-foundation';
  if (Platform.OS === 'android') return 'gemini-nano';
  return null;
}

function nativeKitLinked(): boolean {
  try {
    return requireOptionalNativeModule('ExpoAiKit') != null;
  } catch {
    return false;
  }
}

export async function probeOnDeviceAvailable(): Promise<boolean> {
  if (!platformOnDeviceKind() || !nativeKitLinked()) return false;
  try {
    const kit = await import('expo-ai-kit');
    return await kit.isAvailable();
  } catch {
    return false;
  }
}

export async function generateCommandLinesWithKit(
  prompt: string,
  contextJSON: string,
): Promise<string | null> {
  if (!platformOnDeviceKind() || !nativeKitLinked()) return null;
  try {
    const kit = await import('expo-ai-kit');
    if (!(await kit.isAvailable())) return null;
    await kit.prepareBuiltInModel();
    const result = await kit.generateObject<{ lines?: string }>(
      [
        {
          role: 'user',
          content: `User request: ${prompt}\n\nLoaded context JSON:\n${contextJSON}`,
        },
      ],
      COMMAND_LINES_SCHEMA,
      { systemPrompt: SYSTEM_PROMPT, maxRepairAttempts: 1 },
    );
    const lines = result.object?.lines?.trim();
    return lines || null;
  } catch {
    return null;
  }
}

export function onDevicePrivacyLine(
  kind: 'apple-foundation' | 'gemini-nano' | null = platformOnDeviceKind(),
): string | null {
  if (kind === 'apple-foundation') {
    return 'Apple Intelligence plans stay on this device.';
  }
  if (kind === 'gemini-nano') {
    return 'Gemini Nano runs on this device — private and offline.';
  }
  return null;
}
