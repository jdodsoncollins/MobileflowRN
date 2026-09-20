import { describe, expect, it } from 'vitest';
import { commentPlainText } from '../src/domain/models/webflowModels';
import { parseAnalyzeSnapshot } from '../src/domain/planning/siteAnalyze';

describe('parseAnalyzeSnapshot', () => {
  it('marks the add-on as unavailable from an error payload', () => {
    const snap = parseAnalyzeSnapshot({
      error: 'Analyze add-on is not enabled',
    });
    expect(snap.status).toBe('unavailable');
  });

  it('maps top pages and session counts', () => {
    const snap = parseAnalyzeSnapshot({
      sessions: 1280,
      pages: [
        { path: '/', count: 400 },
        { path: '/blog', sessions: 220 },
      ],
    });
    expect(snap.status).toBe('ready');
    expect(snap.sessions).toBe(1280);
    expect(snap.topPages[0]?.path).toBe('/');
  });
});

describe('commentPlainText', () => {
  it('strips mention tokens', () => {
    expect(
      commentPlainText('Ship it [[6287ec36a841b25637c663df]] today'),
    ).toBe('Ship it today');
  });
});
