import { describe, expect, it, vi } from 'vitest';
import { siteID } from '../src/domain/models/ids';
import {
  designerOperationIsAvailable,
  resolveDesignerOperation,
  WebflowMCPClientImpl,
} from '../src/services/mcp/webflowMCPClient';
import type { MCPTool } from '../src/services/mcp/types';
import { designerWritesSiteReady } from '../src/domain/models/webflowModels';

type RPCRequest = { id?: number; method: string; params?: Record<string, unknown> };

function rpcResponse(
  request: RPCRequest,
  result: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id: request.id, result }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...headers } },
  );
}

function createServer(
  tools: Array<string | { name: string; description?: string; schema?: object }>,
  toolResult?: (name: string) => unknown,
  sseTools = false,
) {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as RPCRequest;
    if (request.method === 'initialize') {
      return rpcResponse(
        request,
        {
          protocolVersion: '2025-06-18',
          capabilities: {},
          serverInfo: { name: 'Webflow', version: '2' },
        },
        { 'Mcp-Session-Id': 'session-123' },
      );
    }
    if (request.method === 'notifications/initialized') {
      return new Response(null, { status: 202 });
    }
    if (request.method === 'tools/list') {
      const result = {
        tools: tools.map((entry) => {
          const name = typeof entry === 'string' ? entry : entry.name;
          const description =
            typeof entry === 'string'
              ? name === 'designer_tool'
                ? 'Get current Designer page context'
                : name
              : (entry.description ?? name);
          const inputSchema =
            typeof entry === 'string'
              ? {
                  type: 'object',
                  properties:
                    name === 'designer_tool'
                      ? { siteId: { type: 'string' } }
                      : {},
                  required: name === 'designer_tool' ? ['siteId'] : [],
                }
              : (entry.schema ?? {
                  type: 'object',
                  properties: {},
                  required: [],
                });
          return { name, description, inputSchema };
        }),
      };
      if (sseTools) {
        const body = `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/progress' })}\n\nevent: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: request.id, result })}\n\n`;
        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }
      return rpcResponse(request, result);
    }
    const name = (request.params?.name as string | undefined) ?? '';
    return rpcResponse(
      request,
      toolResult?.(name) ?? {
        content: [{ type: 'text', text: 'ok' }],
        structuredContent: { value: 1 },
      },
    );
  });
}

