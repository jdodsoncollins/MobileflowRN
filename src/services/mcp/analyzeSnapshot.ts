import type { SiteID } from '../../domain/models/ids';
import {
  emptyAnalyzeSnapshot,
  parseAnalyzeSnapshot,
  type SiteAnalyzeSnapshot,
} from '../../domain/planning/siteAnalyze';
import type { MCPTool, WebflowMCPClient } from './types';

export async function fetchAnalyzeSnapshot(
  mcp: WebflowMCPClient,
  tools: MCPTool[],
  siteID: SiteID,
): Promise<SiteAnalyzeSnapshot> {
  const tool = tools.find((entry) =>
    /analyze/i.test(entry.name),
  );
  if (!tool) {
    return emptyAnalyzeSnapshot(
      'unavailable',
      'Analyze is not on this connection. Reconnect after granting MCP Analyze access, or enable the add-on in Webflow.',
    );
  }
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  try {
    const result = await mcp.callTool<unknown>(tool.name, {
      action: 'get_top_pages_report',
      site_id: String(siteID),
      siteId: String(siteID),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      limit: '5',
    });
    const payload = result.structuredContent ?? parseContentJSON(result.content);
    return parseAnalyzeSnapshot(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/add-on|not enabled|unavailable|forbidden|404/i.test(message)) {
      return emptyAnalyzeSnapshot(
        'unavailable',
        'Webflow Analyze is not enabled for this site.',
      );
    }
    return emptyAnalyzeSnapshot(
      'unavailable',
      'Could not load Analyze. Try again after reconnecting.',
    );
  }
}

function parseContentJSON(
  content: { type: string; text?: string | null }[],
): unknown {
  for (const block of content) {
    const text = block.text?.trim();
    if (!text) continue;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      continue;
    }
  }
  return null;
}
