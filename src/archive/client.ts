/**
 * Meta's official Ad Library API (`ads_archive`).
 *
 * This is not a backend. It cannot find ordinary commercial ads, so it can never
 * replace the browser or a provider. It does the one thing none of them can:
 * return real spend, impressions, reach and demographic breakdowns, published
 * under transparency law.
 *
 * Coverage, stated plainly because it is the whole catch:
 *   - Political and issue ads: worldwide, with spend and impression ranges.
 *   - Every ad delivered in the EU: covered by the DSA, with reach attached.
 *   - An ordinary commercial ad in the US: not in here at all.
 *
 * So this returning nothing for a US brand is the correct answer, not a failure.
 *
 * The Graph version defaults to v26.0, which was the highest version accepting
 * requests when this was written on 2026-08-31 (v27.0 and above answered
 * "does not exist"). Override with META_GRAPH_VERSION when Meta moves on.
 */

import { AdLibraryError } from "../errors.js";

const BASE = "https://graph.facebook.com";

/**
 * Requested in full first. If the token lacks access to some of these, Meta
 * rejects the whole call rather than omitting the field, so we retry with CORE.
 */
const FULL_FIELDS = [
  "id", "page_id", "page_name", "ad_snapshot_url",
  "ad_creation_time", "ad_delivery_start_time", "ad_delivery_stop_time",
  "ad_creative_bodies", "ad_creative_link_titles",
  "ad_creative_link_captions", "ad_creative_link_descriptions",
  "publisher_platforms", "languages", "bylines",
  "currency", "spend", "impressions",
  "demographic_distribution", "delivery_by_region",
  "eu_total_reach", "age_country_gender_reach_breakdown",
  "target_ages", "target_gender", "target_locations",
  "beneficiary_payers",
];

const CORE_FIELDS = [
  "id", "page_id", "page_name", "ad_snapshot_url",
  "ad_delivery_start_time", "ad_delivery_stop_time",
  "ad_creative_bodies", "ad_creative_link_titles",
  "publisher_platforms", "currency", "spend", "impressions",
];

export type ArchiveQuery = {
  query?: string;
  pageIds?: string[];
  country?: string;
  limit?: number;
  adType?: string;
};

export type ArchiveResult = {
  count: number;
  country: string;
  fieldsReturned: "full" | "core";
  next?: string;
  ads: unknown[];
  note?: string;
};

export class ArchiveClient {
  private readonly version: string;

  constructor(
    private readonly token: string,
    options: { version?: string; timeoutMs?: number } = {},
  ) {
    if (!token) {
      throw new AdLibraryError("Meta's Ad Library API needs a token.", {
        hint:
          "Create a Meta app, generate a token, and set META_ADS_ARCHIVE_TOKEN. It is free. " +
          "Without it every other tool still works, they just cannot return spend or reach.",
      });
    }
    this.version = options.version ?? process.env["META_GRAPH_VERSION"] ?? "v26.0";
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  private readonly timeoutMs: number;

  private async request(params: URLSearchParams): Promise<Record<string, unknown>> {
    const url = new URL(`/${this.version}/ads_archive?${params.toString()}`, BASE);
    const response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });

    let payload: Record<string, unknown>;
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new AdLibraryError("The Ad Library API returned a body that is not JSON.");
    }

    const error = payload["error"];
    if (error && typeof error === "object") {
      const err = error as Record<string, unknown>;
      throw new AdLibraryError(`Ad Library API error ${err["code"]}: ${err["message"]}`, {
        hint: "Check META_ADS_ARCHIVE_TOKEN is valid and has not expired.",
      });
    }
    return payload;
  }

  async search(query: ArchiveQuery): Promise<ArchiveResult> {
    if (!query.query && !(query.pageIds && query.pageIds.length > 0)) {
      throw new AdLibraryError("Pass either query or page_ids.");
    }
    const country = (query.country ?? "DE").toUpperCase();

    const build = (fields: string[]): URLSearchParams => {
      const params = new URLSearchParams({
        access_token: this.token,
        ad_reached_countries: JSON.stringify([country]),
        ad_type: query.adType ?? "ALL",
        limit: String(Math.min(Math.max(query.limit ?? 25, 1), 100)),
        fields: fields.join(","),
      });
      if (query.query) params.set("search_terms", query.query);
      if (query.pageIds?.length) params.set("search_page_ids", JSON.stringify(query.pageIds));
      return params;
    };

    let payload: Record<string, unknown>;
    let fieldsReturned: "full" | "core" = "full";
    try {
      payload = await this.request(build(FULL_FIELDS));
    } catch {
      // Most often a permissions problem on the EU-only fields. Retry with the
      // set every token can read rather than failing the whole call.
      payload = await this.request(build(CORE_FIELDS));
      fieldsReturned = "core";
    }

    const ads = Array.isArray(payload["data"]) ? (payload["data"] as unknown[]) : [];
    const paging = payload["paging"] as Record<string, unknown> | undefined;

    return {
      count: ads.length,
      country,
      fieldsReturned,
      next: typeof paging?.["next"] === "string" ? paging["next"] : undefined,
      ads,
      note:
        ads.length === 0
          ? "Empty is a valid answer. This API covers political and issue ads worldwide, plus " +
            "every ad delivered in the EU. Ordinary commercial ads outside the EU are not in " +
            "it at all. Use search_ads for those."
          : undefined,
    };
  }
}
