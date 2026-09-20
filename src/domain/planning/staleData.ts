import type { WebflowPage } from '../models/webflowModels';
import type { PageID } from '../models/ids';

export interface ContentFingerprint {
  generatedAt: string;
  pageCount: number;
  /** pageId → hash of seo/slug/draft flags */
  pageHashes: Record<string, string>;
}

export function hashPage(page: WebflowPage): string {
  return [
    page.id,
    page.title,
    page.slug,
    page.seoTitle ?? '',
    page.seoDescription ?? '',
    page.openGraphTitle ?? '',
    page.openGraphDescription ?? '',
    page.hasDraftChanges ? '1' : '0',
  ].join('|');
}

export function buildContentFingerprint(pages: WebflowPage[]): ContentFingerprint {
  const pageHashes: Record<string, string> = {};
  for (const p of pages) {
    pageHashes[p.id] = hashPage(p);
  }
  return {
    generatedAt: new Date().toISOString(),
    pageCount: pages.length,
    pageHashes,
  };
}

export function detectStalePages(
  baseline: ContentFingerprint,
  currentPages: WebflowPage[],
): PageID[] {
  const stale: PageID[] = [];
  for (const p of currentPages) {
    const prev = baseline.pageHashes[p.id];
    if (prev == null) continue; // new page — not stale vs proposal
    if (prev !== hashPage(p)) stale.push(p.id);
  }
  return stale;
}

export function isFingerprintStale(
  baseline: ContentFingerprint,
  currentPages: WebflowPage[],
): boolean {
  if (baseline.pageCount !== currentPages.length) return true;
  return detectStalePages(baseline, currentPages).length > 0;
}
