/**
 * Output schemas, so clients render real objects rather than a wall of JSON text.
 *
 * A tool without an `outputSchema` returns its result as a string in `content`,
 * and every client can do with that is print it. With one, the SDK also sends
 * `structuredContent`, which a client can put in a table, a card, or a filter.
 *
 * These describe the shape `format/ads.ts` produces, not the internal `Ad`. The
 * formatter drops empty fields, so almost everything here is optional by design:
 * a schema that demanded them would reject its own output.
 */

import { z } from "zod";

export const creativeSchema = z
  .object({
    kind: z.enum(["image", "video"]),
    imageUrl: z.string().optional(),
    videoHdUrl: z.string().optional(),
    videoSdUrl: z.string().optional(),
    previewImageUrl: z.string().optional(),
    title: z.string().optional(),
    body: z.string().optional(),
    caption: z.string().optional(),
    ctaText: z.string().optional(),
    linkUrl: z.string().optional(),
  })
  .describe("One image or video from the ad. A carousel has several.");

/** The compact per-ad shape `search_ads` returns. */
export const adSummarySchema = z.object({
  library_id: z.string(),
  advertiser: z.string().optional(),
  page_id: z.string().optional(),
  active: z.boolean().optional(),
  started: z.string().optional().describe("ISO date the ad began running."),
  stopped: z.string().optional(),
  days_active: z
    .number()
    .optional()
    .describe("How long it has run. The only performance signal that exists, and a hypothesis rather than a measurement."),
  platforms: z.array(z.string()).optional(),
  format: z.string().optional().describe("IMAGE, VIDEO, CAROUSEL, DCO or DPA."),
  cta: z.string().optional(),
  landing_domain: z.string().optional(),
  body: z.string().optional(),
  creatives: z.number().optional().describe("How many creatives this ad carries."),
  videos: z.number().optional(),
  variants_using_creative: z.number().optional(),
  spend: z.unknown().optional().describe("EU and political ads only. Null elsewhere is correct."),
  reach: z.unknown().optional(),
  details: z.string().optional(),
});

export const searchAdsOutput = {
  backend: z.string(),
  count: z.number(),
  total_available: z.number().optional().describe("Meta's own count of matching ads."),
  has_more: z.boolean(),
  cursor: z.string().optional(),
  url: z.string().optional(),
  note: z.string().optional(),
  ads: z.array(adSummarySchema),
};

export const advertiserSchema = z.object({
  page_id: z.string(),
  name: z.string().optional(),
  url: z.string().optional(),
  likes: z.number().optional(),
  verified: z.boolean().optional(),
  category: z.string().optional(),
  ads_seen: z.number().optional(),
});

export const listAdvertisersOutput = {
  count: z.number(),
  advertisers: z.array(advertiserSchema),
  note: z.string().optional(),
};

export const getAdOutput = {
  found: z.boolean(),
  library_id: z.string().optional(),
  note: z.string().optional(),
  ad: z.record(z.string(), z.unknown()).optional(),
};

export const adLibraryUrlOutput = { url: z.string() };

export const backendStatusOutput = {
  backend: z.string(),
  needs_api_key: z.boolean(),
  costs_money_per_request: z.boolean(),
  transcription_available: z.boolean(),
  eu_transparency_available: z.boolean(),
  tracked_advertisers: z.number(),
  note: z.string(),
};

export const transcribeOutput = {
  available: z.boolean(),
  backend: z.string().optional(),
  library_id: z.string().optional(),
  transcript: z.string().optional(),
  note: z.string().optional(),
};

export const diffOutput = {
  baseline_created: z.boolean(),
  page_id: z.string(),
  tracked_now: z.number().optional(),
  previously_tracked: z.number().optional(),
  running_now: z.number().optional(),
  started_running: z.array(adSummarySchema).optional(),
  no_longer_seen: z.array(z.record(z.string(), z.unknown())).optional(),
  note: z.string(),
};

export const transparencyOutput = {
  count: z.number(),
  country: z.string(),
  fields_returned: z.string(),
  next: z.string().optional(),
  note: z.string().optional(),
  ads: z.array(z.record(z.string(), z.unknown())),
};
