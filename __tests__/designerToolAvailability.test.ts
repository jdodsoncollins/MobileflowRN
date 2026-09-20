import { describe, expect, it } from 'vitest';
import {
  operationIsAvailable,
  operationUnavailableReason,
  toolIsAvailable,
  toolUnavailableReason,
} from '../src/features/designer/designerToolAvailability';
import type { MCPTool } from '../src/services/mcp/types';

const headlessWrite: MCPTool = {
  name: 'data_style_tool',
  description: 'Update a style variable value',
  requiresLiveSession: false,
  isReadOnly: false,
  inputSchema: {
    type: 'object',
    properties: {
      siteId: { type: 'string' },
      variableId: { type: 'string' },
      value: { type: 'string' },
    },
    required: ['siteId', 'variableId', 'value'],
  },
};

const liveOnly: MCPTool = {
  name: 'designer_tool',
  description: 'Live Designer selection and canvas',
  requiresLiveSession: true,
  isReadOnly: true,
  inputSchema: {
    type: 'object',
    properties: { siteId: { type: 'string' } },
    required: ['siteId'],
  },
};

describe('designerToolAvailability', () => {
  it('allows headless operations when site selected and schema matches', () => {
    const avail = {
      tools: [headlessWrite],
      selectedSiteID: 'site_1',
    };
    expect(operationIsAvailable(avail, 'updateVariable')).toBe(true);
    expect(operationUnavailableReason(avail, 'updateVariable')).toBeNull();
  });

  it('blocks operations without a selected site', () => {
    const avail = {
      tools: [headlessWrite],
      selectedSiteID: null,
    };
    expect(operationIsAvailable(avail, 'updateVariable')).toBe(false);
    expect(operationUnavailableReason(avail, 'updateVariable')).toContain(
      'Select a site',
    );
  });

  it('blocks when no matching headless tool exists', () => {
    const avail = {
      tools: [liveOnly],
      selectedSiteID: 'site_1',
    };
    expect(operationIsAvailable(avail, 'updateVariable')).toBe(false);
    expect(operationUnavailableReason(avail, 'updateVariable')).toContain(
      'headless',
    );
  });

  it('marks live-session tools as unavailable for generic tool checks', () => {
    const avail = {
      tools: [liveOnly],
      selectedSiteID: 'site_1',
    };
    expect(toolIsAvailable(avail, 'designer_tool')).toBe(false);
    expect(toolUnavailableReason(avail, 'designer_tool')).toContain(
      'live Designer session',
    );
  });
});
