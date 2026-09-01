/**
 * Letting the model actually look at the ad.
 *
 * Every other tool describes a creative: its format, its copy, a URL. None of
 * that answers the question people actually have about advertising, which is
 * what the thing looks like and why it works. A model that can read the body
 * text but not see the image is guessing at half the ad.
 *
 * Images are returned as MCP image blocks, so the model sees the real pixels
 * rather than a description of them. That needs no API key and no dependency:
 * the bytes are already on Meta's CDN and the protocol already carries images.
 *
 * Video is deliberately not here. A model cannot ingest video directly, and
 * sampling frames throws away the pacing, the cuts and the audio, which for an
 * ad is most of the craft. That belongs in a separate tool backed by a model
 * with native video understanding.
 */

import { z } from "zod";
import { defineTool, okWithImages, type AnyToolSpec, type ToolResult } from "./kit.js";

/**
 * Base64 inflates bytes by about a third, and a creative runs from 100KB to
 * roughly 1MB. Six is about as many as fits in a response a client will render
 * comfortably; anything larger is skipped rather than silently truncating.
 */
const MAX_IMAGES = 6;
const MAX_BYTES = 4_000_000;

async function fetchImage(url: string): Promise<{ data: string; mimeType: string; bytes: number } | undefined> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return undefined;

  const mimeType = response.headers.get("content-type") ?? "image/jpeg";
  if (!mimeType.startsWith("image/")) return undefined;

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) return undefined;

  return { data: buffer.toString("base64"), mimeType, bytes: buffer.byteLength };
}

const viewAdCreative = defineTool({
  name: "view_ad_creative",
  title: "Look at an ad's images",
  description:
    "Return the actual images from one ad so you can see them, rather than only reading its " +
    "copy. Use this when the question is about what an ad looks like: the visual hook, the " +
    "layout, the product shot, how the text sits on the image, or what several ads have in " +
    "common visually. A carousel returns each card in order. Video ads have no still to show " +
    "and report that instead. Needs no API key.",
  schema: {
    library_id: z.string().describe("The Ad Library ID, from search_ads."),
    country: z.string().length(2).optional().describe("Two-letter country code. Default US."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_IMAGES)
      .optional()
      .describe(`How many images to return, up to ${MAX_IMAGES}. Carousels have several.`),
  },
  // Images go back as content blocks, so this builds its own result.
  returnsContent: true,
  handler: async (args, ctx): Promise<ToolResult> => {
    const ad = await ctx.backend.getAd(args.library_id, args.country ?? "US");
    if (!ad) {
      return okWithImages(
        { found: false, library_id: args.library_id, note: "No ad with that ID came back." },
        [],
      );
    }

    const wanted = Math.min(args.limit ?? MAX_IMAGES, MAX_IMAGES);
    const candidates = ad.creatives
      .map((c) => ({ url: c.imageResizedUrl ?? c.imageUrl, creative: c }))
      .filter((c) => Boolean(c.url))
      .slice(0, wanted);

    const images: { data: string; mimeType: string }[] = [];
    const shown: unknown[] = [];
    let skipped = 0;

    for (const candidate of candidates) {
      let image;
      try {
        image = await fetchImage(candidate.url as string);
      } catch {
        image = undefined;
      }
      if (!image) {
        // Meta's CDN links expire. A missing one is worth reporting rather than
        // quietly returning fewer images than the caller asked for.
        skipped += 1;
        continue;
      }
      images.push({ data: image.data, mimeType: image.mimeType });
      shown.push({
        title: candidate.creative.title,
        body: candidate.creative.body,
        cta: candidate.creative.ctaText,
        link: candidate.creative.linkUrl,
        kb: Math.round(image.bytes / 1024),
      });
    }

    const videos = ad.creatives.filter((c) => c.videoHdUrl || c.videoSdUrl).length;

    return okWithImages(
      {
        library_id: ad.libraryId,
        advertiser: ad.pageName,
        format: ad.displayFormat,
        days_active: ad.daysActive,
        body: ad.body,
        images_returned: images.length,
        video_creatives: videos,
        skipped_unavailable: skipped || undefined,
        creatives: shown,
        note:
          images.length === 0 && videos > 0
            ? "This ad is video only, so there is no still image to show. The video URLs are on get_ad."
            : skipped > 0
              ? "Some creative URLs did not resolve. Meta's CDN links expire, so re-run search_ads for fresh ones."
              : undefined,
      },
      images,
    );
  },
});

export const VIEW_TOOLS: AnyToolSpec[] = [viewAdCreative] as AnyToolSpec[];
