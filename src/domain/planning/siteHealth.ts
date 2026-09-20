import type { PageID, SiteID } from '../models/ids';
import {
  LARGE_ASSET_BYTES,
  type WebflowAsset,
} from '../models/contentModels';
import type {
  WebflowCMSItem,
  WebflowCollection,
  WebflowPage,
  WebflowSite,
} from '../models/webflowModels';
import {
  missingSEODescription,
  missingSEOTitle,
} from '../models/webflowModels';

export type HealthSeverity = 'info' | 'low' | 'medium' | 'high';
export type HealthCategory =
  | 'seo'
  | 'cms'
  | 'publish'
  | 'structure'
  | 'locale'
  | 'assets';

export interface HealthFinding {
  id: string;
  category: HealthCategory;
  severity: HealthSeverity;
  title: string;
  evidence: string;
  suggestedFix: string;
  /** Optional machine-readable fix hint for batch planning. */
  fixKind?:
    | 'seoTitle'
    | 'seoDescription'
    | 'openGraph'
    | 'slugReview'
    | 'cmsField'
    | 'publish'
    | 'assetAlt'
    | 'none';
  pageID?: PageID | null;
  collectionID?: string | null;
  itemID?: string | null;
  currentValue?: string | null;
  proposedValue?: string | null;
}

