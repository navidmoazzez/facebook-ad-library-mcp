/**
 * The one Ad shape every backend returns.
 *
 * Three sources feed this: Meta's own GraphQL payload, ScrapeCreators and Apify.
 * They disagree about field names and nesting. Everything downstream, including
 * every tool, sees only the types here.
 */

/** One image or video inside an ad. A carousel has several. */
export type Creative = {
  kind: "image" | "video";
  imageUrl?: string;
  videoHdUrl?: string;
  videoSdUrl?: string;
  previewImageUrl?: string;
  title?: string;
  body?: string;
  caption?: string;
  ctaText?: string;
  linkUrl?: string;
};

export type Ad = {
  libraryId: string;
  adDetailsUrl: string;

  // advertiser
  pageId?: string;
  pageName?: string;
  pageUrl?: string;
  pageLikes?: number;
  pageCategories: string[];
  pageProfilePictureUrl?: string;

  // run
  isActive?: boolean;
  startedRunning?: string;
  stoppedRunning?: string;
  daysActive?: number;
  platforms: string[];
  countries: string[];
  categories: string[];

  // creative
  displayFormat?: string;
  title?: string;
  body?: string;
  caption?: string;
  linkDescription?: string;
  ctaText?: string;
  ctaType?: string;
  linkUrl?: string;
  linkDomain?: string;
  creatives: Creative[];

  /** Meta's "N ads use this creative". How many variants share this asset. */
  variantsUsingCreative?: number;

  // Transparency. Present only for EU-delivered and political ads.
  spend?: unknown;
  currency?: string;
  reachEstimate?: unknown;
  impressions?: unknown;

  source: BackendName;
};

export type BackendName = "browser" | "scrapecreators" | "apify";

export type Advertiser = {
  pageId: string;
  pageName?: string;
  pageUrl?: string;
  pageLikes?: number;
  verified?: boolean;
  category?: string;
  profilePictureUrl?: string;
  adCount?: number;
};

export type SearchResult = {
  backend: BackendName;
  count: number;
  hasMore: boolean;
  cursor?: string;
  /** Meta's own count of matching ads for this search, when it tells us. */
  totalAvailable?: number;
  url?: string;
  note?: string;
  ads: Ad[];
};

export const ACTIVE_STATUS = ["active", "inactive", "all"] as const;
export const MEDIA_TYPE = ["all", "image", "meme", "video", "none"] as const;
export const AD_TYPE = [
  "all",
  "political_and_issue_ads",
  "employment_ads",
  "housing_ads",
  "financial_products_and_services_ads",
] as const;

export type ActiveStatus = (typeof ACTIVE_STATUS)[number];
export type MediaType = (typeof MEDIA_TYPE)[number];
export type AdType = (typeof AD_TYPE)[number];

export type SearchParams = {
  query?: string;
  pageId?: string;
  country?: string;
  activeStatus?: ActiveStatus;
  adType?: AdType;
  mediaType?: MediaType;
  limit?: number;
  cursor?: string;
};

export interface Backend {
  readonly name: BackendName;
  readonly needsKey: boolean;
  search(params: SearchParams): Promise<SearchResult>;
  listAdvertisers(query: string, country?: string): Promise<Advertiser[]>;
  getAd(libraryId: string, country?: string): Promise<Ad | undefined>;
  transcribe?(libraryId: string): Promise<string | undefined>;
  close(): Promise<void>;
}
