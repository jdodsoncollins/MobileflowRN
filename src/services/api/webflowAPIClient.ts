import type {
  CreateCMSItemInput,
  DeleteFormSubmissionInput,
  PublishCMSItemsInput,
  PublishPageInput,
  PublishSiteInput,
  UpdateCMSItemInput,
  UpdatePageMetadataInput,
} from '../../domain/actions/mobileflowAction';
import {
  collectionID,
  itemID,
  pageID,
  siteID,
  workspaceID,
  type CollectionID,
  type ItemID,
  type SiteID,
} from '../../domain/models/ids';
import type { WebflowAsset } from '../../domain/models/contentModels';
import type {
  CMSItemPage,
  WebflowCMSItem,
  WebflowCollection,
  WebflowForm,
  WebflowFormSubmission,
  WebflowPage,
  WebflowSite,
} from '../../domain/models/webflowModels';
import { WebflowEndpoints } from '../auth/endpoints';
import { WebflowAPIError } from './errors';
import type { ListCMSItemsOptions, WebflowAPIClient } from './types';
import { CMS_PAGE_SIZE } from '../../domain/planning/cmsQuery';

type TokenProvider = () => Promise<string | null>;
type Pagination = { limit?: number; offset?: number; total?: number };
type CustomDomain = { url?: string | null; id?: string | null };

const PAGE_LIMIT = 100;

