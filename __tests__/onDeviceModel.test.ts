import { describe, expect, it } from 'vitest';
import {
  COMMAND_LINES_SCHEMA,
  onDevicePrivacyLine,
  platformOnDeviceKind,
  probeOnDeviceAvailable,
} from '../src/services/ai/onDeviceModel';

describe('on-device model kit', () => {
  it('describes allowed command heads including CMS item publish', () => {
    expect(COMMAND_LINES_SCHEMA.properties?.lines?.description).toContain(
      'PUBLISH_CMS',
    );
  });

  it('reports Apple Intelligence on the iOS test stub', () => {
    expect(platformOnDeviceKind()).toBe('apple-foundation');
    expect(onDevicePrivacyLine('apple-foundation')).toContain(
      'Apple Intelligence',
    );
    expect(onDevicePrivacyLine('gemini-nano')).toContain('Gemini Nano');
    expect(onDevicePrivacyLine(null)).toBeNull();
  });

  it('is unavailable without a linked Expo AI kit', async () => {
    expect(await probeOnDeviceAvailable()).toBe(false);
  });
});
