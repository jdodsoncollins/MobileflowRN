import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  detectPlannerCapability,
  OnDeviceActionPlanner,
  type OnDevicePlannerNative,
} from '../src/domain/planning/onDevicePlanner';
import { pageID, siteID } from '../src/domain/models/ids';

const site = siteID('site_1');
const ctx = {
  siteID: site,
  pages: [
    {
      id: pageID('page_home'),
      siteID: site,
      title: 'Home',
      slug: '',
      seoTitle: null,
      seoDescription: null,
      openGraphTitle: null,
      openGraphDescription: null,
      locale: null,
      pageType: 'home' as const,
      slugEditable: true,
      hasDraftChanges: false,
    },
  ],
  collections: [],
};

describe('on-device planner', () => {
  beforeEach(() => {
    delete globalThis.__MOBILEFLOW_ON_DEVICE_PLANNER__;
  });
  afterEach(() => {
    delete globalThis.__MOBILEFLOW_ON_DEVICE_PLANNER__;
  });

  it('detects heuristicOnly without native module', async () => {
    expect(await detectPlannerCapability()).toBe('heuristicOnly');
  });

  it('detects onDeviceAvailable when injected backend is available', async () => {
    const native: OnDevicePlannerNative = {
      async isAvailable() {
        return true;
      },
      async planCommandLines() {
        return 'PUBLISH_PAGE page_home';
      },
    };
    globalThis.__MOBILEFLOW_ON_DEVICE_PLANNER__ = native;
    expect(await detectPlannerCapability()).toBe('onDeviceAvailable');
  });

  it('uses on-device lines then grounds via parser', async () => {
    globalThis.__MOBILEFLOW_ON_DEVICE_PLANNER__ = {
      async isAvailable() {
        return true;
      },
      async planCommandLines() {
        return 'PUBLISH_PAGE page_home';
      },
    };
    const planner = new OnDeviceActionPlanner();
    const plan = await planner.plan('publish homepage', ctx);
    expect(plan.source).toBe('onDevice');
    expect(plan.descriptors[0].action.type).toBe('publishPage');
  });

  it('falls back to heuristic when native fails', async () => {
    globalThis.__MOBILEFLOW_ON_DEVICE_PLANNER__ = {
      async isAvailable() {
        return true;
      },
      async planCommandLines() {
        throw new Error('model offline');
      },
    };
    const planner = new OnDeviceActionPlanner();
    const plan = await planner.plan('publish site', ctx);
    expect(plan.source).toBe('heuristic');
    expect(plan.descriptors[0].action.type).toBe('publishSite');
  });

  it('ignores invented page ids from model output', async () => {
    globalThis.__MOBILEFLOW_ON_DEVICE_PLANNER__ = {
      async isAvailable() {
        return true;
      },
      async planCommandLines() {
        return 'SEO_FIX not_loaded_page';
      },
    };
    const planner = new OnDeviceActionPlanner();
    const plan = await planner.plan('seo', ctx);
    // Parser returns null → heuristic fallback for SEO
    expect(plan.source).toBe('heuristic');
  });
});
