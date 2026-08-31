/**
 * Meta's official transparency data, layered on top of whichever backend is active.
 */

import { z } from "zod";
import { ArchiveClient } from "../archive/client.js";
import { AdLibraryError } from "../errors.js";
import { defineTool, type AnyToolSpec } from "./kit.js";

const getEuTransparency = defineTool({
  name: "get_eu_transparency",
  title: "EU spend and reach",
  description:
    "Spend, impressions, reach and demographic breakdown from Meta's official Ad Library API. " +
    "Covers ads delivered in the EU and political or issue ads anywhere. Returns nothing for " +
    "an ordinary US commercial ad because that data is not published, which is the correct " +
    "answer rather than an error. Needs META_ADS_ARCHIVE_TOKEN, which is free.",
  schema: {
    query: z.string().optional().describe("Brand or advertiser name to look up."),
    page_ids: z
      .string()
      .optional()
      .describe("Comma-separated Page IDs, as a more precise alternative to query."),
    country: z
      .string()
      .length(2)
      .optional()
      .describe("Two-letter EU country code, e.g. DE, FR, IE. Default DE."),
    limit: z.number().int().min(1).max(100).optional().describe("Maximum ads to return."),
  },
  handler: async (args, ctx) => {
    if (!ctx.config.archiveToken) {
      throw new AdLibraryError("No Meta Ad Library API token is configured.", {
        hint:
          "Set META_ADS_ARCHIVE_TOKEN. It is free: create a Meta app and generate a token. " +
          "Every other tool works without it, they just cannot return spend or reach.",
      });
    }
    const client = new ArchiveClient(ctx.config.archiveToken);
    const result = await client.search({
      query: args.query,
      pageIds: args.page_ids?.split(",").map((id) => id.trim()).filter(Boolean),
      country: args.country,
      limit: args.limit,
    });
    return {
      count: result.count,
      country: result.country,
      fields_returned: result.fieldsReturned,
      next: result.next,
      note: result.note,
      ads: result.ads,
    };
  },
});

export const TRANSPARENCY_TOOLS: AnyToolSpec[] = [getEuTransparency] as AnyToolSpec[];