export interface SiteHealthSnapshot {
  siteID: SiteID;
  siteName: string;
  generatedAt: string;
  score: number; // 0–100 completeness-ish score
  findings: HealthFinding[];
  counts: {
    pages: number;
    collections: number;
    cmsItems: number;
    assets: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

const SEO_TITLE_MAX = 60;
const SEO_DESC_MAX = 160;

export function buildSiteHealthSnapshot(args: {
  site: WebflowSite;
  pages: WebflowPage[];
  collections: WebflowCollection[];
  cmsItems: WebflowCMSItem[];
  assets?: WebflowAsset[];
  now?: Date;
}): SiteHealthSnapshot {
  const now = args.now ?? new Date();
  const findings: HealthFinding[] = [];
  const { site, pages, collections, cmsItems } = args;
  const assets = args.assets ?? [];

  // --- Page SEO ---
  const titles = new Map<string, PageID[]>();
  const descs = new Map<string, PageID[]>();

  for (const page of pages) {
    if (missingSEOTitle(page)) {
      findings.push({
        id: `seo-title-missing-${page.id}`,
        category: 'seo',
        severity: 'medium',
        title: 'Missing SEO title',
        evidence: `Page "${page.title}" (${page.id}) has no SEO title.`,
        suggestedFix: 'Draft an SEO title from the page name and slug.',
        fixKind: 'seoTitle',
        pageID: page.id,
        currentValue: '',
        proposedValue: `${page.title} | ${page.slug || 'Home'}`,
      });
    } else if ((page.seoTitle?.length ?? 0) > SEO_TITLE_MAX) {
      findings.push({
        id: `seo-title-long-${page.id}`,
        category: 'seo',
        severity: 'low',
        title: 'SEO title may be too long',
        evidence: `"${page.seoTitle}" is ${page.seoTitle!.length} chars (guideline <= ${SEO_TITLE_MAX}).`,
        suggestedFix: 'Shorten to ~50–60 characters while keeping intent.',
        fixKind: 'seoTitle',
        pageID: page.id,
        currentValue: page.seoTitle,
        proposedValue: page.seoTitle!.slice(0, SEO_TITLE_MAX - 1).trim(),
      });
    }

    if (missingSEODescription(page)) {
      findings.push({
        id: `seo-desc-missing-${page.id}`,
        category: 'seo',
        severity: 'medium',
        title: 'Missing meta description',
        evidence: `Page "${page.title}" has no meta description.`,
        suggestedFix: 'Draft a concise meta description for search snippets.',
        fixKind: 'seoDescription',
        pageID: page.id,
        currentValue: '',
        proposedValue: `Learn more about ${page.title}.`,
      });
    } else if ((page.seoDescription?.length ?? 0) > SEO_DESC_MAX) {
      findings.push({
        id: `seo-desc-long-${page.id}`,
        category: 'seo',
        severity: 'low',
        title: 'Meta description may be too long',
        evidence: `Description is ${page.seoDescription!.length} chars (guideline <= ${SEO_DESC_MAX}).`,
        suggestedFix: 'Trim to ~150–160 characters.',
        fixKind: 'seoDescription',
        pageID: page.id,
        currentValue: page.seoDescription,
        proposedValue: page.seoDescription!.slice(0, SEO_DESC_MAX - 1).trim(),
      });
    }

    if (!page.openGraphTitle && !page.openGraphDescription) {
      findings.push({
        id: `og-missing-${page.id}`,
        category: 'seo',
        severity: 'info',
        title: 'Missing Open Graph metadata',
        evidence: `Page "${page.title}" has no OG title or description.`,
        suggestedFix: 'Mirror SEO title/description into Open Graph fields.',
        fixKind: 'openGraph',
        pageID: page.id,
      });
    }

    if (page.hasDraftChanges) {
      findings.push({
        id: `draft-changes-${page.id}`,
        category: 'publish',
        severity: 'low',
        title: 'Unpublished draft changes',
        evidence: `Page "${page.title}" reports draft changes.`,
        suggestedFix: 'Review and publish when ready.',
        fixKind: 'publish',
        pageID: page.id,
      });
    }

    if (page.slug.includes(' ') || page.slug.includes('_')) {
      findings.push({
        id: `slug-suspicious-${page.id}`,
        category: 'structure',
        severity: 'low',
        title: 'Suspicious slug',
        evidence: `Slug "${page.slug}" contains spaces or underscores.`,
        suggestedFix: 'Prefer kebab-case slugs; changing slugs is high risk.',
        fixKind: 'slugReview',
        pageID: page.id,
        currentValue: page.slug,
      });
    }

    const t = (page.seoTitle ?? '').trim().toLowerCase();
    if (t) {
      const list = titles.get(t) ?? [];
      list.push(page.id);
      titles.set(t, list);
    }
    const d = (page.seoDescription ?? '').trim().toLowerCase();
    if (d) {
      const list = descs.get(d) ?? [];
      list.push(page.id);
      descs.set(d, list);
    }
  }

  for (const [title, ids] of titles) {
    if (ids.length < 2) continue;
    findings.push({
      id: `dup-title-${title.slice(0, 24)}`,
      category: 'seo',
      severity: 'medium',
      title: 'Duplicate SEO titles',
      evidence: `${ids.length} pages share title "${title}".`,
      suggestedFix: 'Make titles unique per page.',
      fixKind: 'seoTitle',
      pageID: ids[0],
    });
  }
  for (const [desc, ids] of descs) {
    if (ids.length < 2) continue;
    findings.push({
      id: `dup-desc-${desc.slice(0, 24)}`,
      category: 'seo',
      severity: 'low',
      title: 'Duplicate meta descriptions',
      evidence: `${ids.length} pages share the same description.`,
      suggestedFix: 'Differentiate descriptions.',
      fixKind: 'seoDescription',
      pageID: ids[0],
    });
  }

  // --- CMS ---
  for (const item of cmsItems) {
    if (!item.slug.trim()) {
      findings.push({
        id: `cms-slug-empty-${item.id}`,
        category: 'cms',
        severity: 'medium',
        title: 'CMS item missing slug',
        evidence: `Item "${item.name}" has an empty slug.`,
        suggestedFix: 'Set a unique kebab-case slug.',
        fixKind: 'cmsField',
        itemID: item.id,
        collectionID: item.collectionID,
        currentValue: '',
      });
    }
    if (item.missingFields.length > 0) {
      findings.push({
        id: `cms-missing-${item.id}`,
        category: 'cms',
        severity: 'medium',
        title: 'CMS item has incomplete fields',
        evidence: `"${item.name}" missing: ${item.missingFields.join(', ')}.`,
        suggestedFix: 'Fill required-looking fields before publish.',
        fixKind: 'cmsField',
        itemID: item.id,
        collectionID: item.collectionID,
      });
    }
    if (item.isDraft && !item.isPublished) {
      findings.push({
        id: `cms-draft-${item.id}`,
        category: 'cms',
        severity: 'info',
        title: 'Draft CMS item',
        evidence: `"${item.name}" is draft-only.`,
        suggestedFix: 'Publish when content is ready.',
        fixKind: 'publish',
        itemID: item.id,
        collectionID: item.collectionID,
      });
    }
  }

  const cmsSlugs = new Map<string, string[]>();
  for (const item of cmsItems) {
    const s = item.slug.trim().toLowerCase();
    if (!s) continue;
    const list = cmsSlugs.get(s) ?? [];
    list.push(item.id);
    cmsSlugs.set(s, list);
  }
  for (const [slug, ids] of cmsSlugs) {
    if (ids.length < 2) continue;
    findings.push({
      id: `cms-dup-slug-${slug}`,
      category: 'cms',
      severity: 'high',
      title: 'Duplicate CMS slugs',
      evidence: `${ids.length} items share slug "${slug}".`,
      suggestedFix: 'Ensure slugs are unique within the collection.',
      fixKind: 'cmsField',
      itemID: ids[0],
    });
  }

  for (const asset of assets) {
    const isImage = (asset.contentType || '').startsWith('image/');
    if (!isImage) continue;
    if (!asset.altText || asset.altText.trim() === '') {
      findings.push({
        id: `asset-alt-${asset.id}`,
        category: 'assets',
        severity: 'low',
        title: 'Image missing alt text',
        evidence: `"${asset.fileName}" has no alternative text.`,
        suggestedFix: 'Add alt text in Webflow or replace the asset.',
        fixKind: 'assetAlt',
      });
    }
    if ((asset.sizeBytes ?? 0) >= LARGE_ASSET_BYTES) {
      const kb = Math.round((asset.sizeBytes ?? 0) / 1024);
      findings.push({
        id: `asset-large-${asset.id}`,
        category: 'assets',
        severity: 'medium',
        title: 'Large image asset',
        evidence: `"${asset.fileName}" is ${kb} KB (guideline < 500 KB).`,
        suggestedFix: 'Compress to WebP or AVIF in Webflow before the next publish.',
        fixKind: 'none',
      });
    }
  }

  // --- Site level ---
  if (site.draftChangesCount > 0) {
    findings.push({
      id: 'site-draft-changes',
      category: 'publish',
      severity: 'info',
      title: 'Site has draft changes',
      evidence: `draftChangesCount=${site.draftChangesCount}.`,
      suggestedFix: 'Review and publish when ready.',
      fixKind: 'publish',
    });
  }
  if (!site.lastPublished) {
    findings.push({
      id: 'site-never-published',
      category: 'publish',
      severity: 'medium',
      title: 'Site may never have been published',
      evidence: 'lastPublished is empty.',
      suggestedFix: 'Publish when the first version is ready.',
      fixKind: 'publish',
    });
  }
  if (site.customDomains.length === 0) {
    findings.push({
      id: 'site-no-custom-domain',
      category: 'structure',
      severity: 'info',
      title: 'No custom domains on site record',
      evidence: 'customDomains is empty (Webflow subdomain may still work).',
      suggestedFix: 'Confirm domains in Webflow Dashboard if expected.',
      fixKind: 'none',
    });
  }
  if (collections.length === 0 && pages.length > 0) {
    findings.push({
      id: 'site-no-collections',
      category: 'cms',
      severity: 'info',
      title: 'No CMS collections loaded',
      evidence: 'Collection list is empty for this site load.',
      suggestedFix: 'Confirm CMS is used; otherwise ignore.',
      fixKind: 'none',
    });
  }

  const high = findings.filter((f) => f.severity === 'high').length;
  const medium = findings.filter((f) => f.severity === 'medium').length;
  const low = findings.filter((f) => f.severity === 'low').length;
  const info = findings.filter((f) => f.severity === 'info').length;

  // Score: start 100, deduct by severity
  let score = 100;
  score -= high * 15;
  score -= medium * 8;
  score -= low * 3;
  score -= info * 1;
  score = Math.max(0, Math.min(100, score));

  void now;

  return {
    siteID: site.id,
    siteName: site.name,
    generatedAt: (args.now ?? new Date()).toISOString(),
    score,
    findings,
    counts: {
      pages: pages.length,
      collections: collections.length,
      cmsItems: cmsItems.length,
      assets: assets.length,
      high,
      medium,
      low,
      info,
    },
  };
}

/** Convert selected health findings into page metadata proposals for batch review. */
export function findingsToMetadataProposals(
  findings: HealthFinding[],
): Array<{
  pageID: PageID;
  field: 'seoTitle' | 'seoDescription';
  currentValue: string;
  proposedValue: string;
  findingId: string;
}> {
  const out: Array<{
    pageID: PageID;
    field: 'seoTitle' | 'seoDescription';
    currentValue: string;
    proposedValue: string;
    findingId: string;
  }> = [];
  for (const f of findings) {
    if (!f.pageID || !f.proposedValue) continue;
    if (f.fixKind === 'seoTitle') {
      out.push({
        pageID: f.pageID,
        field: 'seoTitle',
        currentValue: f.currentValue ?? '',
        proposedValue: f.proposedValue,
        findingId: f.id,
      });
    } else if (f.fixKind === 'seoDescription') {
      out.push({
        pageID: f.pageID,
        field: 'seoDescription',
        currentValue: f.currentValue ?? '',
        proposedValue: f.proposedValue,
        findingId: f.id,
      });
    }
  }
  return out;
}
