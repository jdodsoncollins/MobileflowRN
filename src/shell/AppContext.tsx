import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ActionPlanner } from '../domain/planning/actionPlanner';
import type {
  ActivityItem,
  DesignerSessionStatus,
  WebflowCMSItem,
  WebflowCollection,
  WebflowConnection,
  WebflowCommentReply,
  WebflowCommentThread,
  WebflowForm,
  WebflowFormSubmission,
  WebflowLocale,
  WebflowPage,
  WebflowSite,
} from '../domain/models/webflowModels';
import type { WebflowAsset } from '../domain/models/contentModels';
import {
  missingSEODescription,
  missingSEOTitle,
} from '../domain/models/webflowModels';
import type { SiteID } from '../domain/models/ids';
import { PublishRateLimitStore } from '../domain/planning/publishRateLimitStore';
import {
  buildRevertDescriptors,
  markActivityReverted,
} from '../domain/planning/activityRevert';
import { newActionPlan } from '../domain/actions/mobileflowAction';
import {
  emptyDesignerContext,
  type LiveDesignerContext,
} from '../domain/models/designerContext';
import {
  ActivityStore,
  AgentInstructionsStore,
  createAppKeyValueStore,
  sanitizeActivityItems,
} from '../services/storage';
import type { ActionPlan } from '../domain/actions/mobileflowAction';
import {
  AuthError,
  bundledOAuthConfig,
  createExpoAuthSessionOpener,
  createPlatformTokenStore,
  TokenStoreKeys,
  WebflowAuthService,
} from '../services/auth';
import { WebflowAPIClientImpl } from '../services/api';
import type { WebflowAPIClient } from '../services/api';
import {
  assertPlanTargetsSite,
  attributeActivityToPlan,
  executeApprovedPlan,
  LiveActionExecutor,
  type ExecutePlanResult,
} from '../services/actions';
import {
  NullMCPClient,
  WebflowMCPClientImpl,
  fetchAnalyzeSnapshot,
  fetchLiveDesignerContext,
  type MCPTool,
  type WebflowMCPClient,
} from '../services/mcp';
import {
  emptyAnalyzeSnapshot,
  type SiteAnalyzeSnapshot,
} from '../domain/planning/siteAnalyze';
import { connectionIsConnected } from '../domain/models/webflowModels';
import { AccessibilityInfo, Platform } from 'react-native';
import { detectPlannerCapability } from '../domain/planning/actionPlanner';
import {
  closeModal,
  navigateTab,
  openCommand,
  openHealth,
  openPublish,
  openSeo,
  openSettings,
} from './nav';
import type { CollectionID } from '../domain/models/ids';
import type { ListCMSItemsOptions } from '../services/api/types';

export type AppTab = 'home' | 'content' | 'activity' | 'advanced';

export interface AppState {
  connection: WebflowConnection;
  selectedSiteID: SiteID | null;
  pages: WebflowPage[];
  collections: WebflowCollection[];
  cmsItems: WebflowCMSItem[];
  cmsItemTotal: number;
  cmsItemHasMore: boolean;
  assets: WebflowAsset[];
  forms: WebflowForm[];
  formSubmissions: WebflowFormSubmission[];
  locales: WebflowLocale[];
  comments: WebflowCommentThread[];
  commentReplies: WebflowCommentReply[];
  analyze: SiteAnalyzeSnapshot;
  mcpTools: import('../services/mcp').MCPTool[];
  recentActivity: ActivityItem[];
  liveSessionStatus: DesignerSessionStatus;
  designerContext: LiveDesignerContext;
  agentInstructions: string | null;
  activeTab: AppTab;
  commandOpen: boolean;
  seoDraftOpen: boolean;
  publishOpen: boolean;
  settingsOpen: boolean;
  healthOpen: boolean;
  pendingPlan: ActionPlan | null;
  lastError: string | null;
  isBusy: boolean;
  isRehydrating: boolean;
  isExecuting: boolean;
  onDeviceAvailable: boolean;
}

