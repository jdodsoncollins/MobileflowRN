import type { WebflowCMSItem } from '../models/webflowModels';

export type CMSItemStatusFilter = 'all' | 'draft' | 'published';

export const CMS_PAGE_SIZE = 25;

export function normalizeCMSQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function cmsItemMatchesQuery(
  item: WebflowCMSItem,
  query: string,
): boolean {
  const q = normalizeCMSQuery(query);
  if (!q) return true;
  return (
    item.name.toLowerCase().includes(q) || item.slug.toLowerCase().includes(q)
  );
}

export function cmsItemMatchesStatus(
  item: WebflowCMSItem,
  status: CMSItemStatusFilter,
): boolean {
  if (status === 'all') return true;
  if (status === 'draft') return item.isDraft && !item.isPublished;
  return item.isPublished;
}

export function filterCMSItems(
  items: WebflowCMSItem[],
  opts: { query?: string; status?: CMSItemStatusFilter },
): WebflowCMSItem[] {
  const status = opts.status ?? 'all';
  const query = opts.query ?? '';
  return items.filter(
    (item) =>
      cmsItemMatchesStatus(item, status) && cmsItemMatchesQuery(item, query),
  );
}
