import { pageID, siteID, type SiteID } from '../../domain/models/ids';
import type {
  DesignerMode,
  DesignerSessionStatus,
} from '../../domain/models/webflowModels';
import { WebflowEndpoints } from '../auth/endpoints';
import {
  MCPError,
  type DesignerOperation,
  type MCPInputSchema,
  type MCPContentBlock,
  type MCPTool,
  type MCPToolResult,
  type WebflowMCPClient,
} from './types';

const PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOL_VERSIONS = new Set([PROTOCOL_VERSION]);

export class WebflowMCPClientImpl implements WebflowMCPClient {
  private readonly tokenProvider: () => Promise<string | null>;
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;
  private requestID = 0;
  private sessionID: string | null = null;
  private negotiatedVersion: string | null = null;
  private initializedToken: string | null = null;
  private initialization: Promise<void> | null = null;

  constructor(opts: {
    tokenProvider: () => Promise<string | null>;
    fetchImpl?: typeof fetch;
    endpoint?: string;
  }) {
    this.tokenProvider = opts.tokenProvider;
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
    this.endpoint = opts.endpoint ?? WebflowEndpoints.mcpServer;
  }

  async listTools(): Promise<MCPTool[]> {
    const token = await this.tokenProvider();
    if (!token) return [];
    try {
      const tools = await this.fetchTools(token);
      return tools.map(toPublicTool);
    } catch {
      return [];
    }
  }

  /**
   * Optional live Designer session (selection / canvas). MCP 2.0 headless
   * writes do not require this — use only for live-context UI.
   */
  async liveSessionStatus(
    expectedSiteID?: SiteID | null,
  ): Promise<DesignerSessionStatus> {
    const token = await this.tokenProvider();
    if (!token) return { status: 'notAuthorized' };
    if (!expectedSiteID) return { status: 'unavailable' };
    try {
      const tools = await this.fetchTools(token);
      const probe = resolveLiveSessionProbe(tools, String(expectedSiteID));
      if (!probe) return { status: 'unavailable' };
      const live = await this.callToolUnchecked(
        token,
        probe.tool.name,
        probe.arguments,
      );
      const liveSite = findStringField(live, ['siteId', 'site_id']);
      if (liveSite !== String(expectedSiteID)) return { status: 'unavailable' };
      const livePage = findStringField(live, ['pageId', 'page_id']);
      const liveMode = findStringField(live, ['mode']);
      if (!isDesignerMode(liveMode)) return { status: 'unavailable' };
      return {
        status: 'connected',
        mode: liveMode,
        siteID: siteID(liveSite),
        pageID: livePage ? pageID(livePage) : null,
      };
    } catch {
      return { status: 'unavailable' };
    }
  }

  async invokeTool(
    name: string,
    arguments_: Record<string, string>,
  ): Promise<void> {
    await this.callTool(name, arguments_);
  }

  /**
   * Headless designer write (MCP 2.0 data_* tools). Does not require Bridge
   * or Design mode — only a resolvable tool schema + OAuth token.
   */
  async invokeDesignerOperation(
    operation: DesignerOperation,
    values: Record<string, string>,
    expectedSiteID: SiteID,
  ): Promise<void> {
    const token = await this.tokenProvider();
    if (!token) throw MCPError.mcpUnavailable();
    const tools = await this.fetchTools(token);
    const resolved = resolveDesignerOperation(
      tools.map(toPublicTool),
      operation,
      values,
      String(expectedSiteID),
    );
    if (!resolved) throw MCPError.toolNotFound(operation);
    await this.callToolUnchecked(token, resolved.name, resolved.arguments);
  }

  async callTool<T = unknown>(
    name: string,
    arguments_: Record<string, string>,
  ): Promise<MCPToolResult<T>> {
    const token = await this.tokenProvider();
    if (!token) throw MCPError.mcpUnavailable();
    return this.callToolUnchecked<T>(token, name, arguments_);
  }

  private async callToolUnchecked<T = unknown>(
    token: string,
    name: string,
    arguments_: Record<string, unknown>,
  ): Promise<MCPToolResult<T>> {
    const result = await this.requestRPC(token, 'tools/call', {
      name,
      arguments: arguments_,
    });
    if (!isRecord(result) || !Array.isArray(result.content)) {
      throw MCPError.invalidResponse();
    }
    if (result.isError === true) throw MCPError.toolFailed(name);
    if (!result.content.every(isContentBlock)) throw MCPError.invalidResponse();
    const structuredContent = result.structuredContent;
    if (structuredContent != null && !isRecord(structuredContent)) {
      throw MCPError.invalidResponse();
    }
    return {
      structuredContent: (structuredContent ?? null) as T | null,
      content: result.content,
    };
  }

