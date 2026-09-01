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

const BASE = "https://api.apify.com/v2";

/**
 * Two actors do this job on Apify and they are priced an order of magnitude
 * apart, so which one runs is a real decision rather than a detail.
 *
 * `lite` is the default because it is roughly 6 to 19 times cheaper and takes
 * structured parameters instead of a prebuilt URL, which means no filter can be
 * lost in translation. `full` is kept because its e-commerce enrichment has no
 * equivalent anywhere else.
 *
 * Prices are the actors' own published figures, read 2026-09-01, not measured.
 */
export const ACTORS = {
  lite: {
    id: "igolaizola~facebook-ad-library-scraper",
    price: "about $0.30 per 1,000 results",
  },
  full: {
    id: "apify~facebook-ads-scraper",
    price: "about $3.40 to $5.80 per 1,000 results, plus e-commerce enrichment",
  },
} as const;

export type ActorChoice = keyof typeof ACTORS;

export class ApifyBackend implements Backend {
  readonly name = "apify" as const;
  readonly needsKey = true;

  private readonly actor: ActorChoice;

  constructor(
    private readonly token: string,
    private readonly options: { timeoutMs?: number; ecommerce?: boolean; actor?: ActorChoice } = {},
  ) {
    // Enrichment only exists on the expensive actor, so asking for it picks it.
    this.actor = options.actor ?? (options.ecommerce ? "full" : "lite");
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
  /**
   * One synchronous actor run, returning its dataset items.
   *
   * `run-sync-get-dataset-items` blocks until the run finishes, which is why the
   * default timeout is generous. Apify caps a sync run at five minutes, so a very
   * large limit times out rather than returning partial data.
   */
  private async run(params: SearchParams, limit: number): Promise<unknown[]> {
    const endpoint = new URL(`/v2/acts/${ACTORS[this.actor].id}/run-sync-get-dataset-items`, BASE);
    endpoint.searchParams.set("token", this.token);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(this.inputFor(params, limit)),
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
    if (response.status === 403) {
      const body = (await response.text()).slice(0, 400);
      // Apify's free plan cannot run public Actors at all, which is a billing
      // state rather than a bad token, so it needs its own message: retrying or
      // regenerating the token will never fix it.
      if (body.includes("public-actor-disabled")) {
        throw new AdLibraryError(
          "This Apify plan cannot run public Actors, which is what this backend needs.",
          {
            backend: this.name,
            hint:
              "Upgrade the Apify plan, or use a backend that works on any plan: " +
              "FBADS_BACKEND=browser is free and needs no account, and " +
              "FBADS_BACKEND=scrapecreators needs only an API key.",
          },
        );
      }
      throw new AdLibraryError(`Apify refused the run (403): ${body}`, { backend: this.name });
    }
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new AdLibraryError(`Apify error ${response.status}: ${body}`, { backend: this.name });
    }

    const items = await response.json();
    return Array.isArray(items) ? items : [];
  }

  /**
   * The two actors take completely different input, which is most of the reason
   * to keep the choice explicit rather than hiding it behind one shape.
   *
   * `lite` takes the filters directly. `full` takes a prebuilt Ad Library URL,
   * the same one the browser backend navigates to, so those two share
   * `adlibrary/url.ts` and cannot drift.
   */
  private inputFor(params: SearchParams, limit: number): Record<string, unknown> {
    if (this.actor === "lite") {
      return {
        maxItems: limit,
        ...(params.pageId ? { pageId: params.pageId } : { query: params.query }),
        country: params.country ?? "US",
        mediaType: params.mediaType ?? "all",
        activeStatus: params.activeStatus ?? "active",
        fetchDetails: true,
      };
    }
    return {
      startUrls: [{ url: buildUrl(params) }],
      resultsLimit: limit,
      isDetailsPerAd: true,
      enrichWithEcommerceData: this.options.ecommerce ?? false,
    };
  }

  async search(params: SearchParams): Promise<SearchResult> {
    if (!params.query && !params.pageId) {
      throw new AdLibraryError("Pass either query or page_id.", { backend: this.name });
    }
    const limit = params.limit ?? 30;
    const items = await this.run(params, limit);

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
      url: buildUrl(params),
      note:
        kept.length > 0
          ? `Actor: ${ACTORS[this.actor].id}, ${ACTORS[this.actor].price}. No cursor on this backend, so raise \`limit\` rather than paging.`
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

  /**
   * Fetching one ad by id is the one thing this backend cannot always do.
   *
   * The `full` actor takes a URL, so an ad's detail page works. The `lite`
   * actor takes filters only and has no field for an ad id at all, so there is
   * nothing to send it. Saying that plainly beats sending a URL into a `query`
   * field and returning whatever unrelated ads come back.
   */
  async getAd(libraryId: string): Promise<Ad | undefined> {
    if (this.actor === "lite") {
      throw new AdLibraryError(
        `The ${ACTORS.lite.id} actor cannot fetch a single ad by id: its input takes ` +
          "search filters only.",
        {
          backend: this.name,
          hint:
            "Use FBADS_BACKEND=browser or scrapecreators for get_ad, or set " +
            "APIFY_ACTOR=full to use the actor that accepts an ad URL.",
        },
      );
    }

    const endpoint = new URL(`/v2/acts/${ACTORS.full.id}/run-sync-get-dataset-items`, BASE);
    endpoint.searchParams.set("token", this.token);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url: adDetailsUrl(libraryId) }],
        resultsLimit: 1,
        isDetailsPerAd: true,
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 300_000),
    });
    if (!response.ok) {
      throw new AdLibraryError(`Apify error ${response.status}`, { backend: this.name });
    }
    const items = await response.json();
    for (const item of Array.isArray(items) ? items : []) {
      if (typeof item !== "object" || item === null) continue;
      const ad = adFromApify(item as Record<string, unknown>);
      if (ad.libraryId) return ad;
    }
    return undefined;
  }
}
