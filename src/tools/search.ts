/**
 * Finding ads and advertisers. The tools people actually reach for.
 */

import { z } from "zod";
import { buildUrl } from "../adlibrary/url.js";
import { detail, summarise } from "../format/ads.js";
import {
  adLibraryUrlOutput,
  getAdOutput,
  listAdvertisersOutput,
  searchAdsOutput,
  transcribeOutput,
} from "../adlibrary/schemas.js";
import { defineTool, searchArgs, type AnyToolSpec } from "./kit.js";

const searchAds = defineTool({
  name: "search_ads",
  title: "Search the Ad Library",
  description:
    "Search Meta's public Ad Library by keyword, or list every ad from one advertiser by " +
    "passing page_id. Returns advertiser, copy, creative count, destination domain, call to " +
    "action, platforms and how long each ad has run. Works for ordinary commercial " +
    "advertisers in any country. Spend and reach are null outside the EU, which is correct " +
    "rather than a failure: that data is only published for EU and political ads.",
  schema: {
    query: z
      .string()
      .optional()
      .describe("Keyword: a brand, product or angle. Optional if page_id is given."),
    page_id: z
      .string()
      .optional()
      .describe(
        "Advertiser Page ID. Returns that Page's ads instead of a keyword search. " +
          "Use list_advertisers first if you only know the brand name.",
      ),
    ...searchArgs,
  },
  outputSchema: searchAdsOutput,
  handler: async (args, ctx) => {
    const result = await ctx.backend.search({
      query: args.query,
      pageId: args.page_id,
      country: args.country,
      activeStatus: args.active_status,
      adType: args.ad_type,
      mediaType: args.media_type,
      limit: args.limit,
    });

    // Record against the advertiser so diff_advertiser has a baseline later.
    if (args.page_id && result.ads.length > 0) {
      await ctx.store.record(args.page_id, result.ads);
    }

    return {
      backend: result.backend,
      count: result.count,
      total_available: result.totalAvailable,
      has_more: result.hasMore,
      cursor: result.cursor,
      url: result.url,
      note: result.note,
      ads: result.ads.map(summarise),
    };
  },
});

const listAdvertisers = defineTool({
  name: "list_advertisers",
  title: "Find advertisers",
  description:
    "Resolve a brand name to the advertiser Pages actually running ads for it, ranked by how " +
    "many ads each is running. Use this first when you know the brand but not its Page ID, " +
    "then pass that ID to search_ads to get everything they run.",
  schema: {
    query: z.string().describe("Brand or company name to look up."),
    country: z.string().length(2).optional().describe("Two-letter country code. Default US."),
  },
  outputSchema: listAdvertisersOutput,
  handler: async (args, ctx) => {
    const advertisers = await ctx.backend.listAdvertisers(args.query, args.country ?? "US");
    return {
      count: advertisers.length,
      advertisers: advertisers.map((a) => ({
        page_id: a.pageId,
        name: a.pageName,
        url: a.pageUrl,
        likes: a.pageLikes,
        verified: a.verified,
        category: a.category,
        ads_seen: a.adCount,
      })),
      note:
        advertisers.length === 0
          ? "No advertisers found running ads for that term in this country. Try a broader " +
            "term, or active_status 'all' via search_ads."
          : undefined,
    };
  },
});

const getAd = defineTool({
  name: "get_ad",
  title: "Get one ad in full",
  description:
    "Fetch a single ad by its Ad Library ID, with every creative, all copy variants, the " +
    "full destination URL and any transparency data. Use this after search_ads when one ad " +
    "is worth studying properly.",
  schema: {
    library_id: z.string().describe("The Ad Library ID, the long number in an ad's URL."),
    country: z.string().length(2).optional().describe("Two-letter country code. Default US."),
  },
  outputSchema: getAdOutput,
  handler: async (args, ctx) => {
    const ad = await ctx.backend.getAd(args.library_id, args.country ?? "US");
    if (!ad) {
      return {
        found: false,
        library_id: args.library_id,
        note: "No ad with that ID came back. It may have been taken down, or the ID may be wrong.",
      };
    }
    return { found: true, ad: detail(ad) };
  },
});

const transcribeAd = defineTool({
  name: "transcribe_ad",
  title: "Transcribe a video ad",
  description:
    "Speech to text for a video ad, so its spoken script becomes readable. Only the " +
    "scrapecreators backend can do this. On any other backend it explains that rather than " +
    "failing silently.",
  schema: {
    library_id: z.string().describe("The Ad Library ID of a video ad."),
  },
  outputSchema: transcribeOutput,
  handler: async (args, ctx) => {
    if (!ctx.backend.transcribe) {
      return {
        available: false,
        backend: ctx.backend.name,
        note:
          "Transcription is only available on the scrapecreators backend. Set " +
          "SCRAPECREATORS_API_KEY and FBADS_BACKEND=scrapecreators to use it. The video URLs " +
          "from get_ad can be transcribed with your own tooling on any backend.",
      };
    }
    const transcript = await ctx.backend.transcribe(args.library_id);
    return {
      available: true,
      library_id: args.library_id,
      transcript,
      note: transcript ? undefined : "No transcript came back. The ad may not be a video.",
    };
  },
});

const adLibraryUrl = defineTool({
  name: "ad_library_url",
  title: "Build an Ad Library URL",
  description:
    "Turn a set of filters into the public Ad Library URL, so a person can open the same " +
    "search in a browser and check the results independently. Useful when a search comes " +
    "back empty and you need to tell 'no results' apart from 'blocked'.",
  schema: {
    query: z.string().optional().describe("Keyword to search for."),
    page_id: z.string().optional().describe("Advertiser Page ID, instead of a keyword."),
    country: z.string().length(2).optional().describe("Two-letter country code. Default US."),
    active_status: z.enum(["active", "inactive", "all"]).optional(),
    media_type: z.enum(["all", "image", "meme", "video", "none"]).optional(),
  },
  touchesNetwork: false,
  outputSchema: adLibraryUrlOutput,
  handler: async (args) => ({
    url: buildUrl({
      query: args.query,
      pageId: args.page_id,
      country: args.country,
      activeStatus: args.active_status,
      mediaType: args.media_type,
    }),
  }),
});

export const SEARCH_TOOLS: AnyToolSpec[] = [
  searchAds,
  listAdvertisers,
  getAd,
  transcribeAd,
  adLibraryUrl,
] as AnyToolSpec[];
