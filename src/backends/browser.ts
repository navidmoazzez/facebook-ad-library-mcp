/**
 * The free backend. No key, no account, no provider.
 *
 * How it works, and why it is not what the other Ad Library scrapers do:
 *
 * The Ad Library is a React app that receives every ad from Meta as JSON over
 * GraphQL. The common approach is to let it render, flatten the DOM to markdown
 * and regex the fields back out. That round trip is lossy: it recovers one
 * creative per ad, loses the platform list, hands back an l.facebook.com
 * redirect instead of the real landing page, and breaks whenever Meta ships
 * markup.
 *
 * This backend reads the payload the page was already given. Same browser, same
 * cost, no parsing.
 *
 * Two sources, because Meta uses two. The first page of results is inlined in
 * the document as a JSON script block and no GraphQL call is made for it; every
 * page after that arrives as a GraphQL response triggered by scrolling. Reading
 * only the XHRs makes the first search depend on a scroll landing in time.
 *
 * Verified against a live capture on 2026-08-31.
 */

import { AdLibraryError } from "../errors.js";
import { inlinePayloads, parsePayloads, type Harvest } from "../adlibrary/harvest.js";
import { adFromGraphql } from "../adlibrary/normalize.js";
import { adDetailsUrl, buildUrl } from "../adlibrary/url.js";
import type { Ad, Advertiser, Backend, SearchParams, SearchResult } from "../adlibrary/types.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export type BrowserOptions = {
  headless?: boolean;
  hydrateMs?: number;
  scrollWaitMs?: number;
};

export class BrowserBackend implements Backend {
  readonly name = "browser" as const;
  readonly needsKey = false;

  private readonly headless: boolean;
  private readonly hydrateMs: number;
  private readonly scrollWaitMs: number;

  // Launching Chromium costs seconds, so one instance is kept warm across calls.
  private browser: any;
  // Meta rate-limits hard on parallel pages, so calls are serialised.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: BrowserOptions = {}) {
    this.headless = options.headless ?? true;
    this.hydrateMs = options.hydrateMs ?? 9000;
    this.scrollWaitMs = options.scrollWaitMs ?? 4000;
  }

  private async launch(): Promise<any> {
    if (this.browser) return this.browser;
    let chromium: any;
    try {
      ({ chromium } = await import("playwright"));
    } catch {
      throw new AdLibraryError("The browser backend needs Playwright, which is not installed.", {
        backend: this.name,
        hint:
          "Run `npx playwright install chromium`, or switch to a provider backend " +
          "by setting FBADS_BACKEND=scrapecreators and SCRAPECREATORS_API_KEY.",
      });
    }
    try {
      this.browser = await chromium.launch({ headless: this.headless });
    } catch (error) {
      throw new AdLibraryError(
        `Chromium failed to launch: ${(error as Error).message}`,
        { backend: this.name, hint: "Run `npx playwright install chromium` to install the browser." },
      );
    }
    return this.browser;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = undefined;
    }
  }

  /** Run one page job at a time, whatever the caller does. */
  private serialise<T>(job: () => Promise<T>): Promise<T> {
    const result = this.queue.then(job, job);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async collect(url: string, limit: number): Promise<Harvest> {
    const browser = await this.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      locale: "en-US",
      userAgent: USER_AGENT,
    });

    const bodies: string[] = [];
    try {
      const page = await context.newPage();

      page.on("response", (response: any) => {
        if (!String(response.url()).includes("/api/graphql")) return;
        // A body can vanish when the page navigates. Losing one is survivable;
        // an unhandled rejection here would take the whole call down.
        void response
          .text()
          .then((body: string) => bodies.push(body))
          .catch(() => undefined);
      });

      // Meta answers a headless browser with HTTP 403 on the document but still
      // serves the app and every payload. Judge success by ads parsed, never by status.
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(this.hydrateMs);

      // The inlined first page. Read once: it does not change as we scroll.
      bodies.push(...inlinePayloads(await page.content()));

      let seen = new Set<string>();
      let stalls = 0;
      while (stalls < 3) {
        const harvest = parsePayloads(bodies);
        const ids = new Set(harvest.nodes.map((node) => String(node["ad_archive_id"])));
        const sameAsLast = ids.size === seen.size && [...ids].every((id) => seen.has(id));
        if (ids.size >= limit || (!harvest.hasMore && ids.size > 0 && sameAsLast)) break;
        stalls = sameAsLast ? stalls + 1 : 0;
        seen = ids;
        await page.mouse.wheel(0, 8000);
        await page.waitForTimeout(this.scrollWaitMs);
      }

      await page.close();
    } finally {
      await context.close().catch(() => undefined);
    }

    return parsePayloads(bodies);
  }

  async search(params: SearchParams): Promise<SearchResult> {
    if (!params.query && !params.pageId) {
      throw new AdLibraryError("Pass either query or page_id.", { backend: this.name });
    }
    const limit = params.limit ?? 30;
    const url = buildUrl(params);
    const harvest = await this.serialise(() => this.collect(url, limit));

    const ads: Ad[] = [];
    const seen = new Set<string>();
    for (const node of harvest.nodes) {
      const ad = adFromGraphql(node);
      if (!ad.libraryId || seen.has(ad.libraryId)) continue;
      seen.add(ad.libraryId);
      ads.push(ad);
    }

    let note: string | undefined;
    if (harvest.captcha) {
      note =
        "Meta served a captcha instead of results, so nothing could be read. Wait a few " +
        "minutes, or use a provider backend, which is not affected.";
    } else if (ads.length === 0) {
      note = harvest.total
        ? `No ads captured even though Meta reports ${harvest.total} matching. Retry in a minute.`
        : "No ads captured. Either this search genuinely has no results, or Meta declined " +
          "to serve them. Open the `url` in a browser to tell the two apart.";
    } else if (harvest.total && harvest.total > ads.length) {
      note = `Meta reports ${harvest.total} matching ads. Raise \`limit\` for more.`;
    }

    const kept = ads.slice(0, limit);
    return {
      backend: this.name,
      count: kept.length,
      hasMore: harvest.hasMore || ads.length > limit,
      cursor: harvest.cursor,
      totalAvailable: harvest.total,
      url,
      note,
      ads: kept,
    };
  }

  /**
   * Meta publishes no advertiser-search payload we can rely on, so derive the
   * list from who is actually running ads for the term. Fewer false hits than a
   * name lookup, and it only surfaces pages with live creative.
   */
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
        category: ad.pageCategories[0],
        profilePictureUrl: ad.pageProfilePictureUrl,
        adCount: 1,
      });
    }
    return [...byPage.values()].sort((a, b) => (b.adCount ?? 0) - (a.adCount ?? 0));
  }

  async getAd(libraryId: string): Promise<Ad | undefined> {
    const harvest = await this.serialise(() => this.collect(adDetailsUrl(libraryId), 1));
    const match = harvest.nodes.find((node) => String(node["ad_archive_id"]) === String(libraryId));
    const node = match ?? harvest.nodes[0];
    return node ? adFromGraphql(node) : undefined;
  }
}
