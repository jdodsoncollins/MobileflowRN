import {
  type ActionDescriptor,
  type ActionRisk,
  type ConfirmationRequirement,
  type MCPToolHint,
  type MobileflowAction,
  type UpdatePageMetadataInput,
  cryptoRandomId,
} from '../actions/mobileflowAction';
import type { SiteID } from '../models/ids';

export class ConfirmationPolicy {
  static readonly default = new ConfirmationPolicy();

  risk(forAction: MobileflowAction): ActionRisk {
    switch (forAction.type) {
      case 'readSiteSummary':
        return 'readOnly';
      case 'updatePageMetadata':
        return forAction.input.slug != null && forAction.input.slug !== ''
          ? 'high'
          : 'medium';
      case 'publishSite':
      case 'publishPage':
      case 'publishCMSItems':
        return 'high';
      case 'bulkUpdateCMSItems':
      case 'createCMSItem':
      case 'updateCMSItem':
        return 'medium';
      case 'deleteFormSubmission':
        return 'destructive';
      case 'replyToComment':
      case 'uploadAsset':
        return 'low';
      case 'updateDesignerVariable':
      case 'updateDesignerText':
      case 'updateComponentProp':
        return 'medium';
    }
  }

  requirement(forAction: MobileflowAction): ConfirmationRequirement {
    switch (this.risk(forAction)) {
      case 'readOnly':
        return 'none';
      case 'low':
        return 'inline';
      case 'medium':
        return 'review';
      case 'high':
        return 'hardConfirm';
      case 'destructive':
        return 'destructiveConfirm';
    }
  }

  /**
   * Headless MCP 2.0 designer writes do not need a live session.
   * Reserved for future selection/snapshot-bound actions.
   */
  requiresLiveSession(_forAction: MobileflowAction): boolean {
    return false;
  }

  descriptor(forAction: MobileflowAction, siteID: SiteID): ActionDescriptor {
    return {
      id: cryptoRandomId(),
      action: forAction,
      title: this.title(forAction),
      summary: this.summary(forAction),
      siteID,
      branchID: this.branchID(forAction),
      requiresLiveSession: this.requiresLiveSession(forAction),
      risk: this.risk(forAction),
      confirmation: this.requirement(forAction),
      toolHints: this.toolHints(forAction),
      preflight: null,
    };
  }

  private title(action: MobileflowAction): string {
    switch (action.type) {
      case 'readSiteSummary':
        return 'Read Site Summary';
      case 'publishSite':
        return 'Publish Site';
      case 'publishPage':
        return 'Publish Page';
      case 'publishCMSItems':
        return 'Publish CMS Items';
      case 'updatePageMetadata':
        return 'Update Page Metadata';
      case 'bulkUpdateCMSItems':
        return 'Bulk Update CMS Items';
      case 'createCMSItem':
        return 'Create CMS Item';
      case 'updateCMSItem':
        return 'Update CMS Item';
      case 'deleteFormSubmission':
        return 'Delete Form Submission';
      case 'replyToComment':
        return 'Reply to Comment';
      case 'uploadAsset':
        return 'Upload Asset';
      case 'updateDesignerVariable':
        return 'Update Design Variable';
      case 'updateDesignerText':
        return 'Update Text';
      case 'updateComponentProp':
        return 'Update Component Prop';
    }
  }

  private summary(action: MobileflowAction): string {
    switch (action.type) {
      case 'readSiteSummary':
        return `Fetch summary for site ${action.siteID}`;
      case 'publishSite':
        return `Publish entire site to ${
          action.input.publishToWebflowSubdomain
            ? 'Webflow subdomain'
            : 'custom domains'
        }`;
      case 'publishPage':
        return `Publish page ${action.input.pageID}`;
      case 'updatePageMetadata':
        return this.metadataSummary(action.input);
      case 'bulkUpdateCMSItems':
        return `Update ${action.input.itemIDs.length} items in collection`;
      case 'createCMSItem':
        return 'Create new draft CMS item';
      case 'updateCMSItem':
        return 'Update CMS item fields';
      case 'publishCMSItems':
        return `Publish ${action.input.itemIDs.length} CMS item${
          action.input.itemIDs.length === 1 ? '' : 's'
        } (does not republish the whole site)`;
      case 'deleteFormSubmission':
        return `Delete form submission ${action.input.submissionID}`;
      case 'replyToComment':
        return 'Post a reply on a Designer comment thread';
      case 'uploadAsset':
        return `Upload ${action.input.fileName}`;
      case 'updateDesignerVariable':
        return `Set variable ${action.input.variableID} to ${action.input.value}`;
      case 'updateDesignerText':
        return 'Update element text content';
      case 'updateComponentProp':
        return `Set ${action.input.propName} on component`;
    }
  }

  private metadataSummary(input: UpdatePageMetadataInput): string {
    const fields: string[] = [];
    if (input.title != null) fields.push('title');
    if (input.slug != null) fields.push('slug');
    if (input.seoTitle != null) fields.push('SEO title');
    if (input.seoDescription != null) fields.push('SEO description');
    return `Update ${fields.join(', ')}`;
  }

  private branchID(action: MobileflowAction): string | null {
    switch (action.type) {
      case 'updateDesignerVariable':
      case 'updateDesignerText':
      case 'updateComponentProp':
        return action.input.branchID ?? null;
      default:
        return null;
    }
  }

  private toolHints(action: MobileflowAction): MCPToolHint[] {
    switch (action.type) {
      case 'updateDesignerVariable':
        return [
          { name: 'data_style_tool / variable update', requiresLiveSession: false },
        ];
      case 'updateDesignerText':
        return [
          { name: 'data_element_tool / text update', requiresLiveSession: false },
        ];
      case 'updateComponentProp':
        return [
          {
            name: 'data_component_props_tool / prop update',
            requiresLiveSession: false,
          },
        ];
      case 'publishSite':
      case 'publishPage':
        return [{ name: 'publish_site', requiresLiveSession: false }];
      default:
        return [];
    }
  }
}
