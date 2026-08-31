/**
 * The public Ad Library URL for a set of filters.
 *
 * Shared, because the browser backend navigates to it and Apify takes the same
 * URL as its actor input. One builder means the two cannot drift.
 */

import type { SearchParams } from "./types.js";

export const AD_LIBRARY = "https://www.facebook.com/ads/library/";

export function buildUrl(params: SearchParams): string {
  const search = new URLSearchParams({
    active_status: params.activeStatus ?? "active",
    ad_type: params.adType ?? "all",
    country: params.country ?? "US",
    media_type: params.mediaType ?? "all",
  });

  if (params.pageId) {
    search.set("view_all_page_id", params.pageId);
    search.set("search_type", "page");
  } else {
    search.set("search_type", "keyword_unordered");
  }
  if (params.query) search.set("q", params.query);

  return `${AD_LIBRARY}?${search.toString()}`;
}

export function adDetailsUrl(libraryId: string): string {
  return `${AD_LIBRARY}?id=${encodeURIComponent(libraryId)}`;
}