describe('WebflowMCPClient Streamable HTTP contract', () => {
  it('resolves headless data_* variable write tools without live session', () => {
    const tools: MCPTool[] = [
      {
        name: 'data_style_tool',
        description: 'Update a style variable value',
        requiresLiveSession: false,
        isReadOnly: false,
        inputSchema: {
          type: 'object',
          properties: {
            site_id: { type: 'string' },
            variable_id: { type: 'string' },
            value: { type: 'string' },
          },
          required: ['site_id', 'variable_id', 'value'],
        },
      },
    ];
    expect(designerOperationIsAvailable(tools, 'updateVariable')).toBe(true);
    expect(
      resolveDesignerOperation(
        tools,
        'updateVariable',
        { variableID: 'var-1', value: '#fff' },
        'site-1',
      ),
    ).toEqual({
      name: 'data_style_tool',
      arguments: {
        site_id: 'site-1',
        variable_id: 'var-1',
        value: '#fff',
      },
    });
  });

  it('prefers data_* tools when multiple match', () => {
    const base = {
      description: 'Update Designer variable',
      requiresLiveSession: false as const,
      isReadOnly: false,
      inputSchema: {
        type: 'object' as const,
        properties: {
          variableId: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['variableId', 'value'],
      },
    };
    const tools: MCPTool[] = [
      { ...base, name: 'legacy_variable_update' },
      { ...base, name: 'data_variable_tool', requiresLiveSession: false },
    ];
    expect(
      resolveDesignerOperation(
        tools,
        'updateVariable',
        { variableID: 'v', value: 'x' },
        'site',
      )?.name,
    ).toBe('data_variable_tool');
  });

  it('fails closed for ambiguous write schemas', () => {
    const tool: MCPTool = {
      name: 'set_designer_variable',
      description: 'Update Designer variable',
      requiresLiveSession: false,
      isReadOnly: false,
      inputSchema: {
        type: 'object',
        properties: {
          variableId: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['variableId', 'value'],
      },
    };
    expect(
      resolveDesignerOperation(
        [tool, { ...tool, name: 'set_designer_variable_v2' }],
        'updateVariable',
        { variableID: 'v', value: 'x' },
        'site',
      ),
    ).toBeNull();
  });

  it('site readiness only requires a selected site', () => {
    expect(designerWritesSiteReady(siteID('site'))).toBe(true);
    expect(designerWritesSiteReady(null)).toBe(false);
  });

  it('negotiates a session, sends initialized, propagates headers, and parses SSE', async () => {
    const fetchImpl = createServer(['data_sites_tool'], undefined, true);
    const client = new WebflowMCPClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(await client.listTools()).toHaveLength(1);
    const requests = fetchImpl.mock.calls.map(([, init]) => init as RequestInit);
    expect(JSON.parse(String(requests[0]?.body))).toMatchObject({
      method: 'initialize',
    });
    expect(JSON.parse(String(requests[1]?.body))).toMatchObject({
      method: 'notifications/initialized',
    });
    expect(requests[2]?.headers).toMatchObject({
      'Mcp-Session-Id': 'session-123',
      'MCP-Protocol-Version': '2025-06-18',
      Accept: 'application/json, text/event-stream',
    });
  });

  it('does not require live session for headless designer writes', async () => {
    const fetchImpl = createServer([
      {
        name: 'data_style_tool',
        description: 'Update a style variable value',
        schema: {
          type: 'object',
          properties: {
            siteId: { type: 'string' },
            variableId: { type: 'string' },
            value: { type: 'string' },
          },
          required: ['siteId', 'variableId', 'value'],
        },
      },
    ]);
    const client = new WebflowMCPClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      client.invokeDesignerOperation(
        'updateVariable',
        { variableID: 'var_1', value: '#000' },
        siteID('site'),
      ),
    ).resolves.toBeUndefined();
    // live session may still be unavailable
    expect(await client.liveSessionStatus(siteID('site'))).toEqual({
      status: 'unavailable',
    });
  });

  it('optional live session probe needs matching site + mode', async () => {
    const fetchImpl = createServer(
      ['data_sites_tool', 'designer_tool'],
      (name) =>
        name === 'data_sites_tool'
          ? { content: [], structuredContent: { site: { id: 'site' } } }
          : {
              content: [],
              structuredContent: {
                siteId: 'site',
                pageId: 'page',
                mode: 'design',
              },
            },
    );
    const client = new WebflowMCPClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(await client.liveSessionStatus(siteID('site'))).toMatchObject({
      status: 'connected',
      siteID: 'site',
      pageID: 'page',
    });
  });

  it('live session fails closed when probe reports another site', async () => {
    const fetchImpl = createServer(
      ['designer_tool'],
      () => ({
        content: [],
        structuredContent: { siteId: 'other', pageId: 'page', mode: 'design' },
      }),
    );
    const client = new WebflowMCPClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(await client.liveSessionStatus(siteID('site'))).toEqual({
      status: 'unavailable',
    });
  });

  it('returns validated tools/call content and structured content', async () => {
    const fetchImpl = createServer(['data_sites_tool']);
    const client = new WebflowMCPClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.callTool<{ value: number }>('data_sites_tool', {});
    expect(result.content).toEqual([{ type: 'text', text: 'ok' }]);
    expect(result.structuredContent).toEqual({ value: 1 });
  });

  it('rejects malformed tool results', async () => {
    const fetchImpl = createServer(['data_sites_tool'], () => ({
      content: 'raw body',
    }));
    const client = new WebflowMCPClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.callTool('data_sites_tool', {})).rejects.toMatchObject({
      kind: 'invalidResponse',
    });
  });

  it('maps tool execution errors without exposing server content', async () => {
    const fetchImpl = createServer(['data_sites_tool'], () => ({
      content: [{ type: 'text', text: 'secret server trace' }],
      isError: true,
    }));
    const client = new WebflowMCPClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.callTool('data_sites_tool', {})).rejects.toMatchObject({
      kind: 'toolFailed',
      message: 'MCP tool data_sites_tool failed.',
    });
  });

  it('rejects unsupported negotiated protocol versions', async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as RPCRequest;
        return rpcResponse(request, { protocolVersion: '2099-01-01' });
      },
    );
    const client = new WebflowMCPClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(await client.listTools()).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each(['build', 'comment'] as const)(
    'preserves %s mode on live session without coercion',
    async (mode) => {
      const fetchImpl = createServer(
        ['designer_tool'],
        () => ({
          content: [],
          structuredContent: { siteId: 'site', mode },
        }),
      );
      const client = new WebflowMCPClientImpl({
        tokenProvider: async () => 'token',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(await client.liveSessionStatus(siteID('site'))).toMatchObject({
        mode,
      });
    },
  );
});
