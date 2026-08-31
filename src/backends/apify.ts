/**
 * Apify backend. Needs a token, works serverless, about $3.40 to $5.80 per 1,000 ads.
 *
 * Two to three times the price of ScrapeCreators, and an actor run to wait on
 * rather than a plain request, so it is not the default provider. It is here
 * because plenty of people already have an Apify account and a token, and
 * because its e-commerce enrichment has no equivalent elsewhere.
 *
 * The actor takes an Ad Library URL as `startUrls`, which is the same URL the
 * browser backend navigates to, so both share `adlibrary/url.ts`.
 *
 * Actor input schema read from the live API on 2026-08-31.
 */

import { AdLibraryError } from "../errors.js";
import { adFromApify } from "../adlibrary/normalize.js";
import { adDetailsUrl, buildUrl } from "../adlibrary/url.js";
import type { Ad, Advertiser, Backend, SearchParams, SearchResult } from "../adlibrary/types.js";

const ACTOR = "apify~facebook-ads-scraper";
const BASE = "https://api.apify.com/v2";

export class ApifyBackend implements Backend {
  readonly name = "apify" as const;
  readonly needsKey = true;

  constructor(
    private readonly token: string,
    private readonly options: { timeoutMs?: number; ecommerce?: boolean } = {},
  ) {
    if (!token) {
      throw new AdLibraryError("The apify backend needs a token.", {
        backend: this.name,
        hint: "Set APIFY_TOKEN, or use the free browser backend with FBADS_BACKEND=browser.",
      });
    }
  }

  async close(): Promise<void> {
    // Nothing to release: this backend is stateless fetch calls.
  }

  /**
   * One synchronous actor run, returning its dataset items.
   *
   * `run-sync-get-dataset-items` blocks until the run finishes, which is why the
   * default timeout is generous. Apify caps a sync run at five minutes, so a very
   * large limit times out rather than returning partial data.
   */
  private async run(url: string, limit: number, details = true): Promise<unknown[]> {
    const endpoint = new URL(`/v2/acts/${ACTOR}/run-sync-get-dataset-items`, BASE);
    endpoint.searchParams.set("token", this.token);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url }],
        resultsLimit: limit,
        isDetailsPerAd: details,
        enrichWithEcommerceData: this.options.ecommerce ?? false,
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 300_000),
    });

    if (response.status === 401) {
      throw new AdLibraryError("Apify rejected the token (401).", {
        backend: this.name,
        hint: "Check APIFY_TOKEN.",
      });
    }
    if (response.status === 402) {
      throw new AdLibraryError("Apify reports insufficient credit (402).", {
        backend: this.name,
        hint: "Top up the account, or switch to the free browser backend with FBADS_BACKEND=browser.",
      });
    }
    if (response.status === 408) {
      throw new AdLibraryError("The Apify run exceeded the five-minute synchronous limit.", {
        backend: this.name,
        hint: "Lower `limit` and make several calls instead of one large one.",
      });
    }
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new AdLibraryError(`Apify error ${response.status}: ${body}`, { backend: this.name });
    }

    const items = await response.json();
    return Array.isArray(items) ? items : [];
  }

  async search(params: SearchParams): Promise<SearchResult> {
    if (!params.query && !params.pageId) {
      throw new AdLibraryError("Pass either query or page_id.", { backend: this.name });
    }
    const limit = params.limit ?? 30;
    const url = buildUrl(params);
    const items = await this.run(url, limit);

    const ads: Ad[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (typeof item !== "object" || item === null) continue;
      const ad = adFromApify(item as Record<string, unknown>);
      if (!ad.libraryId || seen.has(ad.libraryId)) continue;
      seen.add(ad.libraryId);
      ads.push(ad);
    }

    const kept = ads.slice(0, limit);
    return {
      backend: this.name,
      count: kept.length,
      hasMore: false,
      // The actor paginates internally against resultsLimit and exposes no
      // cursor, so raise `limit` rather than paging. Said plainly here so
      // nobody goes hunting for one.
      cursor: undefined,
      url,
      note:
        kept.length > 0
          ? "This backend has no cursor. Raise `limit` to get more rather than paging."
          : "The Apify actor returned no ads for these filters.",
      ads: kept,
    };
  }

  /** No company-search endpoint on this actor, so derive advertisers from results. */
  async listAdvertisers(query: string, country = "US"): Promise<Advertiser[]> {
    const result = await this.search({ query, country, activeStatus: "all", limit: 60 });
    const byPage = new Map<string, Advertiser>();
    for (const ad of result.ads) {
      if (!ad.pageId) continue;
      const existing = byPage.get(ad.pageId);
      if (existing) {
        existing.adCount = (existing.adCount ?? 0) + 1;
        continue;
      }
      byPage.set(ad.pageId, {
        pageId: ad.pageId,
        pageName: ad.pageName,
        pageUrl: ad.pageUrl,
        pageLikes: ad.pageLikes,
        profilePictureUrl: ad.pageProfilePictureUrl,
        adCount: 1,
      });
    }
    return [...byPage.values()].sort((a, b) => (b.adCount ?? 0) - (a.adCount ?? 0));
  }

  async getAd(libraryId: string): Promise<Ad | undefined> {
    const items = await this.run(adDetailsUrl(libraryId), 1);
    for (const item of items) {
      if (typeof item !== "object" || item === null) continue;
      const ad = adFromApify(item as Record<string, unknown>);
      if (ad.libraryId) return ad;
    }
    return undefined;
  }
}