  private async fetchTools(
    token: string,
  ): Promise<RawMCPTool[]> {
    const result = await this.requestRPC(token, 'tools/list', {});
    if (!isRecord(result) || !Array.isArray(result.tools)) {
      throw MCPError.invalidResponse();
    }
    if (!result.tools.every(isToolDescription)) throw MCPError.invalidResponse();
    return result.tools;
  }

  private async ensureInitialized(token: string): Promise<void> {
    if (this.negotiatedVersion && this.initializedToken === token) return;
    if (this.initializedToken !== token) {
      this.sessionID = null;
      this.negotiatedVersion = null;
    }
    if (this.initialization) return this.initialization;
    this.initialization = this.initialize(token).finally(() => {
      this.initialization = null;
    });
    return this.initialization;
  }

  private async initialize(token: string): Promise<void> {
    const id = ++this.requestID;
    const response = await this.send(token, {
      jsonrpc: '2.0',
      id,
      method: 'initialize',
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'Mobileflow', version: '0.1.0' },
      },
    }, false);
    if (!response.ok) throw MCPError.mcpUnavailable();
    const json = await parseRPCResponse(response, id);
    if (!isRecord(json.result)) throw MCPError.invalidResponse();
    const version = json.result.protocolVersion;
    if (typeof version !== 'string' || !SUPPORTED_PROTOCOL_VERSIONS.has(version)) {
      throw MCPError.invalidResponse();
    }
    const sessionID = response.headers.get('Mcp-Session-Id');
    if (sessionID != null && !/^[\x21-\x7e]+$/.test(sessionID)) {
      throw MCPError.invalidResponse();
    }
    this.negotiatedVersion = version;
    this.initializedToken = token;
    this.sessionID = sessionID;

    const initialized = await this.send(token, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    if (initialized.status !== 202) throw MCPError.mcpUnavailable();
  }

  private async requestRPC(
    token: string,
    method: string,
    params: Record<string, unknown>,
    retried = false,
  ): Promise<unknown> {
    await this.ensureInitialized(token);
    const id = ++this.requestID;
    const response = await this.send(token, {
      jsonrpc: '2.0',
      id,
      method,
      params,
    });
    if (response.status === 404 && this.sessionID && !retried) {
      this.sessionID = null;
      this.negotiatedVersion = null;
      this.initializedToken = null;
      return this.requestRPC(token, method, params, true);
    }
    if (!response.ok) {
      if (response.status === 404 && method === 'tools/call') {
        const resource = typeof params.name === 'string' ? params.name : method;
        throw MCPError.toolNotFound(resource);
      }
      throw MCPError.mcpUnavailable();
    }
    const json = await parseRPCResponse(response, id);
    if (isRecord(json.error)) {
      if (json.error.code === -32601 && method === 'tools/call') {
        const tool = typeof params.name === 'string' ? params.name : method;
        throw MCPError.toolNotFound(tool);
      }
      throw MCPError.invalidResponse();
    }
    if (!('result' in json)) throw MCPError.invalidResponse();
    return json.result;
  }

  private send(
    token: string,
    message: Record<string, unknown>,
    includeNegotiation = true,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (includeNegotiation && this.negotiatedVersion) {
      headers['MCP-Protocol-Version'] = this.negotiatedVersion;
    }
    if (this.sessionID) headers['Mcp-Session-Id'] = this.sessionID;
    return this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
    });
  }
}

async function parseRPCResponse(
  response: Response,
  expectedID: number,
): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? '';
  let candidates: unknown[];
  try {
    const text = await response.text();
    if (contentType.includes('text/event-stream')) {
      candidates = text
        .split(/\r?\n\r?\n/)
        .flatMap((event) => {
          const data = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n');
          if (!data) return [];
          return [JSON.parse(data) as unknown];
        });
    } else {
      candidates = [JSON.parse(text) as unknown];
    }
  } catch {
    throw MCPError.invalidResponse();
  }
  const json = candidates.find(
    (candidate) =>
      isRecord(candidate) &&
      candidate.jsonrpc === '2.0' &&
      candidate.id === expectedID,
  );
  if (!isRecord(json)) throw MCPError.invalidResponse();
  return json;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isToolDescription(
  value: unknown,
): value is RawMCPTool {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    (value.description === undefined || typeof value.description === 'string') &&
    isInputSchema(value.inputSchema)
  );
}