type RawCMSItem = {
  id: string;
  collectionId?: string | null;
  fieldData?: Record<string, unknown> | null;
  isDraft?: boolean | null;
  lastPublished?: string | null;
};
const ALLOWED_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export class WebflowAPIClientImpl implements WebflowAPIClient {
  private readonly baseURL: string;
  private readonly tokenProvider: TokenProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly customDomainIDs = new Map<string, string[]>();

  constructor(opts: {
    tokenProvider: TokenProvider;
    baseURL?: string;
    fetchImpl?: typeof fetch;
  }) {
    this.baseURL = opts.baseURL ?? WebflowEndpoints.dataAPIBase;
    this.tokenProvider = opts.tokenProvider;
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  async listSites(): Promise<WebflowSite[]> {
    const token = await this.requireToken();
    const sites = await this.requestAllPages<{
        id: string;
        workspaceId: string;
        displayName: string;
        shortName: string;
        lastPublished?: string | null;
        customDomains?: CustomDomain[];
      }>('sites', 'sites', token);

    const domains: CustomDomain[][] = [];
    for (const site of sites) {
      try {
        const data = await this.requestJSON<{ customDomains?: CustomDomain[] }>(
          `sites/${site.id}/custom_domains`,
          { token },
        );
        domains.push(data.customDomains ?? []);
      } catch {
        domains.push([]);
      }
    }

    return sites.map((w, index) => {
      const siteDomains = domains[index] ?? [];
      this.customDomainIDs.set(
        w.id,
        siteDomains.map((domain) => domain.id).filter(isNonEmptyString),
      );
      return {
      id: siteID(w.id),
      workspaceID: workspaceID(w.workspaceId),
      name: w.displayName,
      shortName: w.shortName,
      lastPublished: w.lastPublished ?? null,
      customDomains: siteDomains
        .filter(isCompleteCustomDomain)
        .map((domain) => ({ id: domain.id, url: domain.url })),
      draftChangesCount: 0,
      pendingCMSItems: 0,
      seoIssuesCount: 0,
      };
    });
  }

  async listPages(sid: SiteID): Promise<WebflowPage[]> {
    const token = await this.requireToken();
    let pages: Array<{
        id: string;
        siteId?: string | null;
        title?: string | null;
        slug?: string | null;
        seo?: { title?: string | null; description?: string | null } | null;
        openGraph?: { title?: string | null; description?: string | null } | null;
        localeId?: string | null;
        draft?: boolean | null;
        archived?: boolean | null;
        collectionId?: string | null;
        publishedPath?: string | null;
      }>;
    try {
      pages = await this.requestAllPages(
        `sites/${sid}/pages`,
        'pages',
        token,
      );
    } catch (e) {
      if (e instanceof WebflowAPIError && e.kind === 'decodeFailed') throw e;
      throw WebflowAPIError.decodeFailed(
        'pages',
        e instanceof Error ? e.message : String(e),
      );
    }

    return pages
      .filter((w) => w.archived !== true)
      .map((w) => {
        const title =
          w.title?.trim() && w.title.trim().length > 0
            ? w.title.trim()
            : 'Untitled page';
        const pageType = pageTypeFromAPI(w);
        return {
          id: pageID(w.id),
          siteID: siteID(w.siteId ?? sid),
          title,
          slug: w.slug ?? '',
          seoTitle: w.seo?.title ?? null,
          seoDescription: w.seo?.description ?? null,
          openGraphTitle: w.openGraph?.title ?? null,
          openGraphDescription: w.openGraph?.description ?? null,
          locale: w.localeId ?? null,
          pageType,
          slugEditable: pageType === 'staticPage' && typeof w.slug === 'string',
          hasDraftChanges: w.draft ?? false,
        } satisfies WebflowPage;
      });
  }

  async listCollections(sid: SiteID): Promise<WebflowCollection[]> {
    const token = await this.requireToken();
    const collections = await this.requestAllPages<{
        id: string;
        siteId?: string | null;
        displayName?: string | null;
        slug?: string | null;
      }>(`sites/${sid}/collections`, 'collections', token);

    return collections.map((w) => ({
      id: collectionID(w.id),
      siteID: siteID(w.siteId ?? sid),
      name: w.displayName ?? 'Collection',
      slug: w.slug ?? '',
      itemCount: 0,
    }));
  }

  async listCMSItems(cid: CollectionID): Promise<WebflowCMSItem[]> {
    const token = await this.requireToken();
    const items = await this.requestAllPages<RawCMSItem>(
      `collections/${cid}/items`,
      'items',
      token,
    );
    return items.map((raw) => mapCMSItem(raw, cid));
  }

  async listCMSItemsPage(
    cid: CollectionID,
    opts: ListCMSItemsOptions = {},
  ): Promise<CMSItemPage> {
    const token = await this.requireToken();
    const limit = Math.min(Math.max(opts.limit ?? CMS_PAGE_SIZE, 1), 100);
    const offset = Math.max(opts.offset ?? 0, 0);
    const live = opts.live === true;
    const query = opts.query?.trim() ?? '';
    const path = live
      ? `collections/${cid}/items/live`
      : `collections/${cid}/items`;
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (query) {
      params.set('filter[name][contains]', query);
    }
    const data = await this.requestJSON<{
      items?: RawCMSItem[];
      pagination?: Pagination;
    }>(`${path}?${params.toString()}`, { token });
    const items = Array.isArray(data.items) ? data.items : [];
    const total = finiteNonNegative(
      data.pagination?.total,
      offset + items.length,
    );
    return {
      items: items.map((raw) => mapCMSItem(raw, cid)),
      offset,
      limit,
      total,
    };
  }

  async publishSite(input: PublishSiteInput): Promise<void> {
    const token = await this.requireToken();
    const customDomains = this.validatePublishTargets(input);
    await this.request(`sites/${input.siteID}/publish`, {
      token,
      method: 'POST',
      body: {
        customDomains,
        publishToWebflowSubdomain: input.publishToWebflowSubdomain,
      },
    });
  }

  async publishPage(input: PublishPageInput): Promise<void> {
    const token = await this.requireToken();
    const customDomains = this.validatePublishTargets(input);
    await this.request(`sites/${input.siteID}/publish`, {
      token,
      method: 'POST',
      body: {
        customDomains,
        publishToWebflowSubdomain: input.publishToWebflowSubdomain,
        pageId: input.pageID,
      },
    });
  }

  async updatePageMetadata(input: UpdatePageMetadataInput): Promise<void> {
    const token = await this.requireToken();
    const body: Record<string, unknown> = {};
    if (input.title != null) body.title = input.title;
    if (input.slug != null) body.slug = input.slug;

    const seo: Record<string, string> = {};
    if (input.seoTitle != null) seo.title = input.seoTitle;
    if (input.seoDescription != null) seo.description = input.seoDescription;
    if (Object.keys(seo).length > 0) body.seo = seo;

    const og: Record<string, string> = {};
    if (input.openGraphTitle != null) og.title = input.openGraphTitle;
    if (input.openGraphDescription != null) {
      og.description = input.openGraphDescription;
    }
    if (Object.keys(og).length > 0) body.openGraph = og;

    if (Object.keys(body).length === 0) return;

    await this.request(`pages/${input.pageID}`, {
      token,
      method: 'PUT',
      body,
    });
  }

  async updateCMSItem(input: UpdateCMSItemInput): Promise<void> {
    const token = await this.requireToken();
    await this.request(
      `collections/${input.collectionID}/items/${input.itemID}`,
      {
        token,
        method: 'PATCH',
        body: { fieldData: input.fields },
      },
    );
  }

  async publishCMSItems(input: PublishCMSItemsInput): Promise<void> {
    const token = await this.requireToken();
    if (input.itemIDs.length === 0) return;
    await this.request(`collections/${input.collectionID}/items/publish`, {
      token,
      method: 'POST',
      body: { itemIds: input.itemIDs },
    });
  }

  async createCMSItem(input: CreateCMSItemInput): Promise<ItemID> {
    const token = await this.requireToken();
    const data = await this.requestJSON<{ id: string }>(
      `collections/${input.collectionID}/items`,
      {
        token,
        method: 'POST',
        body: {
          isArchived: false,
          isDraft: true,
          fieldData: input.fields,
        },
      },
    );
    return itemID(data.id);
  }

  async uploadAsset(
    sid: SiteID,
    fileName: string,
    data: ArrayBuffer,
    contentType: string,
  ): Promise<WebflowAsset> {
    const token = await this.requireToken();
    const safeFileName = sanitizeFileName(fileName);
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      throw WebflowAPIError.uploadFailed('Unsupported image content type');
    }
    const { md5Hex } = await import('../../support/md5');
    const fileHash = md5Hex(data);

    // 1) Create asset metadata
    const created = await this.requestJSON<{
      id?: string;
      uploadUrl?: string;
      uploadDetails?: Record<string, string>;
      assetUrl?: string;
      hostedUrl?: string;
    }>(`sites/${sid}/assets`, {
      token,
      method: 'POST',
      body: { fileName: safeFileName, fileHash },
    });

    if (!created.uploadUrl || !created.uploadDetails) {
      throw WebflowAPIError.uploadFailed(
        'Missing uploadUrl/uploadDetails from Webflow',
      );
    }
    validateSignedUpload(created.uploadUrl, created.uploadDetails);

    // 2) Multipart POST to S3-style endpoint
    const boundary = `Boundary-${cryptoRandomBoundary()}`;
    const parts: Uint8Array[] = [];
    const enc = new TextEncoder();
    const push = (s: string) => parts.push(enc.encode(s));

    const keys = Object.keys(created.uploadDetails).sort();
    for (const key of keys) {
      const value = created.uploadDetails[key]!;
      if (!isSafeMultipartName(key) || hasHeaderControlCharacters(value)) {
        throw WebflowAPIError.uploadFailed('Invalid signed upload fields');
      }
      push(`--${boundary}\r\n`);
      push(`Content-Disposition: form-data; name="${key}"\r\n\r\n`);
      push(`${value}\r\n`);
    }
    push(`--${boundary}\r\n`);
    push(
      `Content-Disposition: form-data; name="file"; filename="${safeFileName}"\r\n`,
    );
    push(`Content-Type: ${contentType}\r\n\r\n`);
    parts.push(new Uint8Array(data));
    push(`\r\n--${boundary}--\r\n`);

    let total = 0;
    for (const p of parts) total += p.length;
    const body = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      body.set(p, offset);
      offset += p.length;
    }

    const uploadRes = await this.fetchImpl(created.uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: body.buffer,
    });
    if (!uploadRes.ok) {
      throw WebflowAPIError.uploadFailed(
        `Storage upload HTTP ${uploadRes.status}`,
      );
    }

    return {
      id: created.id ?? fileHash.slice(0, 12),
      fileName: safeFileName,
      contentType,
      url: created.hostedUrl ?? created.assetUrl ?? '',
      uploadedAt: new Date().toISOString(),
      sizeBytes: data.byteLength,
      altText: null,
    };
  }

  async listAssets(sid: SiteID): Promise<WebflowAsset[]> {
    const token = await this.requireToken();
    const assets = await this.requestAllPages<{
      id?: string;
      originalFileName?: string | null;
      displayName?: string | null;
      contentType?: string | null;
      hostedUrl?: string | null;
      url?: string | null;
      createdOn?: string | null;
      size?: number | null;
      altText?: string | null;
    }>(`sites/${sid}/assets`, 'assets', token);
    return assets
      .filter((asset) => isNonEmptyString(asset.id))
      .map((asset) => ({
        id: asset.id!,
        fileName: asset.originalFileName || asset.displayName || asset.id!,
        contentType: asset.contentType || 'application/octet-stream',
        url: asset.hostedUrl || asset.url || '',
        uploadedAt: asset.createdOn || new Date(0).toISOString(),
        sizeBytes: typeof asset.size === 'number' ? asset.size : null,
        altText: asset.altText ?? null,
      }));
  }

  async listForms(sid: SiteID): Promise<WebflowForm[]> {
    const token = await this.requireToken();
    const forms = await this.requestAllPages<{
      id?: string;
      displayName?: string | null;
      siteId?: string | null;
    }>(`sites/${sid}/forms`, 'forms', token);
    return forms
      .filter((form) => isNonEmptyString(form.id))
      .map((form) => ({
        id: form.id!,
        siteID: siteID(form.siteId ?? sid),
        displayName: form.displayName?.trim() || 'Untitled form',
      }));
  }

  async listFormSubmissions(
    formID: string,
  ): Promise<WebflowFormSubmission[]> {
    const token = await this.requireToken();
    const rows = await this.requestAllPages<{
      id?: string;
      formId?: string | null;
      dateSubmitted?: string | null;
      submittedOn?: string | null;
      data?: Record<string, unknown> | null;
      formResponse?: Record<string, unknown> | null;
    }>(`forms/${formID}/submissions`, 'formSubmissions', token);
    return rows
      .filter((row) => isNonEmptyString(row.id))
      .map((row) => ({
        id: row.id!,
        formID: row.formId || formID,
        submittedAt:
          row.dateSubmitted ||
          row.submittedOn ||
          new Date(0).toISOString(),
        data: flattenFormData(row.data ?? row.formResponse ?? {}),
      }));
  }

  async deleteFormSubmission(
    input: DeleteFormSubmissionInput,
  ): Promise<void> {
    const token = await this.requireToken();
    await this.request(`form_submissions/${input.submissionID}`, {
      token,
      method: 'DELETE',
    });
  }

  async siteAgentInstructions(_siteID: SiteID): Promise<string | null> {
    return null;
  }

  private async requireToken(): Promise<string> {
    const token = await this.tokenProvider();
    if (!token) throw WebflowAPIError.unauthorized();
    return token;
  }

  private validatePublishTargets(input: PublishSiteInput): string[] {
    if (!input.publishToWebflowSubdomain && input.customDomainIDs.length === 0) {
      throw WebflowAPIError.invalidResponse('Select at least one publish target');
    }
    const known = new Set(this.customDomainIDs.get(String(input.siteID)) ?? []);
    if (input.customDomainIDs.some((id) => !known.has(id))) {
      throw WebflowAPIError.invalidResponse('Invalid custom domain publish target');
    }
    return input.customDomainIDs;
  }

  private async request(
    path: string,
    opts: {
      token: string;
      method?: string;
      body?: unknown;
    },
  ): Promise<Response> {
    const url = path.startsWith('http')
      ? path
      : `${this.baseURL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${opts.token}`,
      Accept: 'application/json',
    };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    const res = await this.fetchImpl(url, {
      method: opts.method ?? 'GET',
      headers,
      body,
    });
    this.validateResponse(res);
    return res;
  }

  private async requestJSON<T>(
    path: string,
    opts: {
      token: string;
      method?: string;
      body?: unknown;
    },
  ): Promise<T> {
    const res = await this.request(path, opts);
    try {
      return (await res.json()) as T;
    } catch (e) {
      throw WebflowAPIError.decodeFailed(
        path.split('?')[0] ?? path,
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  private async requestAllPages<T>(
    path: string,
    key: string,
    token: string,
  ): Promise<T[]> {
    const results: T[] = [];
    let offset = 0;
    for (;;) {
      const separator = path.includes('?') ? '&' : '?';
      const data = await this.requestJSON<
        Record<string, unknown> & { pagination?: Pagination }
      >(`${path}${separator}limit=${PAGE_LIMIT}&offset=${offset}`, { token });
      const page = data[key];
      if (!Array.isArray(page)) {
        throw WebflowAPIError.decodeFailed(key, `missing ${key} array`);
      }
      results.push(...(page as T[]));

      const pagination = data.pagination;
      if (!pagination) break;
      const currentOffset = finiteNonNegative(pagination.offset, offset);
      const limit = finitePositive(pagination.limit, page.length);
      const total = finiteNonNegative(pagination.total, results.length);
      const nextOffset = currentOffset + limit;
      if (results.length >= total || page.length === 0) break;
      if (nextOffset <= offset) {
        throw WebflowAPIError.decodeFailed(key, 'pagination did not advance');
      }
      offset = nextOffset;
    }
    return results;
  }

  private validateResponse(res: Response): void {
    if (res.ok) return;
    switch (res.status) {
      case 401:
      case 403:
        throw WebflowAPIError.unauthorized();
      case 404:
        throw WebflowAPIError.notFound();
      case 429: {
        const retry = res.headers.get('Retry-After');
        const seconds = retry != null ? Number(retry) : null;
        throw WebflowAPIError.rateLimited(
          Number.isFinite(seconds) ? seconds : null,
        );
      }
      default:
        throw WebflowAPIError.invalidResponse(`HTTP ${res.status}`);
    }
  }
}

function isCompleteCustomDomain(
  domain: CustomDomain,
): domain is { id: string; url: string } {
  return isNonEmptyString(domain.id) && isNonEmptyString(domain.url);
}

function mapCMSItem(raw: RawCMSItem, cid: CollectionID): WebflowCMSItem {
  const fieldData = raw.fieldData ?? {};
  const name =
    stringField(fieldData, 'name') ??
    stringField(fieldData, 'title') ??
    `Item ${raw.id.slice(0, 6)}`;
  const slug = stringField(fieldData, 'slug') ?? '';
  return {
    id: itemID(raw.id),
    collectionID: collectionID(raw.collectionId ?? cid),
    name,
    slug,
    isDraft: raw.isDraft ?? raw.lastPublished == null,
    isPublished: raw.lastPublished != null,
    missingFields: [],
  };
}

function flattenFormData(
  data: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') out[key] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = String(value);
    }
  }
  return out;
}

