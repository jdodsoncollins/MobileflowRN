import type {
  CreateCMSItemInput,
  DeleteFormSubmissionInput,
  PublishCMSItemsInput,
  PublishPageInput,
  PublishSiteInput,
  ReplyToCommentInput,
  UpdateCMSItemInput,
  UpdatePageMetadataInput,
} from '../../domain/actions/mobileflowAction';
import type {
  CollectionID,
  ItemID,
  SiteID,
} from '../../domain/models/ids';
import type { WebflowAsset } from '../../domain/models/contentModels';
import type {
  CMSItemPage,
  WebflowCMSItem,
  WebflowCollection,
  WebflowCommentReply,
  WebflowCommentThread,
  WebflowForm,
  WebflowFormSubmission,
  WebflowLocale,
  WebflowPage,
  WebflowSite,
} from '../../domain/models/webflowModels';

export interface ListCMSItemsOptions {
  limit?: number;
  offset?: number;
  query?: string;
  live?: boolean;
}

export interface WebflowAPIClient {
  listSites(): Promise<WebflowSite[]>;
  listPages(siteID: SiteID): Promise<WebflowPage[]>;
  listCollections(siteID: SiteID): Promise<WebflowCollection[]>;
  listCMSItems(collectionID: CollectionID): Promise<WebflowCMSItem[]>;
  listCMSItemsPage(
    collectionID: CollectionID,
    opts?: ListCMSItemsOptions,
  ): Promise<CMSItemPage>;
  publishSite(input: PublishSiteInput): Promise<void>;
  publishPage(input: PublishPageInput): Promise<void>;
  publishCMSItems(input: PublishCMSItemsInput): Promise<void>;
  updatePageMetadata(input: UpdatePageMetadataInput): Promise<void>;
  updateCMSItem(input: UpdateCMSItemInput): Promise<void>;
  createCMSItem(input: CreateCMSItemInput): Promise<ItemID>;
  uploadAsset(
    siteID: SiteID,
    fileName: string,
    data: ArrayBuffer,
    contentType: string,
  ): Promise<WebflowAsset>;
  listAssets(siteID: SiteID): Promise<WebflowAsset[]>;
  listForms(siteID: SiteID): Promise<WebflowForm[]>;
  listFormSubmissions(formID: string): Promise<WebflowFormSubmission[]>;
  deleteFormSubmission(input: DeleteFormSubmissionInput): Promise<void>;
  listSiteLocales(siteID: SiteID): Promise<WebflowLocale[]>;
  listCommentThreads(siteID: SiteID): Promise<WebflowCommentThread[]>;
  listCommentReplies(
    siteID: SiteID,
    threadID: string,
  ): Promise<WebflowCommentReply[]>;
  replyToComment(input: ReplyToCommentInput): Promise<void>;
  siteAgentInstructions(siteID: SiteID): Promise<string | null>;
}
