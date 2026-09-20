import type { DesignerSessionStatus } from '../../domain/models/webflowModels';
import {
  MCPError,
  type DesignerOperation,
  type MCPTool,
  type MCPToolResult,
  type WebflowMCPClient,
} from './types';
import type { SiteID } from '../../domain/models/ids';

/** Safe default: no MCP tools, no live session. */
export class NullMCPClient implements WebflowMCPClient {
  async listTools(): Promise<MCPTool[]> {
    return [];
  }

  async liveSessionStatus(): Promise<DesignerSessionStatus> {
    return { status: 'unavailable' };
  }

  async invokeTool(_name: string, _args: Record<string, string>): Promise<void> {
    throw MCPError.mcpUnavailable();
  }

  async invokeDesignerOperation(
    _operation: DesignerOperation,
    _values: Record<string, string>,
    _expectedSiteID: SiteID,
  ): Promise<void> {
    throw MCPError.mcpUnavailable();
  }

  async callTool<T = unknown>(
    name: string,
    args: Record<string, string>,
  ): Promise<MCPToolResult<T>> {
    await this.invokeTool(name, args);
    return { structuredContent: null, content: [] };
  }
}
