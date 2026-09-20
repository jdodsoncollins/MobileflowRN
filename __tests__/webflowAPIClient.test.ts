import { describe, expect, it, vi } from 'vitest';
import { collectionID, itemID, pageID, siteID } from '../src/domain/models/ids';
import { WebflowAPIClientImpl } from '../src/services/api/webflowAPIClient';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('WebflowAPIClient contract', () => {
  it('paginates pages and models slug capability from API fields', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('offset=0')) {
        return json({
          pages: [
            { id: 'home', siteId: 'site', slug: '', publishedPath: '/' },
            { id: 'template', siteId: 'site', slug: 'posts', collectionId: 'c' },
          ],
          pagination: { limit: 2, offset: 0, total: 3 },
        });
      }
      return json({
        pages: [
          { id: 'about', siteId: 'site', slug: 'about', publishedPath: '/about' },
        ],
        pagination: { limit: 2, offset: 2, total: 3 },
      });
    });
    const client = new WebflowAPIClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const pages = await client.listPages(siteID('site'));

    expect(pages.map((page) => [page.pageType, page.slugEditable])).toEqual([
      ['home', false],
      ['collectionTemplate', false],
      ['staticPage', true],
    ]);
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain('offset=2');
  });

  it('loads custom domain IDs and includes pageId in single-page publish', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.includes('/custom_domains')) {
        return json({ customDomains: [{ id: 'domain-id', url: 'example.com' }] });
      }
      if (url.includes('/publish')) return json({}, 202);
      return json({
        sites: [
          {
            id: 'site',
            workspaceId: 'workspace',
            displayName: 'Site',
            shortName: 'site',
          },
        ],
      });
    });
    const client = new WebflowAPIClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const sites = await client.listSites();
    await client.publishPage({
      siteID: siteID('site'),
      pageID: pageID('page'),
      customDomainIDs: ['domain-id'],
      publishToWebflowSubdomain: false,
    });

    expect(sites[0]?.customDomains).toEqual([
      { id: 'domain-id', url: 'example.com' },
    ]);
    const publish = requests.find((request) => request.url.includes('/publish'));
    expect(JSON.parse(String(publish?.init?.body))).toEqual({
      customDomains: ['domain-id'],
      publishToWebflowSubdomain: false,
      pageId: 'page',
    });
  });

  it('does not broaden an empty publish target to cached domains', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/custom_domains')) {
        return json({ customDomains: [{ id: 'domain-id', url: 'example.com' }] });
      }
      return json({
        sites: [{ id: 'site', workspaceId: 'workspace', displayName: 'Site', shortName: 'site' }],
      });
    });
    const client = new WebflowAPIClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.listSites();

    await expect(
      client.publishPage({
        siteID: siteID('site'),
        pageID: pageID('page'),
        customDomainIDs: [],
        publishToWebflowSubdomain: false,
      }),
    ).rejects.toMatchObject({ kind: 'invalidResponse' });
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes('/publish'))).toBe(false);
  });

  it('isolates custom domain lookup failures by site', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/bad/custom_domains')) return json({}, 500);
      if (url.includes('/good/custom_domains')) {
        return json({ customDomains: [{ id: 'good-domain', url: 'good.example' }] });
      }
      return json({
        sites: [
          { id: 'bad', workspaceId: 'workspace', displayName: 'Bad', shortName: 'bad' },
          { id: 'good', workspaceId: 'workspace', displayName: 'Good', shortName: 'good' },
        ],
      });
    });
    const client = new WebflowAPIClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const sites = await client.listSites();

    expect(sites.map((site) => site.customDomains)).toEqual([
      [],
      [{ id: 'good-domain', url: 'good.example' }],
    ]);
  });

  it('uses PUT for page metadata', async () => {
    const fetchImpl = vi.fn(async () => json({}));
    const client = new WebflowAPIClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.updatePageMetadata({ pageID: pageID('page'), title: 'Title' });

    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[1]).toMatchObject({ method: 'PUT' });
  });

  it('rejects non-Webflow signed upload destinations before uploading bytes', async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        uploadUrl: 'https://attacker.example/upload',
        uploadDetails: { bucket: 'webflow-prod-assets' },
      }),
    );
    const client = new WebflowAPIClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      client.uploadAsset(siteID('site'), 'photo.png', new ArrayBuffer(1), 'image/png'),
    ).rejects.toMatchObject({ kind: 'uploadFailed' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a Webflow-named attacker bucket that differs from the signed URL bucket', async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        uploadUrl: 'https://attacker-bucket.s3.us-east-1.amazonaws.com/',
        uploadDetails: { bucket: 'webflow-prod-assets' },
      }),
    );
    const client = new WebflowAPIClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      client.uploadAsset(siteID('site'), 'photo.jpg', new ArrayBuffer(1), 'image/jpeg'),
    ).rejects.toMatchObject({ kind: 'uploadFailed' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects non-image MIME types before creating an asset', async () => {
    const fetchImpl = vi.fn();
    const client = new WebflowAPIClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      client.uploadAsset(siteID('site'), 'payload.html', new ArrayBuffer(1), 'text/html'),
    ).rejects.toMatchObject({ kind: 'uploadFailed' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('lists a CMS page with name contains filter and offset', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      expect(url).toContain('collections/col/items?');
      expect(url).toContain('limit=25');
      expect(url).toContain('offset=25');
      expect(url).toContain('filter%5Bname%5D%5Bcontains%5D=Launch');
      return json({
        items: [
          {
            id: 'item_1',
            fieldData: { name: 'Launch', slug: 'launch' },
            isDraft: true,
          },
        ],
        pagination: { limit: 25, offset: 25, total: 40 },
      });
    });
    const client = new WebflowAPIClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const page = await client.listCMSItemsPage(collectionID('col'), {
      offset: 25,
      query: 'Launch',
    });
    expect(page.total).toBe(40);
    expect(page.items[0]?.name).toBe('Launch');
  });

  it('publishes CMS items by id without a site publish path', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toContain('collections/col/items/publish');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ itemIds: ['item_1'] });
      return json({}, 202);
    });
    const client = new WebflowAPIClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.publishCMSItems({
      collectionID: collectionID('col'),
      itemIDs: [itemID('item_1')],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('lists forms and deletes a submission', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/forms') && !url.includes('submissions')) {
        return json({
          forms: [{ id: 'form_1', displayName: 'Contact', siteId: 'site' }],
          pagination: { limit: 100, offset: 0, total: 1 },
        });
      }
      if (url.includes('form_submissions/sub_1')) {
        expect(init?.method).toBe('DELETE');
        return new Response(null, { status: 204 });
      }
      return json({}, 404);
    });
    const client = new WebflowAPIClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const forms = await client.listForms(siteID('site'));
    expect(forms[0]?.displayName).toBe('Contact');
    await client.deleteFormSubmission({
      formID: 'form_1',
      submissionID: 'sub_1',
    });
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes('form_submissions/sub_1'))).toBe(
      true,
    );
  });

  it('maps site locales without extra list N+1', async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        locales: {
          primary: {
            id: 'en',
            tag: 'en',
            displayName: 'English',
            enabled: true,
          },
          secondary: [
            {
              id: 'fr',
              tag: 'fr-FR',
              displayName: 'French',
              enabled: true,
              subdirectory: 'fr',
            },
          ],
        },
      }),
    );
    const client = new WebflowAPIClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const locales = await client.listSiteLocales(siteID('site'));
    expect(locales.map((locale) => locale.tag)).toEqual(['en', 'fr-FR']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('lists comment threads and posts a reply', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/replies') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({ content: 'Noted' });
        return json({}, 201);
      }
      if (url.includes('/comments')) {
        return json({
          comments: [
            {
              id: 'c1',
              siteId: 'site',
              pageId: 'page',
              content: 'Fix this [[user]]',
              isResolved: false,
              author: { name: 'Ada', email: 'ada@example.com' },
              createdOn: '2026-01-01T00:00:00.000Z',
              lastUpdated: '2026-01-01T00:00:00.000Z',
            },
          ],
          pagination: { limit: 100, offset: 0, total: 1 },
        });
      }
      return json({}, 404);
    });
    const client = new WebflowAPIClientImpl({
      tokenProvider: async () => 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const threads = await client.listCommentThreads(siteID('site'));
    expect(threads[0]?.author.name).toBe('Ada');
    await client.replyToComment({
      siteID: siteID('site'),
      threadID: 'c1',
      content: 'Noted',
    });
  });
});
