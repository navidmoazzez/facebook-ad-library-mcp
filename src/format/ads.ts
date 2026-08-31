/**
 * Shaping ads for a model rather than for a parser.
 *
 * A raw ad card is mostly nulls and CDN URLs. Dumping thirty of them spends
 * thousands of tokens on fields nobody reads, and buries the three that decide
 * whether an ad is worth studying: how long it has run, what it says, and where
 * it sends people.
 *
 * So the list view is compact and the detail view is complete. `get_ad` returns
 * everything; `search_ads` returns enough to choose which ad to look at.
 */

import type { Ad } from "../adlibrary/types.js";

/** Drop keys that are undefined or empty, so the JSON a model reads has no noise. */
function compact<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}

function truncate(text: string | undefined, max: number): string | undefined {
  if (!text) return undefined;
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** One ad in a result list. Enough to judge it, not everything about it. */
export function summarise(ad: Ad): Record<string, unknown> {
  const videos = ad.creatives.filter((c) => c.kind === "video").length;
  return compact({
    library_id: ad.libraryId,
    advertiser: ad.pageName,
    page_id: ad.pageId,
    active: ad.isActive,
    started: ad.startedRunning,
    stopped: ad.stoppedRunning,
    days_active: ad.daysActive,
    platforms: ad.platforms,
    format: ad.displayFormat,
    cta: ad.ctaText,
    landing_domain: ad.linkDomain,
    body: truncate(ad.body, 600),
    creatives: ad.creatives.length,
    videos: videos > 0 ? videos : undefined,
    variants_using_creative: ad.variantsUsingCreative,
    spend: ad.spend,
    reach: ad.reachEstimate,
    details: ad.adDetailsUrl,
  });
}

/** One ad in full, for `get_ad`. Every creative, every copy variant. */
export function detail(ad: Ad): Record<string, unknown> {
  return compact({
    library_id: ad.libraryId,
    details_url: ad.adDetailsUrl,
    advertiser: compact({
      name: ad.pageName,
      page_id: ad.pageId,
      url: ad.pageUrl,
      likes: ad.pageLikes,
      categories: ad.pageCategories,
      profile_picture: ad.pageProfilePictureUrl,
    }),
    run: compact({
      active: ad.isActive,
      started: ad.startedRunning,
      stopped: ad.stoppedRunning,
      days_active: ad.daysActive,
      platforms: ad.platforms,
      countries: ad.countries,
      categories: ad.categories,
    }),
    copy: compact({
      title: ad.title,
      body: ad.body,
      caption: ad.caption,
      link_description: ad.linkDescription,
      cta: ad.ctaText,
      cta_type: ad.ctaType,
      link_url: ad.linkUrl,
      link_domain: ad.linkDomain,
    }),
    format: ad.displayFormat,
    variants_using_creative: ad.variantsUsingCreative,
    creatives: ad.creatives.map((creative) => compact({ ...creative })),
    transparency: compact({
      spend: ad.spend,
      currency: ad.currency,
      reach: ad.reachEstimate,
      impressions: ad.impressions,
    }),
    source: ad.source,
  });
}
