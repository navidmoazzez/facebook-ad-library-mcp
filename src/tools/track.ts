/**
 * Change over time.
 *
 * Every other tool answers "what is running". This one answers "what changed",
 * which is the question worth asking about a competitor and the one no snapshot
 * can reach. It needs a baseline, so the first call records one.
 */

import { z } from "zod";
import { summarise } from "../format/ads.js";
import { defineTool, type AnyToolSpec } from "./kit.js";

const diffAdvertiser = defineTool({
  name: "diff_advertiser",
  title: "What changed for an advertiser",
  description:
    "Compare an advertiser's ads now against the last time this server looked, and report " +
    "what they started and stopped running. The first call on a Page records a baseline and " +
    "reports nothing changed, which is expected: call it again later to see movement. This " +
    "is the only tool here that answers 'what changed' rather than 'what is running'.",
  schema: {
    page_id: z.string().describe("Advertiser Page ID to compare. Get it from list_advertisers."),
    country: z.string().length(2).optional().describe("Two-letter country code. Default US."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe("How many ads to pull for the comparison. Keep it consistent between calls."),
  },
  handler: async (args, ctx) => {
    const before = await ctx.store.snapshot(args.page_id);

    const result = await ctx.backend.search({
      pageId: args.page_id,
      country: args.country,
      activeStatus: "all",
      limit: args.limit ?? 60,
    });
    await ctx.store.record(args.page_id, result.ads);

    if (before.size === 0) {
      return {
        baseline_created: true,
        page_id: args.page_id,
        tracked_now: result.count,
        note:
          "No earlier snapshot existed, so this call recorded a baseline. Run it again later " +
          "to see what started and stopped.",
      };
    }

    const now = new Map(result.ads.map((ad) => [ad.libraryId, ad]));
    const started = result.ads.filter((ad) => !before.has(ad.libraryId));
    const stopped = [...before.values()].filter((ad) => !now.has(ad.libraryId));

    return {
      baseline_created: false,
      page_id: args.page_id,
      previously_tracked: before.size,
      running_now: now.size,
      started_running: started.map(summarise),
      no_longer_seen: stopped.map((ad) => ({
        ...summarise(ad),
        first_seen: new Date(ad.firstSeen).toISOString().slice(0, 10),
        last_seen: new Date(ad.lastSeen).toISOString().slice(0, 10),
      })),
      note:
        "'no_longer_seen' means the ad was absent from this result set. That usually means it " +
        "stopped, but a smaller limit or a different country explains it too. Keep both " +
        "consistent between calls for a clean comparison.",
    };
  },
});

export const TRACK_TOOLS: AnyToolSpec[] = [diffAdvertiser] as AnyToolSpec[];
