import {
  missingSEODescription,
  missingSEOTitle,
} from '../models/webflowModels';
import {
  isPublishCoolingDown,
  type PlanningContext,
} from './planningTypes';

/** Grounded command chips: ops that work from loaded Data API context. */
export const CommandSuggestions = {
  forContext(context: PlanningContext): string[] {
    let suggestions: string[] = [];

    if (
      context.pages.some(
        (p) => p.pageType === 'home' || p.slug === '' || p.slug === '/',
      )
    ) {
      suggestions.push('Publish the homepage to production');
    } else {
      suggestions.push('Publish site to production');
    }

    const seoMissing = context.pages.filter(
      (p) => missingSEOTitle(p) || missingSEODescription(p),
    );
    if (seoMissing.length > 0) {
      suggestions.push('Draft better title tags for pages missing SEO');
      suggestions.push('Run SEO metadata audit on all pages');
    } else if (context.pages.length > 0) {
      suggestions.push('Review page SEO metadata');
    }

    const collection = context.collections[0];
    if (collection) {
      suggestions.push(`Create a draft CMS item in ${collection.name}`);
    }

    const draftItem = (context.cmsItems ?? []).find(
      (item) => item.isDraft && !item.isPublished,
    );
    if (draftItem) {
      suggestions.push(`Publish CMS item ${draftItem.name}`);
    }

    if (isPublishCoolingDown(context)) {
      suggestions = suggestions.filter(
        (s) => !s.toLowerCase().includes('publish'),
      );
      suggestions.unshift('Summarize this site (wait for rate limit)');
    }

    if (suggestions.length === 0) {
      suggestions.push('Summarize this site');
    }

    return suggestions.slice(0, 6);
  },
};
