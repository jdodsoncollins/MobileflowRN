import { describe, expect, it, vi } from 'vitest';
import { LiveActionExecutor, MockActionExecutor } from '../src/services/actions/liveActionExecutor';
import { ConfirmationPolicy } from '../src/domain/policies/confirmationPolicy';
import { pageID, siteID, collectionID, itemID } from '../src/domain/models/ids';
import type { WebflowAPIClient } from '../src/services/api/types';
import type { WebflowMCPClient } from '../src/services/mcp/types';
import type { DesignerOperation } from '../src/services/mcp/types';
import { WebflowAPIError } from '../src/services/api/errors';
import { MCPError } from '../src/services/mcp/types';
import type { WebflowSite, WebflowPage, WebflowCollection, WebflowCMSItem } from '../src/domain/models/webflowModels';
import type { WebflowAsset } from '../src/domain/models/contentModels';
import type { ItemID } from '../src/domain/models/ids';

class RecordingAPI implements WebflowAPIClient {
  publishSiteCalls = 0;
  updateMetadataCalls = 0;
  createCMSCalls = 0;
  uploadCalls = 0;
  shouldFailPublish = false;
  shouldFailMetadata = false;
  failMetadataWithNotFound = false;

  async listSites(): Promise<WebflowSite[]> {
    return [];
  }
  async listPages(): Promise<WebflowPage[]> {
    return [];
  }
  async listCollections(): Promise<WebflowCollection[]> {
    return [];
  }
  async listCMSItems(): Promise<WebflowCMSItem[]> {
    return [];
  }
  async publishSite(): Promise<void> {
    this.publishSiteCalls += 1;
    if (this.shouldFailPublish) throw WebflowAPIError.rateLimited(30);
  }
  async publishPage(): Promise<void> {
    await this.publishSite();
  }
  async updatePageMetadata(): Promise<void> {
    this.updateMetadataCalls += 1;
    if (this.failMetadataWithNotFound) throw WebflowAPIError.notFound();
    if (this.shouldFailMetadata) throw WebflowAPIError.unauthorized();
  }
  async updateCMSItem(): Promise<void> {}
  async createCMSItem(): Promise<ItemID> {
    this.createCMSCalls += 1;
    return 'item_new' as ItemID;
  }
  async uploadAsset(): Promise<WebflowAsset> {
    this.uploadCalls += 1;
    return {
      id: 'a1',
      fileName: 'x',
      contentType: 'image/jpeg',
      url: 'https://example.com/x',
      uploadedAt: new Date().toISOString(),
      sizeBytes: 1,
      altText: null,
    };
  }
  async listCMSItemsPage() {
    return { items: [], offset: 0, limit: 25, total: 0 };
  }
  publishCMSCalls = 0;
  deleteFormCalls = 0;
  async publishCMSItems(): Promise<void> {
    this.publishCMSCalls += 1;
  }
  async listAssets(): Promise<WebflowAsset[]> {
    return [];
  }
  async listForms() {
    return [];
  }
  async listFormSubmissions() {
    return [];
  }
  async deleteFormSubmission(): Promise<void> {
    this.deleteFormCalls += 1;
  }
  async listSiteLocales() {
    return [];
  }
  async listCommentThreads() {
    return [];
  }
  async listCommentReplies() {
    return [];
  }
  replyCalls = 0;
  async replyToComment(): Promise<void> {
    this.replyCalls += 1;
  }
  async siteAgentInstructions(): Promise<string | null> {
    return null;
  }
}

class RecordingMCP implements WebflowMCPClient {
  invokeNames: string[] = [];
  shouldFail = false;
  async listTools() {
    return [];
  }
  async liveSessionStatus() {
    return { status: 'unavailable' as const };
  }
  async invokeTool(name: string, _args: Record<string, string> = {}) {
    this.invokeNames.push(name);
    if (this.shouldFail) throw MCPError.mcpUnavailable();
  }
  async invokeDesignerOperation(
    operation: DesignerOperation,
    _values: Record<string, string>,
    _expectedSiteID: ReturnType<typeof siteID>,
  ) {
    this.invokeNames.push(operation);
    if (this.shouldFail) throw MCPError.mcpUnavailable();
  }
  async callTool(name: string, args: Record<string, string>) {
    await this.invokeTool(name, args);
    return { structuredContent: null, content: [] };
  }
}

const policy = ConfirmationPolicy.default;
const site = siteID('site_test');

