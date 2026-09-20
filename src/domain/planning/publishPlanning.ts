import type { PreflightCheck } from '../actions/mobileflowAction';
import type { PageID } from '../models/ids';
import {
  connectionIsConnected,
  type WebflowConnection,
  type WebflowSite,
} from '../models/webflowModels';
import { PublishRateLimitStore } from './publishRateLimitStore';

export interface PublishDomain {
  id: string;
  url: string;
  lastPublished: string | null;
}

export type PublishScope = 'site' | 'page';

export const publishScopeDisplayName: Record<PublishScope, string> = {
  site: 'Entire Site',
  page: 'Single Page',
};

export interface PublishTargets {
  scope: PublishScope;
  selectedDomainIDs: string[];
  publishToWebflowSubdomain: boolean;
  pageID: PageID | null;
}

export const emptyPublishTargets: PublishTargets = {
  scope: 'site',
  selectedDomainIDs: [],
  publishToWebflowSubdomain: false,
  pageID: null,
};

export function publishTargetsHasTarget(t: PublishTargets): boolean {
  return t.publishToWebflowSubdomain || t.selectedDomainIDs.length > 0;
}

export interface PublishPreflight {
  checks: PreflightCheck[];
  canPublish: boolean;
  rateLimitWarning: string | null;
  nextAllowedPublish: string | null;
  remainingCooldownSeconds: number | null;
}

export function evaluatePublishPreflight(args: {
  site: WebflowSite;
  targets: PublishTargets;
  connection: WebflowConnection;
  cooldownUntil: string | null;
  now?: Date;
}): PublishPreflight {
  const now = args.now ?? new Date();
  const checks: PreflightCheck[] = [];
  const connected = connectionIsConnected(args.connection);

  checks.push({
    name: 'OAuth connected',
    passed: connected,
    detail: connected ? null : 'Connect Webflow first',
  });

  checks.push({
    name: 'Publish scope granted',
    passed: connected,
    detail: 'Requires sites:write scope',
  });

  const hasTarget = publishTargetsHasTarget(args.targets);
  checks.push({
    name: 'Target selected',
    passed: hasTarget,
    detail: hasTarget ? null : 'Select a domain or Webflow subdomain',
  });


  if (args.targets.scope === 'page') {
    checks.push({
      name: 'Page selected',
      passed: args.targets.pageID != null,
      detail: args.targets.pageID == null ? 'Choose a page to publish' : null,
    });
  }

  let rateLimitWarning: string | null = null;
  let nextAllowed: string | null = null;
  let remaining: number | null = null;

  if (args.cooldownUntil) {
    const until = new Date(args.cooldownUntil);
    if (until.getTime() > now.getTime()) {
      nextAllowed = until.toISOString();
      remaining = Math.max(
        1,
        Math.ceil((until.getTime() - now.getTime()) / 1000),
      );
      rateLimitWarning = `Webflow publish limit (~1/min). Wait ${remaining}s before retry.`;
      checks.push({
        name: 'Rate limit',
        passed: false,
        detail: `Next publish available ${until.toLocaleTimeString()}`,
      });
    } else {
      checks.push({
        name: 'Rate limit',
        passed: true,
        detail: 'Publish API allows about 1 successful publish per minute',
      });
    }
  } else {
    checks.push({
      name: 'Rate limit',
      passed: true,
      detail: 'Publish API allows about 1 successful publish per minute',
    });
  }

  if (args.site.seoIssuesCount > 0 && args.targets.scope === 'page') {
    checks.push({
      name: 'SEO review',
      passed: true,
      detail: `${args.site.seoIssuesCount} SEO issues on site — review recommended`,
    });
  }

  return {
    checks,
    canPublish: checks.every((c) => c.passed),
    rateLimitWarning,
    nextAllowedPublish: nextAllowed,
    remainingCooldownSeconds: remaining,
  };
}

export function evaluatePublishPreflightFromLastAttempt(args: {
  site: WebflowSite;
  targets: PublishTargets;
  connection: WebflowConnection;
  lastPublishAttempt: string | null;
  now?: Date;
  cooldownSeconds?: number;
}): PublishPreflight {
  const cooldown =
    args.cooldownSeconds ?? PublishRateLimitStore.defaultCooldownSeconds;
  const until = args.lastPublishAttempt
    ? new Date(
        new Date(args.lastPublishAttempt).getTime() + cooldown * 1000,
      ).toISOString()
    : null;
  return evaluatePublishPreflight({
    site: args.site,
    targets: args.targets,
    connection: args.connection,
    cooldownUntil: until,
    now: args.now,
  });
}