function isContentBlock(value: unknown): value is MCPContentBlock {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    (value.text == null || typeof value.text === 'string')
  );
}

function toolResultValues(result: MCPToolResult): unknown[] {
  const text = result.content
    .map((block) => block.text)
    .filter((value): value is string => typeof value === 'string')
    .flatMap((value) => {
      try {
        return [JSON.parse(value) as unknown];
      } catch {
        return [];
      }
    });
  return [result.structuredContent, ...text].filter((value) => value != null);
}

function findStringField(result: MCPToolResult, names: string[]): string | null {
  const wanted = new Set(names);
  const visit = (value: unknown): string | null => {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
    } else if (isRecord(value)) {
      for (const [key, item] of Object.entries(value)) {
        if (wanted.has(key) && typeof item === 'string') return item;
        const found = visit(item);
        if (found) return found;
      }
    }
    return null;
  };
  for (const value of toolResultValues(result)) {
    const found = visit(value);
    if (found) return found;
  }
  return null;
}

function isDesignerMode(value: string | null): value is DesignerMode {
  return value === 'design' || value === 'edit' || value === 'preview' ||
    value === 'build' || value === 'comment';
}

interface RawMCPTool {
  name: string;
  description?: string;
  inputSchema: MCPInputSchema;
}

function isInputSchema(value: unknown): value is MCPInputSchema {
  if (!isRecord(value) || value.type !== 'object' || !isRecord(value.properties)) {
    return false;
  }
  if (value.required !== undefined &&
      (!Array.isArray(value.required) || !value.required.every((item) => typeof item === 'string'))) {
    return false;
  }
  return Object.values(value.properties).every(
    (property) => isRecord(property) &&
      (property.type === undefined || typeof property.type === 'string') &&
      (property.description === undefined || typeof property.description === 'string'),
  );
}

function toPublicTool(tool: RawMCPTool): MCPTool {
  return {
    name: tool.name,
    description: tool.description ?? '',
    requiresLiveSession: toolRequiresLiveSession(tool),
    isReadOnly: toolIsReadOnly(tool),
    inputSchema: {
      type: 'object',
      properties: tool.inputSchema.properties,
      required: tool.inputSchema.required ?? [],
    },
  };
}

function toolText(tool: { name: string; description?: string }): string {
  return `${tool.name} ${tool.description ?? ''}`.toLowerCase().replace(/[_-]+/g, ' ');
}

/**
 * Live session only for canvas/selection/snapshot tools (MCP 2.0 Bridge remnant).
 * Headless data_* tools do not require a Designer session.
 */
function toolRequiresLiveSession(tool: { name: string; description?: string }): boolean {
  const text = toolText(tool);
  const name = tool.name.toLowerCase();
  if (name.startsWith('data_')) return false;
  if (name === 'designer_tool' || name.includes('designer_tool')) return true;
  return (
    /\b(snapshot|screenshot|selection|selected element|canvas|breakpoint)\b/.test(
      text,
    ) && !name.startsWith('data_')
  );
}

function toolIsReadOnly(tool: { name: string; description?: string }): boolean {
  const text = toolText(tool);
  return (
    /\b(get|list|read|status|context|current)\b/.test(text) &&
    !/\b(create|delete|remove|set|update|write|publish)\b/.test(text)
  );
}

/** Optional probe for live Designer context via designer_tool (or equivalent). */
function resolveLiveSessionProbe(
  tools: RawMCPTool[],
  expectedSiteID: string,
): { tool: RawMCPTool; arguments: Record<string, string> } | null {
  const matches = tools.flatMap((tool) => {
    const text = toolText(tool);
    const name = tool.name.toLowerCase();
    const isSessionTool =
      name === 'designer_tool' ||
      name.includes('designer_tool') ||
      (text.includes('designer') &&
        /\b(context|current|status|page|selection|mode)\b/.test(text) &&
        !name.startsWith('data_'));
    if (!isSessionTool) return [];
    const siteKey = schemaKey(tool.inputSchema, ['siteId', 'site_id']);
    if (siteKey) {
      if (hasUnsupportedRequired(tool.inputSchema, [siteKey])) return [];
      return [{ tool, arguments: { [siteKey]: expectedSiteID } }];
    }
    if ((tool.inputSchema.required ?? []).length === 0) {
      return [{ tool, arguments: {} }];
    }
    return [];
  });
  return matches.length === 1 ? matches[0]! : null;
}

