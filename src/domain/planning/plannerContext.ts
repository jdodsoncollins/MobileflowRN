import type { PlanningContext } from './planningTypes';
import type { SiteHealthSnapshot } from './siteHealth';

/**
 * Bounded context for on-device / heuristic planning (never invents IDs).
 * Keep small for SLM token budgets.
 */
export function buildBoundedPlannerContextJSON(args: {
  context: PlanningContext;
  health?: SiteHealthSnapshot | null;
  maxPages?: number;
  maxCollections?: number;
  maxFindings?: number;
}): string {
  const maxPages = args.maxPages ?? 24;
  const maxCollections = args.maxCollections ?? 12;
  const maxFindings = args.maxFindings ?? 12;
  const { context, health } = args;

  const pages = context.pages.slice(0, maxPages).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    type: p.pageType,
    locale: p.locale,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription
      ? p.seoDescription.slice(0, 120)
      : null,
    missingSeoTitle: !p.seoTitle || p.seoTitle.trim() === '',
    missingSeoDescription:
      !p.seoDescription || p.seoDescription.trim() === '',
    hasDraftChanges: p.hasDraftChanges,
  }));

  const collections = context.collections.slice(0, maxCollections).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));

  const findings =
    health?.findings.slice(0, maxFindings).map((f) => ({
      id: f.id,
      severity: f.severity,
      title: f.title,
      pageID: f.pageID ?? null,
      fixKind: f.fixKind ?? null,
    })) ?? [];

  return JSON.stringify({
    siteID: context.siteID,
    agentInstructions: context.agentInstructions ?? null,
    publishCooldownUntil: context.publishCooldownUntil ?? null,
    rules: {
      seoTitleMax: 60,
      seoDescriptionMax: 160,
      neverInventIds: true,
    },
    pages,
    collections,
    healthScore: health?.score ?? null,
    findings,
  });
}