function stringField(
  data: Record<string, unknown>,
  key: string,
): string | null {
  const v = data[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function cryptoRandomBoundary(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw WebflowAPIError.uploadFailed('Secure randomness is unavailable');
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function pageTypeFromAPI(page: {
  collectionId?: string | null;
  slug?: string | null;
  publishedPath?: string | null;
}): WebflowPage['pageType'] {
  if (page.collectionId != null) return 'collectionTemplate';
  if (page.slug === '' || page.publishedPath === '/') return 'home';
  if (
    page.publishedPath === '/404' ||
    page.publishedPath === '/401' ||
    page.publishedPath === '/search'
  ) {
    return 'utility';
  }
  return 'staticPage';
}

function sanitizeFileName(fileName: string): string {
  const name = fileName.split(/[\\/]/).pop()?.trim() ?? '';
  const sanitized = name.replace(/[\u0000-\u001f\u007f"']/g, '_').slice(0, 99);
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw WebflowAPIError.uploadFailed('Invalid file name');
  }
  return sanitized;
}

function validateSignedUpload(
  uploadURL: string,
  details: Record<string, string>,
): void {
  let url: URL;
  try {
    url = new URL(uploadURL);
  } catch {
    throw WebflowAPIError.uploadFailed('Invalid signed upload URL');
  }
  const host = url.hostname.toLowerCase();
  const isS3Host =
    host === 's3.amazonaws.com' ||
    host.endsWith('.s3.amazonaws.com') ||
    (/^s3[.-][a-z0-9-]+\.amazonaws\.com$/.test(host)) ||
    (/\.s3[.-][a-z0-9-]+\.amazonaws\.com$/.test(host));
  const bucket = details.bucket;
  const virtualHostMatch = host.match(/^(.+)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/);
  const urlBucket =
    virtualHostMatch?.[1] ??
    (host === 's3.amazonaws.com' || /^s3[.-][a-z0-9-]+\.amazonaws\.com$/.test(host)
      ? url.pathname.split('/').filter(Boolean)[0]
      : undefined);
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    !isS3Host ||
    typeof bucket !== 'string' ||
    !/^webflow[a-z0-9.-]*$/i.test(bucket) ||
    urlBucket !== bucket
  ) {
    throw WebflowAPIError.uploadFailed('Untrusted signed upload destination');
  }
}

function isSafeMultipartName(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function hasHeaderControlCharacters(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function finiteNonNegative(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! >= 0 ? value! : fallback;
}

function finitePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! > 0 ? value! : fallback;
}
