import type { CollectionID, ItemID, PageID, SiteID } from '../models/ids';

export type MobileflowAction =
  | { type: 'readSiteSummary'; siteID: SiteID }
  | { type: 'publishSite'; input: PublishSiteInput }
  | { type: 'publishPage'; input: PublishPageInput }
  | { type: 'updatePageMetadata'; input: UpdatePageMetadataInput }
  | { type: 'bulkUpdateCMSItems'; input: BulkUpdateCMSItemsInput }
  | { type: 'createCMSItem'; input: CreateCMSItemInput }
  | { type: 'updateCMSItem'; input: UpdateCMSItemInput }
  | { type: 'publishCMSItems'; input: PublishCMSItemsInput }
  | { type: 'uploadAsset'; input: UploadAssetInput }
  | { type: 'deleteFormSubmission'; input: DeleteFormSubmissionInput }
  | { type: 'updateDesignerVariable'; input: UpdateDesignerVariableInput }
  | { type: 'updateDesignerText'; input: UpdateDesignerTextInput }
  | { type: 'updateComponentProp'; input: UpdateComponentPropInput };

export interface PublishSiteInput {
  siteID: SiteID;
  customDomainIDs: string[];
  publishToWebflowSubdomain: boolean;
}

export interface PublishPageInput {
  siteID: SiteID;
  pageID: PageID;
  customDomainIDs: string[];
  publishToWebflowSubdomain: boolean;
}

export interface UpdatePageMetadataInput {
  pageID: PageID;
  title?: string | null;
  slug?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  openGraphTitle?: string | null;
  openGraphDescription?: string | null;
}

export interface BulkUpdateCMSItemsInput {
  collectionID: CollectionID;
  itemIDs: ItemID[];
  fieldUpdates: Record<string, string>;
}

export interface CreateCMSItemInput {
  collectionID: CollectionID;
  fields: Record<string, string>;
}

export interface UpdateCMSItemInput {
  collectionID: CollectionID;
  itemID: ItemID;
  fields: Record<string, string>;
}

export interface PublishCMSItemsInput {
  collectionID: CollectionID;
  itemIDs: ItemID[];
}

export interface DeleteFormSubmissionInput {
  formID: string;
  submissionID: string;
}

export interface UploadAssetInput {
  siteID: SiteID;
  fileName: string;
}

export interface UpdateDesignerVariableInput {
  variableID: string;
  value: string;
  branchID?: string | null;
}

export interface UpdateDesignerTextInput {
  elementID: string;
  text: string;
  branchID?: string | null;
}

export interface UpdateComponentPropInput {
  componentID: string;
  propName: string;
  value: string;
  branchID?: string | null;
}

export type ActionRisk = 'readOnly' | 'low' | 'medium' | 'high' | 'destructive';

export type ConfirmationRequirement =
  | 'none'
  | 'inline'
  | 'review'
  | 'hardConfirm'
  | 'destructiveConfirm';

export interface MCPToolHint {
  name: string;
  /** True only for live canvas/selection tools; headless data_* writes are false. */
  requiresLiveSession: boolean;
}

export interface PreflightCheck {
  name: string;
  passed: boolean;
  detail?: string | null;
}

export interface PreflightResult {
  passed: boolean;
  checks: PreflightCheck[];
}

export interface ActionDescriptor {
  id: string;
  action: MobileflowAction;
  title: string;
  summary: string;
  siteID: SiteID;
  branchID?: string | null;
  /**
   * True only when the action needs a live Designer session (selection/canvas).
   * Headless MCP 2.0 designer writes set this false.
   */
  requiresLiveSession: boolean;
  risk: ActionRisk;
  confirmation: ConfirmationRequirement;
  toolHints: MCPToolHint[];
  preflight?: PreflightResult | null;
}

/**
 * Where a plan came from.
 * - heuristic: keyword / deterministic (always available)
 * - foundationModels: iOS Apple Intelligence / Foundation Models (SwiftUI name)
 * - onDevice: RN umbrella for local free SLM (Android Gemini Nano-class, etc.)
 *   Prefer tagging new RN on-device plans as `onDevice`; keep `foundationModels`
 *   for iOS parity display strings.
 */
export type PlannerSource = 'heuristic' | 'foundationModels' | 'onDevice';

export const plannerSourceDisplayName: Record<PlannerSource, string> = {
  heuristic: 'Keyword planner',
  foundationModels: 'On-device model',
  onDevice: 'On-device model',
};

export interface ActionPlan {
  id: string;
  prompt?: string | null;
  descriptors: ActionDescriptor[];
  createdAt: string; // ISO
  source: PlannerSource;
  rationale?: string | null;
}

export function newActionPlan(
  partial: Omit<ActionPlan, 'id' | 'createdAt' | 'source'> &
    Partial<Pick<ActionPlan, 'id' | 'createdAt' | 'source'>>,
): ActionPlan {
  return {
    id: partial.id ?? cryptoRandomId(),
    prompt: partial.prompt ?? null,
    descriptors: partial.descriptors,
    createdAt: partial.createdAt ?? new Date().toISOString(),
    source: partial.source ?? 'heuristic',
    rationale: partial.rationale ?? null,
  };
}

/** UUID-ish id without depending on crypto.randomUUID in all runtimes. */
export function cryptoRandomId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
