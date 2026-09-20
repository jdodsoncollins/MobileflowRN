import type { ActionDescriptor } from '../../domain/actions/mobileflowAction';
import type { MobileflowAction } from '../../domain/actions/mobileflowAction';
import { cryptoRandomId } from '../../domain/actions/mobileflowAction';
import type { SiteID } from '../../domain/models/ids';
import type { ActivityItem } from '../../domain/models/webflowModels';
import type { WebflowAPIClient } from '../api/types';
import { WebflowAPIError } from '../api/errors';
import type { WebflowMCPClient } from '../mcp/types';

export interface ActionExecutor {
  execute(descriptor: ActionDescriptor): Promise<ActivityItem>;
}

/**
 * Executes approved action descriptors against live Webflow Data API and MCP.
 * Never reports success unless the underlying call succeeds.
 * Failures return ActivityItem status failed (does not throw to caller).
 */
export class LiveActionExecutor implements ActionExecutor {
  private readonly api: WebflowAPIClient;
  private readonly mcp: WebflowMCPClient;
  private readonly siteNameProvider: () => string;
  private readonly onRateLimited?: (siteID: SiteID, retryAfter: number | null) => void;
  private readonly onPublishSuccess?: (siteID: SiteID) => void;

  constructor(opts: {
    api: WebflowAPIClient;
    mcp: WebflowMCPClient;
    siteNameProvider?: () => string;
    onRateLimited?: (siteID: SiteID, retryAfter: number | null) => void;
    onPublishSuccess?: (siteID: SiteID) => void;
  }) {
    this.api = opts.api;
    this.mcp = opts.mcp;
    this.siteNameProvider = opts.siteNameProvider ?? (() => 'Site');
    this.onRateLimited = opts.onRateLimited;
    this.onPublishSuccess = opts.onPublishSuccess;
  }

  async execute(descriptor: ActionDescriptor): Promise<ActivityItem> {
    const siteName = this.siteNameProvider();
    try {
      await this.perform(descriptor.action, descriptor.siteID);
      const pubSite = publishSiteID(descriptor.action);
      if (pubSite) this.onPublishSuccess?.(pubSite);
      return {
        id: cryptoRandomId(),
        timestamp: new Date().toISOString(),
        siteName,
        title: descriptor.title,
        summary: descriptor.summary,
        source: 'command',
        risk: descriptor.risk,
        status: 'completed',
      };
    } catch (error) {
      if (
        error instanceof WebflowAPIError &&
        error.isRateLimited
      ) {
        const pubSite = publishSiteID(descriptor.action);
        if (pubSite) {
          this.onRateLimited?.(pubSite, error.retryAfter ?? null);
        }
      }
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        id: cryptoRandomId(),
        timestamp: new Date().toISOString(),
        siteName,
        title: descriptor.title,
        summary: `Failed: ${message}`,
        source: 'command',
        risk: descriptor.risk,
        status: 'failed',
      };
    }
  }

  private async perform(action: MobileflowAction, actionSiteID: SiteID): Promise<void> {
    switch (action.type) {
      case 'readSiteSummary':
        await this.api.listPages(action.siteID);
        break;
      case 'publishSite':
        await this.api.publishSite(action.input);
        break;
      case 'publishPage':
        await this.api.publishPage(action.input);
        break;
      case 'updatePageMetadata':
        await this.api.updatePageMetadata(action.input);
        break;
      case 'bulkUpdateCMSItems':
        for (const itemID of action.input.itemIDs) {
          await this.api.updateCMSItem({
            collectionID: action.input.collectionID,
            itemID,
            fields: action.input.fieldUpdates,
          });
        }
        break;
      case 'createCMSItem':
        await this.api.createCMSItem(action.input);
        break;
      case 'updateCMSItem':
        await this.api.updateCMSItem(action.input);
        break;
      case 'publishCMSItems':
        await this.api.publishCMSItems(action.input);
        break;
      case 'deleteFormSubmission':
        await this.api.deleteFormSubmission(action.input);
        break;
      case 'uploadAsset':
        throw WebflowAPIError.uploadFailed(
          `Use Photo → Asset flow to upload ${action.input.fileName}. Plan approval does not upload binary data.`,
        );
      case 'updateDesignerVariable': {
        const values: Record<string, string> = {
          variableID: action.input.variableID,
          value: action.input.value,
        };
        if (action.input.branchID) values.branchID = action.input.branchID;
        await this.mcp.invokeDesignerOperation(
          'updateVariable', values, actionSiteID,
        );
        break;
      }
      case 'updateDesignerText': {
        const values: Record<string, string> = {
          elementID: action.input.elementID,
          text: action.input.text,
        };
        if (action.input.branchID) values.branchID = action.input.branchID;
        await this.mcp.invokeDesignerOperation(
          'updateElementText', values, actionSiteID,
        );
        break;
      }
      case 'updateComponentProp': {
        const values: Record<string, string> = {
          componentID: action.input.componentID,
          propName: action.input.propName,
          value: action.input.value,
        };
        if (action.input.branchID) values.branchID = action.input.branchID;
        await this.mcp.invokeDesignerOperation(
          'updateComponentProp', values, actionSiteID,
        );
        break;
      }
    }
  }
}

function publishSiteID(action: MobileflowAction): SiteID | null {
  switch (action.type) {
    case 'publishSite':
      return action.input.siteID;
    case 'publishPage':
      return action.input.siteID;
    default:
      return null;
  }
}

/** Preview / UI-test executor only. Never used on the live path. */
export class MockActionExecutor implements ActionExecutor {
  async execute(descriptor: ActionDescriptor): Promise<ActivityItem> {
    await new Promise((r) => setTimeout(r, 50));
    return {
      id: cryptoRandomId(),
      timestamp: new Date().toISOString(),
      siteName: 'Test Site',
      title: descriptor.title,
      summary: `[Test] ${descriptor.summary}`,
      source: 'command',
      risk: descriptor.risk,
      status: 'completed',
    };
  }
}
