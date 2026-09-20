import type { DesignerOperation, MCPTool } from '../../services/mcp';
import { designerOperationIsAvailable } from '../../services/mcp/webflowMCPClient';

export interface DesignerToolAvailability {
  tools: MCPTool[];
  selectedSiteID: string | null;
}

export function operationIsAvailable(
  avail: DesignerToolAvailability,
  operation: DesignerOperation,
): boolean {
  if (!avail.selectedSiteID) return false;
  return designerOperationIsAvailable(avail.tools, operation);
}

export function operationUnavailableReason(
  avail: DesignerToolAvailability,
  operation: DesignerOperation,
): string | null {
  if (!avail.selectedSiteID) return 'Select a site first';
  if (!designerOperationIsAvailable(avail.tools, operation)) {
    return 'No compatible headless MCP tool schema for this write';
  }
  return null;
}

/** @deprecated Prefer operationIsAvailable with DesignerOperation */
export function toolIsAvailable(
  avail: DesignerToolAvailability & { bridgeStatus?: unknown },
  toolName: string,
): boolean {
  const tool = avail.tools.find((t) => t.name === toolName);
  if (!tool) return false;
  if (tool.requiresLiveSession) return false;
  return true;
}

/** @deprecated Prefer operationUnavailableReason */
export function toolUnavailableReason(
  avail: DesignerToolAvailability & { bridgeStatus?: unknown },
  toolName: string,
): string | null {
  const tool = avail.tools.find((t) => t.name === toolName);
  if (!tool) return 'Tool not registered';
  if (tool.requiresLiveSession) {
    return 'Requires a live Designer session (optional under MCP 2.0)';
  }
  return null;
}
