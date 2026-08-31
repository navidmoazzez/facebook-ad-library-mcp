/**
 * Turning each source's payload into one `Ad`.
 *
 * Field shapes here were verified against a live capture on 2026-08-31: 40 ads
 * spanning every display format Meta serves (DCO, DPA, VIDEO, IMAGE, CAROUSEL).
 * Creatives arrive in three disjoint places depending on that format, which is
 * the single most common thing other scrapers get wrong.
 */

import type { Ad, BackendName, Creative } from "./types.js";

const AD_DETAILS = "https://www.facebook.com/ads/library/?id=";

type Json = Record<string, unknown>;

function obj(value: unknown): Json | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function arr(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter((v): v is Json => obj(v) !== undefined) : [];
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Unix seconds to an ISO date. Meta sends integers, providers sometimes send strings. */
export function isoDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "" || value === 0) return undefined;
  let seconds: number | undefined;
  if (typeof value === "number") seconds = value;
  else if (typeof value === "string") {
    if (!/^\d+$/.test(value)) return value.length >= 10 ? value.slice(0, 10) : value;
    seconds = Number(value);
  }
  if (seconds === undefined || !Number.isFinite(seconds)) return undefined;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

/** Meta wraps copy as {"text": "..."}. Providers send a bare string. */
export function text(value: unknown): string | undefined {
  if (typeof value === "string") return str(value);
  const wrapper = obj(value);
  return wrapper ? str(wrapper["text"]) : undefined;
}

/** `l.facebook.com/l.php?u=<real>` to `<real>`. */
export function unwrapRedirect(url: string | undefined): string | undefined {
  if (!url || !url.includes("l.facebook.com")) return url;
  try {
    const target = new URL(url).searchParams.get("u");
    return target ? decodeURIComponent(target) : url;
  } catch {
    return url;
  }
}

export function domainOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host || undefined;
  } catch {
    return undefined;
  }
}

/** `FACEBOOK` to `Facebook`, `AUDIENCE_NETWORK` to `Audience Network`. */
function platformLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Creatives live in three disjoint places depending on ad format:
 *   images: IMAGE ads          videos: VIDEO ads
 *   cards:  DCO, DPA, CAROUSEL, and these carry per-card copy and links
 */
function creativesFrom(snapshot: Json): Creative[] {
  const out: Creative[] = [];

  for (const image of arr(snapshot["images"])) {
    out.push({
      kind: "image",
      imageUrl: str(image["original_image_url"]) ?? str(image["resized_image_url"]),
    });
  }

  for (const video of arr(snapshot["videos"])) {
    out.push({
      kind: "video",
      videoHdUrl: str(video["video_hd_url"]),
      videoSdUrl: str(video["video_sd_url"]),
      previewImageUrl: str(video["video_preview_image_url"]),
    });
  }

  for (const card of arr(snapshot["cards"])) {
    const hd = str(card["video_hd_url"]);
    const sd = str(card["video_sd_url"]);
    out.push({
      kind: hd || sd ? "video" : "image",
      imageUrl: str(card["original_image_url"]) ?? str(card["resized_image_url"]),
      videoHdUrl: hd,
      videoSdUrl: sd,
      previewImageUrl: str(card["video_preview_image_url"]),
      title: text(card["title"]),
      body: text(card["body"]),
      caption: text(card["caption"]),
      ctaText: str(card["cta_text"]),
      linkUrl: unwrapRedirect(str(card["link_url"])),
    });
  }

  return out;
}

