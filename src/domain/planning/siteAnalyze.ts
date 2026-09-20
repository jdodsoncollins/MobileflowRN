export type AnalyzeStatus = 'unavailable' | 'empty' | 'ready';

export interface AnalyzeTopPage {
  path: string;
  count: number;
}

export interface SiteAnalyzeSnapshot {
  status: AnalyzeStatus;
  detail: string;
  sessions: number | null;
  topPages: AnalyzeTopPage[];
}

export function emptyAnalyzeSnapshot(
  status: AnalyzeStatus,
  detail: string,
): SiteAnalyzeSnapshot {
  return { status, detail, sessions: null, topPages: [] };
}

export function parseAnalyzeSnapshot(payload: unknown): SiteAnalyzeSnapshot {
  if (payload == null || typeof payload !== 'object') {
    return emptyAnalyzeSnapshot(
      'unavailable',
      'Analyze did not return a report for this site.',
    );
  }
  const record = payload as Record<string, unknown>;
  const error = stringish(record.error ?? record.message);
  if (error && /add-on|not enabled|unavailable|forbidden/i.test(error)) {
    return emptyAnalyzeSnapshot(
      'unavailable',
      'Webflow Analyze is not enabled for this site.',
    );
  }
  const sessions = firstNumber(record, [
    'sessions',
    'sessionCount',
    'users',
    'pageviews',
  ]);
  const rows = firstArray(record, ['pages', 'topPages', 'rows', 'items', 'data']);
  const topPages: AnalyzeTopPage[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const path =
      stringish(item.path ?? item.page ?? item.url ?? item.name) ?? '';
    const count = firstNumber(item, ['count', 'sessions', 'pageviews', 'value']);
    if (!path) continue;
    topPages.push({ path, count: count ?? 0 });
  }
  if (sessions == null && topPages.length === 0) {
    return emptyAnalyzeSnapshot('empty', 'No Analyze traffic in the last 7 days.');
  }
  return {
    status: 'ready',
    detail: 'Last 7 days',
    sessions,
    topPages: topPages.slice(0, 5),
  };
}

function stringish(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstNumber(
  record: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function firstArray(
  record: Record<string, unknown>,
  keys: string[],
): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}