interface AppContextValue extends AppState {
  planner: ActionPlanner;
  activityStore: ActivityStore;
  publishRateLimit: PublishRateLimitStore;
  agentInstructionsStore: AgentInstructionsStore;
  setActiveTab: (tab: AppTab) => void;
  setCommandOpen: (open: boolean) => void;
  setSeoDraftOpen: (open: boolean) => void;
  setPublishOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setHealthOpen: (open: boolean) => void;
  setPendingPlan: (plan: ActionPlan | null) => void;
  loadCMSItems: (
    collectionID: CollectionID,
    opts?: ListCMSItemsOptions & { append?: boolean },
  ) => Promise<void>;
  loadAssets: () => Promise<void>;
  loadForms: () => Promise<void>;
  loadFormSubmissions: (formID: string) => Promise<void>;
  loadLocales: () => Promise<void>;
  loadComments: () => Promise<void>;
  loadCommentReplies: (threadID: string) => Promise<void>;
  loadAnalyze: () => Promise<void>;
  refreshMCP: () => Promise<void>;
  selectSite: (siteID: SiteID | null) => void;
  appendActivity: (item: ActivityItem) => Promise<void>;
  replaceActivity: (items: ActivityItem[]) => Promise<void>;
  clearActivity: () => Promise<void>;
  saveAgentInstructions: (text: string) => Promise<void>;
  /** Build + execute reverse plan from activity change records. */
  revertActivityItem: (item: ActivityItem) => Promise<ExecutePlanResult>;
  selectedSite: WebflowSite | null;
  seoIssuePages: WebflowPage[];
  connect: () => Promise<void>;
  /** Disconnect Webflow while preserving device-local data. */
  disconnect: () => Promise<void>;
  /** Disconnect and permanently delete device-local app data. */
  eraseLocalData: () => Promise<void>;
  refreshSites: () => Promise<void>;
  loadSiteContent: (siteID: SiteID) => Promise<WebflowPage[]>;
  /**
   * Execute a reviewed plan via live executor; append each result to Activity.
   * Pass hardConfirmAcknowledged after the high-risk alert is confirmed.
   */
  executePlan: (
    plan: ActionPlan,
    opts?: { hardConfirmAcknowledged?: boolean },
  ) => Promise<ExecutePlanResult>;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Production durable store (AsyncStorage). Tests keep using MemoryKeyValueStore. */
const kv = createAppKeyValueStore();
const defaultActivityStore = new ActivityStore(kv);
const defaultRateLimit = new PublishRateLimitStore(kv);
const defaultAgentInstructions = new AgentInstructionsStore(kv);
const defaultPlanner = new ActionPlanner();

export function AppProvider({ children }: { children: ReactNode }) {
  const authRef = useRef<WebflowAuthService | null>(null);
  const apiRef = useRef<WebflowAPIClient | null>(null);
  const mcpRef = useRef<WebflowMCPClient | null>(null);
  const executorRef = useRef<LiveActionExecutor | null>(null);
  const tokenStoreRef = useRef(createPlatformTokenStore());
  const selectedSiteNameRef = useRef('Site');
  const selectedSiteIDRef = useRef<SiteID | null>(null);
  const sessionGenerationRef = useRef(0);
  const sitesGenerationRef = useRef(0);
  const siteContentGenerationRef = useRef(0);
  const cmsGenerationRef = useRef(0);
  const mcpGenerationRef = useRef(0);
  const instructionsGenerationRef = useRef(0);
  const executionInFlightRef = useRef(false);

  if (authRef.current == null) {
    const tokenProvider = async () => {
      try {
        return await authRef.current!.accessToken();
      } catch {
        return null;
      }
    };
    authRef.current = new WebflowAuthService({
      store: tokenStoreRef.current,
      config: bundledOAuthConfig,
      openAuthSession: createExpoAuthSessionOpener(),
    });
    apiRef.current = new WebflowAPIClientImpl({ tokenProvider });
    mcpRef.current = new WebflowMCPClientImpl({ tokenProvider });
    executorRef.current = new LiveActionExecutor({
      api: apiRef.current,
      mcp: mcpRef.current ?? new NullMCPClient(),
      siteNameProvider: () => selectedSiteNameRef.current,
      onRateLimited: (siteID, retryAfter) => {
        void defaultRateLimit.recordRateLimited(siteID, retryAfter);
      },
      onPublishSuccess: (siteID) => {
        void defaultRateLimit.recordSuccess(siteID);
      },
    });
  }

  const [connection, setConnection] = useState<WebflowConnection>({
    status: 'disconnected',
  });
  const [selectedSiteID, setSelectedSiteID] = useState<SiteID | null>(null);
  const [pages, setPages] = useState<WebflowPage[]>([]);
  const [collections, setCollections] = useState<WebflowCollection[]>([]);
  const [cmsItems, setCmsItems] = useState<WebflowCMSItem[]>([]);
  const [cmsItemTotal, setCmsItemTotal] = useState(0);
  const [cmsItemHasMore, setCmsItemHasMore] = useState(false);
  const [assets, setAssets] = useState<WebflowAsset[]>([]);
  const [forms, setForms] = useState<WebflowForm[]>([]);
  const [formSubmissions, setFormSubmissions] = useState<WebflowFormSubmission[]>(
    [],
  );
  const [locales, setLocales] = useState<WebflowLocale[]>([]);
  const [comments, setComments] = useState<WebflowCommentThread[]>([]);
  const [commentReplies, setCommentReplies] = useState<WebflowCommentReply[]>(
    [],
  );
  const [analyze, setAnalyze] = useState<SiteAnalyzeSnapshot>(
    emptyAnalyzeSnapshot('empty', 'Select a site to load Analyze.'),
  );
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [liveSessionStatus, setLiveSessionStatus] = useState<DesignerSessionStatus>({
    status: 'unavailable',
  });
  const [designerContext, setDesignerContext] = useState<LiveDesignerContext>(
    emptyDesignerContext(),
  );
  const [agentInstructions, setAgentInstructions] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTabState] = useState<AppTab>('home');
  const [commandOpen, setCommandOpenState] = useState(false);
  const [seoDraftOpen, setSeoDraftOpenState] = useState(false);
  const [publishOpen, setPublishOpenState] = useState(false);
  const [settingsOpen, setSettingsOpenState] = useState(false);
  const [healthOpen, setHealthOpenState] = useState(false);
  const [onDeviceAvailable, setOnDeviceAvailable] = useState(false);

