/**
 * ScrapeCreators backend. Needs a key, works serverless, about $1.88 per 1,000 ads.
 *
 * Use this instead of the browser when Chromium cannot run (a serverless
 * function, a container without a browser) or when the volume makes babysitting
 * Meta's rate limits not worth it.
 *
 * Request parameters are taken from their published OpenAPI spec, read
 * 2026-08-31. Their *response* envelope is not published, so nothing here
 * assumes a path into it: we walk the payload for ad-shaped objects. See
 * `adlibrary/harvest.ts`.
 *
 * One thing this backend can do that the browser cannot: `transcribe`, which is
 * server-side speech to text on a video ad.
 */

import { AdLibraryError } from "../errors.js";
import { findConnections, parsePayloads } from "../adlibrary/harvest.js";
import { adFromGraphql } from "../adlibrary/normalize.js";
import type { Ad, Advertiser, Backend, SearchParams, SearchResult } from "../adlibrary/types.js";

const BASE = "https://api.scrapecreators.com";

// Their vocabulary is uppercase, ours is lowercase. Map at the boundary.
const STATUS = { active: "ACTIVE", inactive: "INACTIVE", all: "ALL" } as const;
const MEDIA = {
  all: "ALL",
  image: "IMAGE",
  meme: "MEME",
  video: "VIDEO",
  none: "NONE",
} as const;

type Json = Record<string, unknown>;

/** Their cursor field is undocumented, so accept any plausible spelling. */
function cursorFrom(payload: unknown): { cursor?: string; hasMore: boolean } {
  for (const conn of findConnections(payload)) {
    const info = conn["page_info"];
    if (typeof info === "object" && info !== null) {
      const endCursor = (info as Json)["end_cursor"];
      if (typeof endCursor === "string") {
        return { cursor: endCursor, hasMore: (info as Json)["has_next_page"] === true };
      }
    }
  }
  if (typeof payload === "object" && payload !== null) {
    for (const key of ["cursor", "nextCursor", "next_cursor", "paginationToken"]) {
      const value = (payload as Json)[key];
      if (typeof value === "string" && value) return { cursor: value, hasMore: true };
    }
  }
  return { hasMore: false };
}

export class ScrapeCreatorsBackend implements Backend {
  readonly name = "scrapecreators" as const;
  readonly needsKey = true;

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs = 120_000,
  ) {
    if (!apiKey) {
      throw new AdLibraryError("The scrapecreators backend needs an API key.", {
        backend: this.name,
        hint: "Set SCRAPECREATORS_API_KEY, or use the free browser backend with FBADS_BACKEND=browser.",
      });
    }
  }

  async close(): Promise<void> {
    // Nothing to release: this backend is stateless fetch calls.
  }

  private async get(path: string, params: Record<string, unknown>): Promise<unknown> {
    const url = new URL(path, BASE);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "" || value === false) continue;
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      headers: { "x-api-key": this.apiKey },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (response.status === 401) {
      throw new AdLibraryError("ScrapeCreators rejected the key (401).", {
        backend: this.name,
        hint: "Check SCRAPECREATORS_API_KEY.",
      });
    }
    if (response.status === 402) {
      throw new AdLibraryError("ScrapeCreators is out of credits (402).", {
        backend: this.name,
        hint: "Top up the account, or switch to the free browser backend with FBADS_BACKEND=browser.",
      });
    }
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new AdLibraryError(`ScrapeCreators error ${response.status}: ${body}`, {
        backend: this.name,
      });
    }

    try {
      return await response.json();
    } catch {
      throw new AdLibraryError("ScrapeCreators returned a body that is not JSON.", {
        backend: this.name,
      });
    }
  }

  async search(params: SearchParams): Promise<SearchResult> {
    if (!params.query && !params.pageId) {
      throw new AdLibraryError("Pass either query or page_id.", { backend: this.name });
    }
    const limit = params.limit ?? 30;
    const common = {
      country: params.country ?? "US",
      status: STATUS[params.activeStatus ?? "active"],
      media_type: MEDIA[params.mediaType ?? "all"],
      cursor: params.cursor,
    };

    const payload = params.pageId
      ? await this.get("/v1/facebook/adLibrary/company/ads", { ...common, pageId: params.pageId })
      : await this.get("/v1/facebook/adLibrary/search/ads", {
          ...common,
          query: params.query,
          ad_type: params.adType === "political_and_issue_ads" ? "POLITICAL_AND_ISSUE_ADS" : "ALL",
        });

    const harvest = parsePayloads(payload);
    const fallback = harvest.cursor ? undefined : cursorFrom(payload);
    const ads = harvest.nodes.map((node) => adFromGraphql(node, this.name));
    const kept = ads.slice(0, limit);

    return {
      backend: this.name,
      count: kept.length,
      hasMore: harvest.hasMore || fallback?.hasMore || ads.length > limit,
      cursor: harvest.cursor ?? fallback?.cursor,
      totalAvailable: harvest.total,
      note: kept.length > 0 ? undefined : "ScrapeCreators returned no ads for these filters.",
      ads: kept,
    };
  }

  async listAdvertisers(query: string): Promise<Advertiser[]> {
    const payload = await this.get("/v1/facebook/adLibrary/search/companies", { query });
    const items = Array.isArray(payload)
      ? payload
      : ((payload as Json)?.["searchResults"] ??
          (payload as Json)?.["results"] ??
          (payload as Json)?.["companies"] ??
          []);

    const out: Advertiser[] = [];
    for (const raw of Array.isArray(items) ? items : []) {
      if (typeof raw !== "object" || raw === null) continue;
      const item = raw as Json;
      const pageId = item["page_id"] ?? item["pageId"] ?? item["id"];
      if (!pageId) continue;
      out.push({
        pageId: String(pageId),
        pageName: (item["name"] ?? item["page_name"] ?? item["pageName"]) as string | undefined,
        pageUrl: (item["page_url"] ?? item["pageUrl"]) as string | undefined,
        pageLikes: (item["likes"] ?? item["page_like_count"]) as number | undefined,
        verified: (item["verified"] ?? item["is_verified"]) as boolean | undefined,
        category: item["category"] as string | undefined,
        profilePictureUrl: (item["image_uri"] ?? item["profile_picture_url"]) as string | undefined,
      });
    }
    return out;
  }

  async getAd(libraryId: string): Promise<Ad | undefined> {
    const payload = await this.get("/v1/facebook/adLibrary/ad", { id: libraryId });
    const harvest = parsePayloads(payload);
    const node = harvest.nodes[0];
    return node ? adFromGraphql(node, this.name) : undefined;
  }

  async transcribe(libraryId: string): Promise<string | undefined> {
    const payload = await this.get("/v1/facebook/adLibrary/ad/transcript", { id: libraryId });
    if (typeof payload === "string") return payload;
    if (typeof payload === "object" && payload !== null) {
      for (const key of ["transcript", "text", "transcription"]) {
        const value = (payload as Json)[key];
        if (typeof value === "string" && value) return value;
      }
    }
    return undefined;
  }
}
