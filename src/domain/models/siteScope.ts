import type { WebflowSite } from './webflowModels';
import { siteCustomDomainURL, sitePublicURL } from './webflowModels';

export function siteTitle(site: WebflowSite): string {
  const host = hostOf(siteCustomDomainURL(site) ?? sitePublicURL(site));
  return host || site.shortName || site.name;
}

export function siteSubtitle(site: WebflowSite): string {
  const host = hostOf(siteCustomDomainURL(site) ?? sitePublicURL(site));
  if (host && host !== site.name) return site.name;
  return site.shortName;
}

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^https?:\/\//i, '').replace(/\/.*$/, '') || null;
}

export function rankSites(sites: WebflowSite[], query = ''): WebflowSite[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? sites.filter((s) => {
        const hay = [s.name, s.shortName, siteTitle(s)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
    : [...sites];
  return filtered.sort((a, b) => {
    const pub = Number(Boolean(b.lastPublished)) - Number(Boolean(a.lastPublished));
    if (pub !== 0) return pub;
    return siteTitle(a).localeCompare(siteTitle(b));
  });
}
