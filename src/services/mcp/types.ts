import type {
  DesignerMode,
  DesignerSessionStatus,
} from '../../domain/models/webflowModels';
import type { SiteID } from '../../domain/models/ids';

export interface MCPTool {
  name: string;
  description: string;
  /**
   * True when the tool needs a live Designer session (selection, canvas,
   * snapshots). Headless data_* tools are false under MCP 2.0.
   */
  requiresLiveSession: boolean;
  isReadOnly: boolean;
  inputSchema: MCPInputSchema;
}

export interface MCPInputSchema {
  type: 'object';
  properties: Record<string, { type?: string; description?: string }>;
  required: string[];
}

export type DesignerOperation =
  | 'updateVariable'
  | 'updateElementText'
  | 'updateComponentProp';

export interface MCPContentBlock {
  type: string;
  text?: string | null;
}

export interface MCPToolResult<T = unknown> {
  structuredContent: T | null;
  content: MCPContentBlock[];
}

export interface WebflowMCPClient {
  listTools(): Promise<MCPTool[]>;
  /**
   * Optional live Designer session probe (MCP Bridge App + open Designer).
   * Not required for headless designer writes under MCP 2.0.
   */
  liveSessionStatus(
    expectedSiteID?: SiteID | null,
  ): Promise<DesignerSessionStatus>;
  invokeTool(name: string, arguments_: Record<string, string>): Promise<void>;
  invokeDesignerOperation(
    operation: DesignerOperation,
    values: Record<string, string>,
    expectedSiteID: SiteID,
  ): Promise<void>;
  callTool<T = unknown>(
    name: string,
    arguments_: Record<string, string>,
  ): Promise<MCPToolResult<T>>;
}

export type MCPErrorKind =
  | 'mcpUnavailable'
  | 'modeForbidden'
  | 'toolNotFound'
  | 'invalidResponse'
  | 'toolFailed';

export class MCPError extends Error {
  readonly kind: MCPErrorKind;
  readonly mode?: DesignerMode;
  readonly tool?: string;

  constructor(
    kind: MCPErrorKind,
    message: string,
    opts?: { mode?: DesignerMode; tool?: string },
  ) {
    super(message);
    this.name = 'MCPError';
    this.kind = kind;
    this.mode = opts?.mode;
    this.tool = opts?.tool;
  }

  static mcpUnavailable(message?: string): MCPError {
    return new MCPError(
      'mcpUnavailable',
      message ??
        'Webflow MCP is not available. Reconnect Webflow and try again.',
    );
  }

  /** @deprecated Use mcpUnavailable — kept for call-site migration clarity */
  static bridgeUnavailable(): MCPError {
    return MCPError.mcpUnavailable(
      'Webflow MCP is not available. Reconnect Webflow and try again.',
    );
  }

  static modeForbidden(mode: DesignerMode, tool: string): MCPError {
    return new MCPError(
      'modeForbidden',
      `Tool ${tool} is unavailable in ${mode} mode.`,
      { mode, tool },
    );
  }

  static toolNotFound(name: string): MCPError {
    return new MCPError('toolNotFound', `MCP tool ${name} not found.`, {
      tool: name,
    });
  }

  static invalidResponse(): MCPError {
    return new MCPError(
      'invalidResponse',
      'The MCP server returned an invalid response.',
    );
  }

  static toolFailed(name: string): MCPError {
    return new MCPError('toolFailed', `MCP tool ${name} failed.`, { tool: name });
  }
}
