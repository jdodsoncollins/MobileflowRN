import type { DesignerMode } from './webflowModels';
import type { PageID, SiteID } from './ids';

/** Live / headless designer context from MCP — never fixture-filled. */
export interface LiveDesignerContext {
  siteID: SiteID | null;
  pageID: PageID | null;
  mode: DesignerMode | null;
  selectedElementID: string | null;
  selectedElementLabel: string | null;
  branchID: string | null;
  variableIDs: string[];
  componentIDs: string[];
  rawNotes: string | null;
  updatedAt: string | null;
}

export function emptyDesignerContext(): LiveDesignerContext {
  return {
    siteID: null,
    pageID: null,
    mode: null,
    selectedElementID: null,
    selectedElementLabel: null,
    branchID: null,
    variableIDs: [],
    componentIDs: [],
    rawNotes: null,
    updatedAt: null,
  };
}
