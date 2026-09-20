import type { PageMetadataDiff } from '../models/contentModels';
import {
  missingSEODescription,
  missingSEOTitle,
  type WebflowPage,
} from '../models/webflowModels';

/**
 * Build SEO metadata diffs for pages missing title/description.
 * Slug changes are excluded from batch drafts (high risk).
 */
export function buildMissingSEODiffs(pages: WebflowPage[]): PageMetadataDiff[] {
  const diffs: PageMetadataDiff[] = [];

  for (const page of pages) {
    if (missingSEOTitle(page)) {
      const proposed =
        page.seoTitle && page.seoTitle.trim() !== ''
          ? page.seoTitle
          : `${page.title} | ${page.slug === '' ? 'Home' : page.slug}`;
      diffs.push({
        pageID: page.id,
        pageTitle: page.title,
        field: 'seoTitle',
        currentValue: page.seoTitle ?? '',
        proposedValue: proposed,
        isAccepted: true,
      });
    }
    if (missingSEODescription(page)) {
      const proposed =
        page.seoDescription && page.seoDescription.trim() !== ''
          ? page.seoDescription
          : `Update the meta description for ${page.title}.`;
      diffs.push({
        pageID: page.id,
        pageTitle: page.title,
        field: 'seoDescription',
        currentValue: page.seoDescription ?? '',
        proposedValue: proposed,
        isAccepted: true,
      });
    }
  }

  return diffs;
}

/** Collapse accepted diffs into one UpdatePageMetadataInput per page. */
export function groupAcceptedMetadataUpdates(
  diffs: PageMetadataDiff[],
): Array<{
  pageID: PageMetadataDiff['pageID'];
  seoTitle?: string;
  seoDescription?: string;
}> {
  const byPage = new Map<
    string,
    { pageID: PageMetadataDiff['pageID']; seoTitle?: string; seoDescription?: string }
  >();

  for (const d of diffs) {
    if (!d.isAccepted) continue;
    if (d.field !== 'seoTitle' && d.field !== 'seoDescription') continue;
    const key = d.pageID as string;
    const existing = byPage.get(key) ?? { pageID: d.pageID };
    if (d.field === 'seoTitle') existing.seoTitle = d.proposedValue;
    if (d.field === 'seoDescription') existing.seoDescription = d.proposedValue;
    byPage.set(key, existing);
  }

  return Array.from(byPage.values());
}
