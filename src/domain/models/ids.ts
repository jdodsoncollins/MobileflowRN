/** Branded ID types mirroring iOS Domain/Models/IDs.swift */

export type WorkspaceID = string & { readonly __brand: 'WorkspaceID' };
export type SiteID = string & { readonly __brand: 'SiteID' };
export type PageID = string & { readonly __brand: 'PageID' };
export type CollectionID = string & { readonly __brand: 'CollectionID' };
export type ItemID = string & { readonly __brand: 'ItemID' };

export function workspaceID(raw: string): WorkspaceID {
  return raw as WorkspaceID;
}
export function siteID(raw: string): SiteID {
  return raw as SiteID;
}
export function pageID(raw: string): PageID {
  return raw as PageID;
}
export function collectionID(raw: string): CollectionID {
  return raw as CollectionID;
}
export function itemID(raw: string): ItemID {
  return raw as ItemID;
}