function daysBetween(startIso: string, endIso: string | undefined): number | undefined {
  const start = Date.parse(startIso);
  const end = endIso ? Date.parse(endIso) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

/** Normalise one `collated_results` entry from Meta's Ad Library GraphQL. */
export function adFromGraphql(node: Json, source: BackendName = "browser"): Ad {
  const snapshot = obj(node["snapshot"]) ?? {};
  const linkUrl = unwrapRedirect(str(snapshot["link_url"]));
  const startedRunning = isoDate(node["start_date"]);
  const stoppedRunning = isoDate(node["end_date"]);
  const libraryId = String(node["ad_archive_id"] ?? node["adArchiveId"] ?? "");

  // Meta gives total_active_time in seconds when it gives it at all; otherwise
  // measure from the start date, and only to the stop date once it has stopped.
  const activeSeconds = num(node["total_active_time"]);
  const daysActive =
    activeSeconds && activeSeconds > 0
      ? Math.floor(activeSeconds / 86_400)
      : startedRunning
        ? daysBetween(startedRunning, node["is_active"] === true ? undefined : stoppedRunning)
        : undefined;

  const impressionsWrapper = obj(node["impressions_with_index"]);

  return {
    libraryId,
    adDetailsUrl: libraryId ? AD_DETAILS + libraryId : "",
    pageId: node["page_id"] !== undefined ? String(node["page_id"]) : undefined,
    pageName: str(node["page_name"]) ?? str(snapshot["page_name"]),
    pageUrl: str(snapshot["page_profile_uri"]),
    pageLikes: num(snapshot["page_like_count"]),
    pageCategories: strArray(snapshot["page_categories"]),
    pageProfilePictureUrl: str(snapshot["page_profile_picture_url"]),
    isActive: typeof node["is_active"] === "boolean" ? node["is_active"] : undefined,
    startedRunning,
    stoppedRunning,
    daysActive,
    platforms: strArray(node["publisher_platform"]).map(platformLabel),
    countries: strArray(node["targeted_or_reached_countries"]),
    categories: strArray(node["categories"]),
    displayFormat: str(snapshot["display_format"]),
    title: text(snapshot["title"]),
    body: text(snapshot["body"]),
    caption: text(snapshot["caption"]),
    linkDescription: text(snapshot["link_description"]),
    ctaText: str(snapshot["cta_text"]),
    ctaType: str(snapshot["cta_type"]),
    linkUrl,
    linkDomain: domainOf(linkUrl),
    creatives: creativesFrom(snapshot),
    variantsUsingCreative: num(node["collation_count"]),
    spend: node["spend"] ?? undefined,
    currency: str(node["currency"]),
    reachEstimate: node["reach_estimate"] ?? undefined,
    impressions: impressionsWrapper ? impressionsWrapper["impressions_text"] : undefined,
    source,
  };
}

/**
 * Apify flattens the card into its own field names. Where it passes Meta's
 * shape through untouched, reuse the Meta path rather than mapping twice.
 */
export function adFromApify(item: Json): Ad {
  if (obj(item["snapshot"]) && item["ad_archive_id"]) return adFromGraphql(item, "apify");

  const linkUrl = unwrapRedirect(str(item["link_url"]) ?? str(item["linkUrl"]));
  const libraryId = String(
    item["ad_archive_id"] ?? item["adArchiveId"] ?? item["id"] ?? "",
  );

  return {
    libraryId,
    adDetailsUrl: libraryId ? AD_DETAILS + libraryId : "",
    pageId:
      item["page_id"] !== undefined || item["pageId"] !== undefined
        ? String(item["page_id"] ?? item["pageId"])
        : undefined,
    pageName: str(item["page_name"]) ?? str(item["pageName"]),
    pageUrl: str(item["page_profile_uri"]) ?? str(item["pageUrl"]),
    pageLikes: num(item["page_like_count"]) ?? num(item["pageLikes"]),
    pageCategories: [],
    isActive:
      typeof item["is_active"] === "boolean"
        ? item["is_active"]
        : typeof item["isActive"] === "boolean"
          ? item["isActive"]
          : undefined,
    startedRunning: isoDate(item["start_date"] ?? item["startDate"]),
    stoppedRunning: isoDate(item["end_date"] ?? item["endDate"]),
    platforms: strArray(item["publisher_platform"] ?? item["publisherPlatform"]).map(platformLabel),
    countries: [],
    categories: [],
    displayFormat: str(item["display_format"]) ?? str(item["displayFormat"]),
    title: text(item["title"]),
    body: text(item["body"]) ?? text(item["adText"]),
    caption: text(item["caption"]),
    ctaText: str(item["cta_text"]) ?? str(item["ctaText"]),
    ctaType: str(item["cta_type"]) ?? str(item["ctaType"]),
    linkUrl,
    linkDomain: domainOf(linkUrl),
    creatives: [],
    spend: item["spend"] ?? undefined,
    currency: str(item["currency"]),
    reachEstimate: item["reach_estimate"] ?? item["reach"] ?? undefined,
    source: "apify",
  };
}