describe('LiveActionExecutor', () => {
  it('publish success is completed not mocked', async () => {
    const api = new RecordingAPI();
    const executor = new LiveActionExecutor({
      api,
      mcp: new RecordingMCP(),
      siteNameProvider: () => 'Test Site',
    });
    const descriptor = policy.descriptor(
      {
        type: 'publishSite',
        input: {
          siteID: site,
          customDomainIDs: [],
          publishToWebflowSubdomain: true,
        },
      },
      site,
    );
    const item = await executor.execute(descriptor);
    expect(item.status).toBe('completed');
    expect(api.publishSiteCalls).toBe(1);
    expect(item.summary).not.toContain('[Mock]');
    expect(item.summary).not.toContain('[Test]');
  });

  it('publish failure is recorded as failed', async () => {
    const api = new RecordingAPI();
    api.shouldFailPublish = true;
    const executor = new LiveActionExecutor({
      api,
      mcp: new RecordingMCP(),
      siteNameProvider: () => 'Test Site',
    });
    const descriptor = policy.descriptor(
      {
        type: 'publishSite',
        input: {
          siteID: site,
          customDomainIDs: [],
          publishToWebflowSubdomain: true,
        },
      },
      site,
    );
    const item = await executor.execute(descriptor);
    expect(item.status).toBe('failed');
    expect(item.summary).toContain('Failed');
  });

  it('publish rate limit invokes callback', async () => {
    const api = new RecordingAPI();
    api.shouldFailPublish = true;
    const onRateLimited = vi.fn();
    const executor = new LiveActionExecutor({
      api,
      mcp: new RecordingMCP(),
      siteNameProvider: () => 'Test Site',
      onRateLimited,
    });
    const descriptor = policy.descriptor(
      {
        type: 'publishSite',
        input: {
          siteID: site,
          customDomainIDs: [],
          publishToWebflowSubdomain: true,
        },
      },
      site,
    );
    await executor.execute(descriptor);
    expect(onRateLimited).toHaveBeenCalledWith(site, 30);
  });

  it('metadata 404 maps to Resource not found (IMG_0156)', async () => {
    const api = new RecordingAPI();
    api.failMetadataWithNotFound = true;
    const executor = new LiveActionExecutor({
      api,
      mcp: new RecordingMCP(),
      siteNameProvider: () => 'Test Site',
    });
    const descriptor = policy.descriptor(
      {
        type: 'updatePageMetadata',
        input: {
          pageID: pageID('page_1'),
          seoTitle: 'New',
        },
      },
      site,
    );
    const item = await executor.execute(descriptor);
    expect(item.status).toBe('failed');
    expect(item.summary).toContain('Resource not found');
    expect(item.title).toBe('Update Page Metadata');
  });

  it('upload asset plan path does not pretend success', async () => {
    const api = new RecordingAPI();
    const executor = new LiveActionExecutor({
      api,
      mcp: new RecordingMCP(),
      siteNameProvider: () => 'Test Site',
    });
    const descriptor = policy.descriptor(
      {
        type: 'uploadAsset',
        input: { siteID: site, fileName: 'photo.jpg' },
      },
      site,
    );
    const item = await executor.execute(descriptor);
    expect(item.status).toBe('failed');
    expect(item.summary.toLowerCase()).toContain('photo');
    expect(api.uploadCalls).toBe(0);
  });

  it('create CMS item succeeds', async () => {
    const api = new RecordingAPI();
    const executor = new LiveActionExecutor({
      api,
      mcp: new RecordingMCP(),
      siteNameProvider: () => 'Test Site',
    });
    const descriptor = policy.descriptor(
      {
        type: 'createCMSItem',
        input: {
          collectionID: collectionID('col_1'),
          fields: { name: 'Draft', slug: 'draft' },
        },
      },
      site,
    );
    const item = await executor.execute(descriptor);
    expect(item.status).toBe('completed');
    expect(api.createCMSCalls).toBe(1);
  });

  it('designer variable invokes MCP', async () => {
    const mcp = new RecordingMCP();
    const executor = new LiveActionExecutor({
      api: new RecordingAPI(),
      mcp,
      siteNameProvider: () => 'Test Site',
    });
    const descriptor = policy.descriptor(
      {
        type: 'updateDesignerVariable',
        input: { variableID: 'brand-blue', value: '#000' },
      },
      site,
    );
    const item = await executor.execute(descriptor);
    expect(item.status).toBe('completed');
    expect(mcp.invokeNames).toContain('updateVariable');
  });

  it('publishes CMS items without publishing the site', async () => {
    const api = new RecordingAPI();
    const executor = new LiveActionExecutor({
      api,
      mcp: new RecordingMCP(),
      siteNameProvider: () => 'Test Site',
    });
    const descriptor = policy.descriptor(
      {
        type: 'publishCMSItems',
        input: {
          collectionID: collectionID('col_1'),
          itemIDs: [itemID('item_1')],
        },
      },
      site,
    );
    const item = await executor.execute(descriptor);
    expect(item.status).toBe('completed');
    expect(api.publishCMSCalls).toBe(1);
    expect(api.publishSiteCalls).toBe(0);
  });

  it('replies to comment threads', async () => {
    const api = new RecordingAPI();
    const executor = new LiveActionExecutor({
      api,
      mcp: new RecordingMCP(),
      siteNameProvider: () => 'Test Site',
    });
    const descriptor = policy.descriptor(
      {
        type: 'replyToComment',
        input: {
          siteID: site,
          threadID: 'thread_1',
          content: 'Noted',
        },
      },
      site,
    );
    const item = await executor.execute(descriptor);
    expect(item.status).toBe('completed');
    expect(api.replyCalls).toBe(1);
  });

  it('deletes form submissions', async () => {
    const api = new RecordingAPI();
    const executor = new LiveActionExecutor({
      api,
      mcp: new RecordingMCP(),
      siteNameProvider: () => 'Test Site',
    });
    const descriptor = policy.descriptor(
      {
        type: 'deleteFormSubmission',
        input: { formID: 'form_1', submissionID: 'sub_1' },
      },
      site,
    );
    const item = await executor.execute(descriptor);
    expect(item.status).toBe('completed');
    expect(api.deleteFormCalls).toBe(1);
  });

  it('mock executor is clearly marked', async () => {
    const executor = new MockActionExecutor();
    const descriptor = policy.descriptor(
      { type: 'readSiteSummary', siteID: site },
      site,
    );
    const item = await executor.execute(descriptor);
    expect(item.summary).toContain('[Test]');
  });
});
