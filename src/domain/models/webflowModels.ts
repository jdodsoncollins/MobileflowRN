import type {
  CollectionID,
  ItemID,
  PageID,
  SiteID,
  WorkspaceID,
} from './ids';
import type { ActionRisk } from '../actions/mobileflowAction';

export interface WebflowWorkspace {
  id: WorkspaceID;
  name: string;
}

export interface WebflowSite {
  id: SiteID;
  workspaceID: WorkspaceID;
  name: string;
  shortName: string;
  lastPublished: string | null;
  customDomains: WebflowCustomDomain[];
  draftChangesCount: number;
  pendingCMSItems: number;
  seoIssuesCount: number;
}

export interface WebflowCustomDomain {
  id: string;
  url: string;
}

export function sitePublicURL(site: WebflowSite): string | null {
  if (!site.lastPublished) return null;
  return `https://${site.shortName}.webflow.io`;
}

export function siteCustomDomainURL(site: WebflowSite): string | null {
  const domain = site.customDomains[0]?.url;
  if (!domain) return null;
  return domain.startsWith('http') ? domain : `https://${domain}`;
}

export function siteDesignerURL(site: WebflowSite): string {
  return `https://webflow.com/design/${site.id}`;
}

export type PageType = 'staticPage' | 'home' | 'collectionTemplate' | 'utility';

export const pageTypeDisplayName: Record<PageType, string> = {
  staticPage: 'Static',
  home: 'Home',
  collectionTemplate: 'Collection Template',
  utility: 'Utility',
};

export interface WebflowPage {
  id: PageID;
  siteID: SiteID;
  title: string;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  openGraphTitle: string | null;
  openGraphDescription: string | null;
  locale: string | null;
  pageType: PageType;
  slugEditable: boolean;
  hasDraftChanges: boolean;
}

export function missingSEOTitle(page: WebflowPage): boolean {
  return page.seoTitle == null || page.seoTitle.trim() === '';
}

export function missingSEODescription(page: WebflowPage): boolean {
  return page.seoDescription == null || page.seoDescription.trim() === '';
}

export interface WebflowCollection {
  id: CollectionID;
  siteID: SiteID;
  name: string;
  slug: string;
  itemCount: number;
}

export interface WebflowCMSItem {
  id: ItemID;
  collectionID: CollectionID;
  name: string;
  slug: string;
  isDraft: boolean;
  isPublished: boolean;
  missingFields: string[];
}

export interface CMSItemPage {
  items: WebflowCMSItem[];
  offset: number;
  limit: number;
  total: number;
}

export interface WebflowForm {
  id: string;
  siteID: SiteID;
  displayName: string;
}

export interface WebflowFormSubmission {
  id: string;
  formID: string;
  submittedAt: string;
  data: Record<string, string>;
}

export type WebflowConnection =
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'connected'; sites: WebflowSite[] }
  | { status: 'error'; message: string };

export function connectionIsConnected(c: WebflowConnection): boolean {
  return c.status === 'connected';
}

export function connectionSites(c: WebflowConnection): WebflowSite[] {
  return c.status === 'connected' ? c.sites : [];
}

export type DesignerMode = 'design' | 'edit' | 'preview' | 'build' | 'comment';

export const designerModeDisplayName: Record<DesignerMode, string> = {
  design: 'Design',
  edit: 'Edit',
  preview: 'Preview',
  build: 'Build',
  comment: 'Comment',
};

/**
 * Optional live Designer session (canvas / selection / snapshots).
 * Under MCP 2.0, most designer writes are headless and do not need this.
 */
export type DesignerSessionStatus =
  | { status: 'unknown' }
  | { status: 'notAuthorized' }
  | { status: 'unavailable' }
  | { status: 'connected'; mode: DesignerMode; siteID: SiteID; pageID: PageID | null }
  | { status: 'modeForbidden'; mode: DesignerMode; toolName: string }
  | { status: 'error'; message: string };

/** @deprecated Use DesignerSessionStatus */
export type DesignerBridgeStatus = DesignerSessionStatus;

export function liveSessionIsConnected(s: DesignerSessionStatus): boolean {
  return s.status === 'connected';
}

/** @deprecated Use liveSessionIsConnected */
export function bridgeIsConnected(s: DesignerSessionStatus): boolean {
  return liveSessionIsConnected(s);
}

/**
 * Headless designer writes (MCP 2.0): only need a selected site.
 * Live session / Design mode is not required for data_* tools.
 */
export function designerWritesSiteReady(
  selectedSiteID: SiteID | null,
): boolean {
  return selectedSiteID != null;
}

/** @deprecated Bridge no longer gates writes under MCP 2.0 */
export function bridgeAllowsDesignerWrites(
  _status: DesignerSessionStatus,
  selectedSiteID: SiteID | null,
): boolean {
  return designerWritesSiteReady(selectedSiteID);
}

export type ActivitySource = 'manual' | 'command' | 'siri' | 'notification' | 'automation';
export type ActivityStatus = 'completed' | 'failed' | 'pending' | 'queued';

/** Field-level before/after for revert and audit trails. */
export interface ActivityChangeRecord {
  resourceType: 'page' | 'cmsItem';
  resourceId: string;
  field: string;
  before: string;
  after: string;
}

export interface ActivityItem {
  id: string;
  timestamp: string; // ISO
  siteName: string;
  title: string;
  summary: string;
  source: ActivitySource;
  risk: ActionRisk;
  status: ActivityStatus;
  /** Site id when known (for scoped reverts / stale checks). */
  siteID?: string | null;
  /** Field diffs applied by this action (enables safe revert proposals). */
  changes?: ActivityChangeRecord[] | null;
  /** True when changes are present and not yet reverted. */
  canRevert?: boolean;
  revertedAt?: string | null;
}

export type MCPLoadFailure =
  | { kind: 'none' }
  | { kind: 'notAuthorized' }
  | { kind: 'network' }
  | { kind: 'unknown'; detail: string };

export function mcpLoadFailureMessage(f: MCPLoadFailure): string {
  switch (f.kind) {
    case 'none':
      return '';
    case 'notAuthorized':
      return 'MCP tools could not load because Webflow auth is missing or expired. Reconnect in Settings.';
    case 'network':
      return 'Could not reach the Webflow MCP server. Check network and try pull-to-refresh.';
    case 'unknown':
      return `Could not load MCP tools: ${f.detail}`;
  }
}