  const setActiveTab = useCallback((tab: AppTab) => {
    setActiveTabState(tab);
    navigateTab(tab);
  }, []);
  const setCommandOpen = useCallback((open: boolean) => {
    setCommandOpenState(open);
    if (open) openCommand();
    else closeModal();
  }, []);
  const setSeoDraftOpen = useCallback((open: boolean) => {
    setSeoDraftOpenState(open);
    if (open) openSeo();
    else closeModal();
  }, []);
  const setPublishOpen = useCallback((open: boolean) => {
    setPublishOpenState(open);
    if (open) openPublish();
    else closeModal();
  }, []);
  const setSettingsOpen = useCallback((open: boolean) => {
    setSettingsOpenState(open);
    if (open) openSettings();
    else closeModal();
  }, []);
  const setHealthOpen = useCallback((open: boolean) => {
    setHealthOpenState(open);
    if (open) openHealth();
    else closeModal();
  }, []);
  const [pendingPlan, setPendingPlan] = useState<ActionPlan | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isRehydrating, setIsRehydrating] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);

  const appendActivity = useCallback(async (item: ActivityItem) => {
    const sanitized = sanitizeActivityItems([item])[0];
    if (!sanitized) return;
    setRecentActivity((current) =>
      sanitizeActivityItems([sanitized, ...current.filter((entry) => entry.id !== sanitized.id)]),
    );
    const next = await defaultActivityStore.append(sanitized);
    setRecentActivity(next);
  }, []);

  const replaceActivity = useCallback(async (items: ActivityItem[]) => {
    const next = sanitizeActivityItems(items);
    await defaultActivityStore.save(next);
    setRecentActivity(next);
  }, []);

  const clearActivity = useCallback(async () => {
    await defaultActivityStore.clear();
    setRecentActivity([]);
  }, []);

  const loadAgentInstructionsForSite = useCallback(async (siteID: SiteID) => {
    const generation = ++instructionsGenerationRef.current;
    const session = sessionGenerationRef.current;
    const text = await defaultAgentInstructions.load(siteID);
    if (
      session === sessionGenerationRef.current &&
      generation === instructionsGenerationRef.current &&
      selectedSiteIDRef.current === siteID
    ) {
      setAgentInstructions(text);
    }
  }, []);

  const saveAgentInstructions = useCallback(
    async (text: string) => {
      if (!selectedSiteID) return;
      const siteID = selectedSiteID;
      await defaultAgentInstructions.save(siteID, text);
      if (selectedSiteIDRef.current === siteID) {
        setAgentInstructions(text.trim() ? text.trim() : null);
      }
    },
    [selectedSiteID],
  );

  const loadCMSItems = useCallback(
    async (
      collectionID: CollectionID,
      opts?: ListCMSItemsOptions & { append?: boolean },
    ) => {
      const api = apiRef.current;
      if (!api) return;
      const generation = ++cmsGenerationRef.current;
      const session = sessionGenerationRef.current;
      const siteID = selectedSiteIDRef.current;
      const offset = opts?.offset ?? 0;
      const append = opts?.append === true && offset > 0;
      try {
        const page = await api.listCMSItemsPage(collectionID, {
          limit: opts?.limit,
          offset,
          query: opts?.query,
          live: opts?.live,
        });
        if (
          session !== sessionGenerationRef.current ||
          generation !== cmsGenerationRef.current ||
          selectedSiteIDRef.current !== siteID
        ) {
          return;
        }
        setCmsItems((current) =>
          append ? [...current, ...page.items] : page.items,
        );
        setCmsItemTotal(page.total);
        setCmsItemHasMore(offset + page.items.length < page.total);
      } catch (e) {
        if (
          session !== sessionGenerationRef.current ||
          generation !== cmsGenerationRef.current
        ) {
          return;
        }
        setLastError(e instanceof Error ? e.message : String(e));
        if (!append) {
          setCmsItems([]);
          setCmsItemTotal(0);
          setCmsItemHasMore(false);
        }
      }
    },
    [],
  );

  const loadAssets = useCallback(async () => {
    const api = apiRef.current;
    const siteID = selectedSiteIDRef.current;
    if (!api || !siteID) {
      setAssets([]);
      return;
    }
    try {
      const next = await api.listAssets(siteID);
      if (selectedSiteIDRef.current === siteID) setAssets(next);
    } catch (e) {
      if (selectedSiteIDRef.current === siteID) {
        setLastError(e instanceof Error ? e.message : String(e));
        setAssets([]);
      }
    }
  }, []);

  const loadForms = useCallback(async () => {
    const api = apiRef.current;
    const siteID = selectedSiteIDRef.current;
    if (!api || !siteID) {
      setForms([]);
      return;
    }
    try {
      const next = await api.listForms(siteID);
      if (selectedSiteIDRef.current === siteID) setForms(next);
    } catch (e) {
      if (selectedSiteIDRef.current === siteID) {
        setLastError(e instanceof Error ? e.message : String(e));
        setForms([]);
      }
    }
  }, []);

  const loadLocales = useCallback(async () => {
    const api = apiRef.current;
    const siteID = selectedSiteIDRef.current;
    if (!api || !siteID) {
      setLocales([]);
      return;
    }
    try {
      const next = await api.listSiteLocales(siteID);
      if (selectedSiteIDRef.current !== siteID) return;
      setLocales(next);
      setConnection((prev) => {
        if (prev.status !== 'connected') return prev;
        return {
          status: 'connected',
          sites: prev.sites.map((site) =>
            site.id === siteID ? { ...site, locales: next } : site,
          ),
        };
      });
    } catch (e) {
      if (selectedSiteIDRef.current === siteID) {
        setLastError(e instanceof Error ? e.message : String(e));
      }
    }
  }, []);

  const loadComments = useCallback(async () => {
    const api = apiRef.current;
    const siteID = selectedSiteIDRef.current;
    if (!api || !siteID) {
      setComments([]);
      return;
    }
    try {
      const next = await api.listCommentThreads(siteID);
      if (selectedSiteIDRef.current === siteID) setComments(next);
    } catch (e) {
      if (selectedSiteIDRef.current === siteID) {
        setLastError(e instanceof Error ? e.message : String(e));
        setComments([]);
      }
    }
  }, []);

  const loadCommentReplies = useCallback(async (threadID: string) => {
    const api = apiRef.current;
    const siteID = selectedSiteIDRef.current;
    if (!api || !siteID) {
      setCommentReplies([]);
      return;
    }
    try {
      const next = await api.listCommentReplies(siteID, threadID);
      if (selectedSiteIDRef.current === siteID) setCommentReplies(next);
    } catch (e) {
      if (selectedSiteIDRef.current === siteID) {
        setLastError(e instanceof Error ? e.message : String(e));
        setCommentReplies([]);
      }
    }
  }, []);

  const loadAnalyze = useCallback(async () => {
    const mcp = mcpRef.current;
    const siteID = selectedSiteIDRef.current;
    if (!mcp || !siteID) {
      setAnalyze(
        emptyAnalyzeSnapshot('empty', 'Select a site to load Analyze.'),
      );
      return;
    }
    const snapshot = await fetchAnalyzeSnapshot(mcp, mcpTools, siteID);
    if (selectedSiteIDRef.current === siteID) setAnalyze(snapshot);
  }, [mcpTools]);

  const loadFormSubmissions = useCallback(async (formID: string) => {
    const api = apiRef.current;
    if (!api) return;
    try {
      const next = await api.listFormSubmissions(formID);
      setFormSubmissions(next);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
      setFormSubmissions([]);
    }
  }, []);

  const refreshMCP = useCallback(async () => {
    const mcp = mcpRef.current;
    if (!mcp) return;
    const generation = ++mcpGenerationRef.current;
    const session = sessionGenerationRef.current;
    const siteID = selectedSiteIDRef.current;
    try {
      const [tools, status, liveCtx] = await Promise.all([
        mcp.listTools(),
        mcp.liveSessionStatus(siteID),
        fetchLiveDesignerContext(mcp, { selectedSiteID: siteID }),
      ]);
      if (
        session !== sessionGenerationRef.current ||
        generation !== mcpGenerationRef.current ||
        selectedSiteIDRef.current !== siteID
      ) {
        return;
      }
      setMcpTools(tools);
      setDesignerContext(liveCtx);
      setLiveSessionStatus(status);
    } catch {
      if (
        session !== sessionGenerationRef.current ||
        generation !== mcpGenerationRef.current
      ) {
        return;
      }
      setMcpTools([]);
      setLiveSessionStatus({ status: 'unavailable' });
      setDesignerContext(emptyDesignerContext());
    }
  }, []);

  const loadSiteContent = useCallback(async (siteID: SiteID) => {
    const api = apiRef.current;
    if (!api) throw new Error('Webflow API is not ready.');
    const generation = ++siteContentGenerationRef.current;
    const session = sessionGenerationRef.current;
    try {
      const [loadedPages, loadedCollections] = await Promise.all([
        api.listPages(siteID),
        api.listCollections(siteID),
      ]);
      if (
        session !== sessionGenerationRef.current ||
        generation !== siteContentGenerationRef.current ||
        selectedSiteIDRef.current !== siteID
      ) {
        throw new Error(
          'Site content request was superseded. Retry on the selected site.',
        );
      }
      setPages(loadedPages);
      setCollections(loadedCollections);
      setCmsItems([]);
      setCmsItemTotal(0);
      setCmsItemHasMore(false);
      // Annotate selected site SEO debt count in connection list
      setConnection((prev) => {
        if (prev.status !== 'connected') return prev;
        const seoIssues = loadedPages.filter(
          (p) => missingSEOTitle(p) || missingSEODescription(p),
        ).length;
        return {
          status: 'connected',
          sites: prev.sites.map((s) =>
            s.id === siteID ? { ...s, seoIssuesCount: seoIssues } : s,
          ),
        };
      });
      return loadedPages;
    } catch (e) {
      if (
        session !== sessionGenerationRef.current ||
        generation !== siteContentGenerationRef.current ||
        selectedSiteIDRef.current !== siteID
      ) {
        throw e;
      }
      setLastError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, []);

  const refreshSites = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const generation = ++sitesGenerationRef.current;
    ++siteContentGenerationRef.current;
    ++cmsGenerationRef.current;
    const session = sessionGenerationRef.current;
    const isCurrent = () =>
      session === sessionGenerationRef.current &&
      generation === sitesGenerationRef.current;
    setIsBusy(true);
    setLastError(null);
    try {
      // Live path only — never inject fixture sites
      const sites = await api.listSites();
      if (!isCurrent()) return;
      setConnection({ status: 'connected', sites });
      const stored = await tokenStoreRef.current.load(
        TokenStoreKeys.selectedSiteID,
      );
      if (!isCurrent()) return;
      const preferred =
        (stored as SiteID | null) &&
        sites.some((s) => s.id === stored)
          ? (stored as SiteID)
          : sites[0]?.id ?? null;
      selectedSiteIDRef.current = preferred;
      setSelectedSiteID(preferred);
      setPendingPlan(null);
      ++siteContentGenerationRef.current;
      ++cmsGenerationRef.current;
      ++instructionsGenerationRef.current;
      setPages([]);
      setCollections([]);
      setCmsItems([]);
      setCmsItemTotal(0);
      setCmsItemHasMore(false);
      setAssets([]);
      setForms([]);
      setFormSubmissions([]);
      setLocales([]);
      setComments([]);
      setCommentReplies([]);
      setAnalyze(
        emptyAnalyzeSnapshot('empty', 'Select a site to load Analyze.'),
      );
      if (preferred) {
        await tokenStoreRef.current.save(
          TokenStoreKeys.selectedSiteID,
          preferred,
        );
        if (!isCurrent()) return;
        await loadSiteContent(preferred);
        if (!isCurrent()) return;
        await loadLocales();
      } else {
        setPages([]);
        setCollections([]);
      }
    } catch (e) {
      if (!isCurrent()) return;
      const message = e instanceof Error ? e.message : String(e);
      setLastError(message);
      setConnection({ status: 'error', message });
    } finally {
      if (isCurrent()) setIsBusy(false);
    }
  }, [loadSiteContent, loadLocales]);

  const selectSite = useCallback(
    (siteID: SiteID | null) => {
      selectedSiteIDRef.current = siteID;
      ++sitesGenerationRef.current;
      ++siteContentGenerationRef.current;
      ++cmsGenerationRef.current;
      ++mcpGenerationRef.current;
      ++instructionsGenerationRef.current;
      setSelectedSiteID(siteID);
      setPendingPlan(null);
      setIsBusy(false);
      setPages([]);
      setCollections([]);
      setCmsItems([]);
      setCmsItemTotal(0);
      setCmsItemHasMore(false);
      setAssets([]);
      setForms([]);
      setFormSubmissions([]);
      setLocales([]);
      setComments([]);
      setCommentReplies([]);
      setAnalyze(
        emptyAnalyzeSnapshot('empty', 'Select a site to load Analyze.'),
      );
      if (siteID) {
        void tokenStoreRef.current.save(TokenStoreKeys.selectedSiteID, siteID);
        void loadSiteContent(siteID).catch(() => undefined);
        void loadAgentInstructionsForSite(siteID);
        void loadLocales();
      } else {
        void tokenStoreRef.current.delete(TokenStoreKeys.selectedSiteID);
        setAgentInstructions(null);
      }
    },
    [loadSiteContent, loadAgentInstructionsForSite, loadLocales],
  );

  const connect = useCallback(async () => {
    const auth = authRef.current;
    if (!auth) return;
    const session = ++sessionGenerationRef.current;
    setIsBusy(true);
    setLastError(null);
    setConnection({ status: 'connecting' });
    try {
      await auth.connect();
      if (session !== sessionGenerationRef.current) return;
      await refreshSites();
      if (session !== sessionGenerationRef.current) return;
      await refreshMCP();
    } catch (e) {
      if (session !== sessionGenerationRef.current) return;
      const message =
        e instanceof AuthError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      setLastError(message);
      setConnection({ status: 'disconnected' });
    } finally {
      if (session === sessionGenerationRef.current) setIsBusy(false);
    }
  }, [refreshSites, refreshMCP]);

  const disconnect = useCallback(async () => {
    const auth = authRef.current;
    if (!auth) return;
    const session = ++sessionGenerationRef.current;
    ++sitesGenerationRef.current;
    ++siteContentGenerationRef.current;
    ++cmsGenerationRef.current;
    ++mcpGenerationRef.current;
    ++instructionsGenerationRef.current;
    selectedSiteIDRef.current = null;
    setIsBusy(true);
    setSelectedSiteID(null);
    setPendingPlan(null);
    setIsRehydrating(false);
    let disconnectError: unknown = null;
    try {
      const results = await Promise.allSettled([
        auth.disconnect(),
        tokenStoreRef.current.delete(TokenStoreKeys.selectedSiteID),
      ]);
      const failures = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      if (failures.length > 0) {
        disconnectError = new AggregateError(
          failures.map((failure) => failure.reason),
          'Could not remove all stored credentials. The durable logout did not complete.',
        );
      }
    } finally {
      if (session === sessionGenerationRef.current) {
        if (disconnectError) {
          const message =
            disconnectError instanceof Error
              ? disconnectError.message
              : String(disconnectError);
          setConnection({ status: 'error', message });
          setLastError(message);
        } else {
          setConnection({ status: 'disconnected' });
          setLastError(null);
        }
        setPages([]);
        setCollections([]);
        setCmsItems([]);
        setCmsItemTotal(0);
        setCmsItemHasMore(false);
        setAssets([]);
        setForms([]);
        setFormSubmissions([]);
        setLocales([]);
        setComments([]);
        setCommentReplies([]);
        setAnalyze(
          emptyAnalyzeSnapshot('empty', 'Select a site to load Analyze.'),
        );
        setMcpTools([]);
        setLiveSessionStatus({ status: 'unavailable' });
        setDesignerContext(emptyDesignerContext());
        setAgentInstructions(null);
        setIsBusy(false);
      }
    }
    if (disconnectError) throw disconnectError;
  }, []);

  const eraseLocalData = useCallback(async () => {
    let disconnectError: unknown;
    try {
      await disconnect();
    } catch (error) {
      disconnectError = error;
    }
    await Promise.all([
      defaultActivityStore.clear(),
      defaultRateLimit.clearAll(),
      defaultAgentInstructions.clearAll(),
      tokenStoreRef.current.delete(TokenStoreKeys.selectedSiteID),
    ]);
    setRecentActivity([]);
    setAgentInstructions(null);
    if (disconnectError) throw disconnectError;
  }, [disconnect]);

  // Rehydrate session on launch — never invent demo sites
  useEffect(() => {
    let cancelled = false;
    const session = sessionGenerationRef.current;
    (async () => {
      setIsRehydrating(true);
      try {
        const activity = await defaultActivityStore.load();
        if (!cancelled && session === sessionGenerationRef.current) {
          setRecentActivity(activity);
        }
        try {
          const cap = await detectPlannerCapability();
          if (!cancelled && session === sessionGenerationRef.current) {
            setOnDeviceAvailable(cap === 'onDeviceAvailable');
          }
        } catch {
          if (!cancelled && session === sessionGenerationRef.current) {
            setOnDeviceAvailable(false);
          }
        }
        await defaultRateLimit.hydrate();
        await authRef.current?.hydrate();
        const connected = await authRef.current?.isConnected();
        if (cancelled || session !== sessionGenerationRef.current) return;
        if (connected) {
          await refreshSites();
          if (cancelled || session !== sessionGenerationRef.current) return;
          await refreshMCP();
        } else {
          setConnection({ status: 'disconnected' });
        }
      } catch (e) {
        if (!cancelled && session === sessionGenerationRef.current) {
          setLastError(e instanceof Error ? e.message : String(e));
          setConnection({ status: 'disconnected' });
        }
      } finally {
        if (!cancelled && session === sessionGenerationRef.current) {
          setIsRehydrating(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSites, refreshMCP]);

  // Load per-site agent instructions whenever selection is set after sites refresh
  useEffect(() => {
    if (!selectedSiteID) {
      setAgentInstructions(null);
      return;
    }
    void loadAgentInstructionsForSite(selectedSiteID);
  }, [selectedSiteID, loadAgentInstructionsForSite]);

  const selectedSite = useMemo(() => {
    if (connection.status !== 'connected' || !selectedSiteID) return null;
    return connection.sites.find((s) => s.id === selectedSiteID) ?? null;
  }, [connection, selectedSiteID]);

  selectedSiteNameRef.current = selectedSite?.name ?? 'Site';

  const seoIssuePages = useMemo(
    () =>
      pages.filter((p) => missingSEOTitle(p) || missingSEODescription(p)),
    [pages],
  );

  const executePlan = useCallback(
    async (
      plan: ActionPlan,
      opts?: { hardConfirmAcknowledged?: boolean },
    ): Promise<ExecutePlanResult> => {
      if (!connectionIsConnected(connection)) {
        throw new Error('Connect Webflow before executing a plan.');
      }
      const executionSiteID = assertPlanTargetsSite(plan, selectedSiteID);
      const executor = executorRef.current;
      if (!executor) throw new Error('Action executor is not ready.');
      if (executionInFlightRef.current) {
        throw new Error('Another Webflow action is still running.');
      }
      executionInFlightRef.current = true;
      const session = sessionGenerationRef.current;

      setIsExecuting(true);
      setLastError(null);
      try {
        const result = await executeApprovedPlan(plan, executor, {
          hardConfirmAcknowledged: opts?.hardConfirmAcknowledged,
        });
        let storageWarning: string | null = null;
        const attributedItems = attributeActivityToPlan(
          result.items,
          plan,
          executionSiteID,
        );
        result.items = attributedItems;
        for (const item of attributedItems) {
          try {
            await appendActivity(item);
          } catch {
            storageWarning =
              'Webflow finished the action, but Activity could not be saved to device storage.';
          }
        }
        result.storageWarning = storageWarning;
        if (session === sessionGenerationRef.current) {
          setPendingPlan(null);
          if (storageWarning) setLastError(storageWarning);
        }
        // Refresh pages after metadata/CMS writes so SEO chips update
        if (
          session === sessionGenerationRef.current &&
          executionSiteID &&
          result.completed > 0
        ) {
          void loadSiteContent(executionSiteID).catch(() => undefined);
        }
        if (Platform.OS === 'ios') {
          AccessibilityInfo.announceForAccessibility(
            `${result.completed} completed, ${result.failed} failed`,
          );
        }
        return result;
      } catch (e) {
        // HardConfirmRequiredError is rethrown for the UI gate
        if (
          session === sessionGenerationRef.current &&
          (e as { name?: string }).name !== 'HardConfirmRequiredError'
        ) {
          setLastError(e instanceof Error ? e.message : String(e));
        }
        throw e;
      } finally {
        executionInFlightRef.current = false;
        setIsExecuting(false);
      }
    },
    [appendActivity, connection, loadSiteContent, selectedSiteID],
  );

  const revertActivityItem = useCallback(
    async (item: ActivityItem): Promise<ExecutePlanResult> => {
      if (!selectedSiteID) {
        throw new Error('Select a site before reverting.');
      }
      if (item.siteID !== selectedSiteID) {
        throw new Error('Activity can only be reverted on its original site.');
      }
      if (!item.canRevert || !item.changes?.length || item.revertedAt) {
        throw new Error('This activity cannot be reverted.');
      }
      const descriptors = buildRevertDescriptors(item, selectedSiteID);
      if (descriptors.length === 0) {
        throw new Error('No reversible field changes on this activity.');
      }
      const plan = newActionPlan({
        prompt: `Revert: ${item.title}`,
        descriptors,
      });
      const result = await executePlan(plan, { hardConfirmAcknowledged: true });
      if (result.completed > 0) {
        setRecentActivity((current) =>
          current.map((entry) =>
            entry.id === item.id ? markActivityReverted(entry) : entry,
          ),
        );
        try {
          const next = await defaultActivityStore.update(
            item.id,
            markActivityReverted,
          );
          setRecentActivity(next);
        } catch {
          result.storageWarning =
            'Webflow finished the revert, but Activity could not be saved to device storage.';
          setLastError(result.storageWarning);
        }
      }
      return result;
    },
    [executePlan, selectedSiteID],
  );

  const value: AppContextValue = {
    connection,
    selectedSiteID,
    pages,
    collections,
    cmsItems,
    cmsItemTotal,
    cmsItemHasMore,
    assets,
    forms,
    formSubmissions,
    locales,
    comments,
    commentReplies,
    analyze,
    mcpTools,
    recentActivity,
    liveSessionStatus,
    designerContext,
    agentInstructions,
    activeTab,
    commandOpen,
    seoDraftOpen,
    publishOpen,
    settingsOpen,
    healthOpen,
    pendingPlan,
    lastError,
    isBusy,
    isRehydrating,
    isExecuting,
    onDeviceAvailable,
    planner: defaultPlanner,
    activityStore: defaultActivityStore,
    publishRateLimit: defaultRateLimit,
    agentInstructionsStore: defaultAgentInstructions,
    setActiveTab,
    setCommandOpen,
    setSeoDraftOpen,
    setPublishOpen,
    setSettingsOpen,
    setHealthOpen,
    setPendingPlan,
    loadCMSItems,
    loadAssets,
    loadForms,
    loadFormSubmissions,
    loadLocales,
    loadComments,
    loadCommentReplies,
    loadAnalyze,
    refreshMCP,
    selectSite,
    appendActivity,
    replaceActivity,
    clearActivity,
    saveAgentInstructions,
    revertActivityItem,
    selectedSite,
    seoIssuePages,
    connect,
    disconnect,
    eraseLocalData,
    refreshSites,
    loadSiteContent,
    executePlan,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
