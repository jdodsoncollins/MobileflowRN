import type { PageID } from './ids';

export type MetadataField =
  | 'seoTitle'
  | 'seoDescription'
  | 'openGraphTitle'
  | 'openGraphDescription'
  | 'slug';

export const metadataFieldDisplayName: Record<MetadataField, string> = {
  seoTitle: 'SEO Title',
  seoDescription: 'Meta Description',
  openGraphTitle: 'Open Graph Title',
  openGraphDescription: 'Open Graph Description',
  slug: 'Slug',
};

export function metadataFieldIsHighRisk(field: MetadataField): boolean {
  return field === 'slug';
}

export interface PageMetadataDiff {
  pageID: PageID;
  pageTitle: string;
  field: MetadataField;
  currentValue: string;
  proposedValue: string;
  isAccepted: boolean;
}

export function pageMetadataDiffId(d: PageMetadataDiff): string {
  return `${d.pageID}-${d.field}`;
}

export interface WebflowCollectionField {
  id: string;
  name: string;
  slug: string;
  type: string;
  isRequired: boolean;
}

export interface WebflowAsset {
  id: string;
  fileName: string;
  contentType: string;
  url: string;
  uploadedAt: string;
  sizeBytes: number | null;
  altText: string | null;
}

/** Images at or above this size are flagged for compression review. */
export const LARGE_ASSET_BYTES = 500 * 1024;
