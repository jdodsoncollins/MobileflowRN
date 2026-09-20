import type { LiveDesignerContext } from '../../domain/models/designerContext';
import { emptyDesignerContext } from '../../domain/models/designerContext';
import type { SiteID } from '../../domain/models/ids';
import { pageID, siteID } from '../../domain/models/ids';
import type { DesignerMode } from '../../domain/models/webflowModels';
import type { WebflowMCPClient } from './types';

/**
 * Best-effort designer context via headless MCP tools + optional live session.
 * Never invents IDs — empty lists if tools fail.
 */
export async function fetchLiveDesignerContext(
  mcp: WebflowMCPClient,
  opts: { selectedSiteID: SiteID | null },
): Promise<LiveDesignerContext> {
  const base = emptyDesignerContext();
  base.updatedAt = new Date().toISOString();

  if (!opts.selectedSiteID) {
    base.rawNotes = 'Select a site to load MCP designer context.';
    return base;
  }

  base.siteID = opts.selectedSiteID;

  const session = await mcp.liveSessionStatus(opts.selectedSiteID);
  if (session.status === 'connected') {
    base.mode = session.mode as DesignerMode;
    if (session.pageID) base.pageID = pageID(String(session.pageID));
    base.siteID = siteID(String(session.siteID));
    base.rawNotes =
      'Live Designer session connected (optional under MCP 2.0).';
  } else {
    base.rawNotes =
      'Headless MCP mode — no live Designer session. Enter live IDs for writes; Bridge is not required.';
  }

  const tools = await mcp.listTools().catch(() => []);
  const tryCall = async (nameFragment: string): Promise<string | null> => {
    try {
      const match = tools.find(
        (t) =>
          t.isReadOnly &&
          !t.requiresLiveSession &&
          t.name.toLowerCase().includes(nameFragment),
      );
      if (!match) return null;
      const args: Record<string, string> = {};
      const siteKey = Object.keys(match.inputSchema.properties).find((k) =>
        /site[_-]?id/i.test(k),
      );
      if (siteKey) args[siteKey] = String(opts.selectedSiteID);
      const res = await mcp.callTool(match.name, args);
      const text = res.content?.map((c) => c.text).filter(Boolean).join('\n');
      return text || JSON.stringify(res.structuredContent ?? {});
    } catch {
      return null;
    }
  };

  const vars = await tryCall('variable');
  const comps = await tryCall('component');
  if (vars) base.variableIDs = extractIds(vars).slice(0, 40);
  if (comps) base.componentIDs = extractIds(comps).slice(0, 40);

  return base;
}

function extractIds(text: string): string[] {
  const matches = text.match(/\b[a-f0-9]{8,}\b|\b[a-z]+_[a-zA-Z0-9]+\b/gi) ?? [];
  return [...new Set(matches)];
}