const OPERATION_FIELDS: Record<DesignerOperation, Record<string, string[]>> = {
  updateVariable: {
    variableID: ['variableId', 'variable_id', 'id'],
    value: ['value', 'newValue', 'new_value', 'tokenValue', 'token_value'],
  },
  updateElementText: {
    elementID: ['elementId', 'element_id', 'id'],
    text: ['text', 'content', 'value', 'newText', 'new_text'],
  },
  updateComponentProp: {
    componentID: [
      'componentId',
      'component_id',
      'instanceId',
      'instance_id',
      'id',
    ],
    propName: [
      'propName',
      'prop_name',
      'propertyName',
      'property_name',
      'prop',
      'name',
    ],
    value: ['value', 'propValue', 'prop_value', 'newValue', 'new_value'],
  },
};

export function designerOperationIsAvailable(
  tools: MCPTool[],
  operation: DesignerOperation,
): boolean {
  const placeholderValues = Object.fromEntries(
    Object.keys(OPERATION_FIELDS[operation]).map((key) => [key, 'verified']),
  );
  return resolveDesignerOperation(tools, operation, placeholderValues, 'verified') != null;
}

export function resolveDesignerOperation(
  tools: MCPTool[],
  operation: DesignerOperation,
  values: Record<string, string>,
  expectedSiteID: string,
): { name: string; arguments: Record<string, string> } | null {
  const matches = tools.flatMap((tool) => {
    // Prefer headless data_* tools; skip pure live-session tools for writes
    if (tool.requiresLiveSession && !tool.name.toLowerCase().startsWith('data_')) {
      return [];
    }
    if (tool.isReadOnly) return [];
    const text = toolText(tool);
    const name = tool.name.toLowerCase();
    const semanticMatch =
      operation === 'updateVariable'
        ? (text.includes('variable') || name.includes('variable') || name.includes('style')) &&
          /\b(update|set|write|prop)\b/.test(text + ' ' + name)
        : operation === 'updateElementText'
          ? (text.includes('text') || text.includes('element') || name.includes('element')) &&
            /\b(update|set|write|text)\b/.test(text + ' ' + name)
          : (text.includes('component') || name.includes('component')) &&
            (/\b(prop|property|variant)\b/.test(text) || name.includes('prop')) &&
            /\b(update|set|write|prop)\b/.test(text + ' ' + name);
    if (!semanticMatch) return [];

    const args: Record<string, string> = {};
    const supportedKeys: string[] = [];
    for (const [valueKey, aliases] of Object.entries(OPERATION_FIELDS[operation])) {
      const propertyKey = schemaKey(tool.inputSchema, aliases);
      const value = values[valueKey];
      if (!propertyKey || !value) return [];
      args[propertyKey] = value;
      supportedKeys.push(propertyKey);
    }
    const siteKey = schemaKey(tool.inputSchema, ['siteId', 'site_id']);
    if (siteKey) {
      args[siteKey] = expectedSiteID;
      supportedKeys.push(siteKey);
    }
    // Branch is optional for headless tools; only attach when provided and schema allows
    if (values.branchID) {
      const branchKey = schemaKey(tool.inputSchema, ['branchId', 'branch_id']);
      if (branchKey) {
        args[branchKey] = values.branchID;
        supportedKeys.push(branchKey);
      }
    }
    if (hasUnsupportedRequired(tool.inputSchema, supportedKeys)) return [];
    return [{ name: tool.name, arguments: args }];
  });
  // Prefer data_* tool when multiple match
  if (matches.length > 1) {
    const data = matches.filter((m) => m.name.toLowerCase().startsWith('data_'));
    if (data.length === 1) return data[0]!;
    return null;
  }
  return matches.length === 1 ? matches[0]! : null;
}

function schemaKey(schema: MCPInputSchema, aliases: string[]): string | null {
  const normalizedAliases = new Set(aliases.map(normalizeKey));
  const matches = Object.entries(schema.properties).filter(([key, property]) => {
    if (!normalizedAliases.has(normalizeKey(key))) return false;
    // Accept string or untyped properties (MCP often omits type)
    return property.type === undefined || property.type === 'string';
  });
  return matches.length === 1 ? matches[0]![0] : null;
}

function hasUnsupportedRequired(schema: MCPInputSchema, supported: string[]): boolean {
  const supportedSet = new Set(supported);
  return (schema.required ?? []).some((key) => !supportedSet.has(key));
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
