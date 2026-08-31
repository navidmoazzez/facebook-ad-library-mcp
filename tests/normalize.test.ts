/**
 * Normalising Meta's payload into one Ad.
 *
 * The assertions here are the difference between this server and a markdown
 * scraper: every carousel creative kept, the platform list intact, the real
 * destination URL rather than a redirect.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parsePayloads } from "../src/adlibrary/harvest.js";
import { adFromApify, adFromGraphql, domainOf, isoDate, text, unwrapRedirect } from "../src/adlibrary/normalize.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/graphql_search.json", import.meta.url)), "utf8"),
);
const nodes = parsePayloads(fixture).nodes;
const ads = nodes.map((node) => adFromGraphql(node));

const byFormat = (format: string) => {
  const found = ads.find((ad) => ad.displayFormat === format);
  if (!found) throw new Error(`fixture has no ${format} ad`);
  return found;
};

describe("adFromGraphql", () => {
  it("fills the fields a markdown scraper loses", () => {
    for (const ad of ads) {
      expect(ad.libraryId).toMatch(/^\d+$/);
      expect(ad.pageName).toBeTruthy();
      expect(ad.platforms.length).toBeGreaterThan(0);
      expect(ad.adDetailsUrl).toContain(ad.libraryId);
    }
  });

  it("keeps every creative in a carousel, not just the first", () => {
    const dpa = byFormat("DPA");
    expect(dpa.creatives.length).toBe(6);
  });

  it("reads a bare video and a bare image, which live in different keys", () => {
    expect(byFormat("VIDEO").creatives[0]?.kind).toBe("video");
    expect(byFormat("IMAGE").creatives[0]?.kind).toBe("image");
  });

  it("titlecases the platform list Meta sends in caps", () => {
    const platforms = ads.flatMap((ad) => ad.platforms);
    expect(platforms).toContain("Facebook");
    expect(platforms.every((p) => p === p[0] + p.slice(1))).toBe(true);
    expect(platforms.some((p) => p.includes("_"))).toBe(false);
  });

  it("turns unix timestamps into ISO dates", () => {
    for (const ad of ads) {
      if (ad.startedRunning) expect(ad.startedRunning).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("unwraps Meta's copy envelope rather than returning the JSON", () => {
    for (const ad of ads) {
      if (ad.body) expect(ad.body).not.toContain('{"text"');
    }
  });

  it("survives an empty node without throwing", () => {
    const ad = adFromGraphql({});
    expect(ad.libraryId).toBe("");
    expect(ad.creatives).toEqual([]);
    expect(ad.platforms).toEqual([]);
  });
});

describe("adFromApify", () => {
  it("reuses the Meta path when Apify passes the shape through", () => {
    const node = nodes[0]!;
    const ad = adFromApify(node);
    expect(ad.source).toBe("apify");
    expect(ad.libraryId).toBe(adFromGraphql(node).libraryId);
  });

  it("maps Apify's own flattened field names", () => {
    const ad = adFromApify({ adArchiveId: "7", pageName: "Flat", ctaText: "Shop now" });
    expect(ad.libraryId).toBe("7");
    expect(ad.pageName).toBe("Flat");
    expect(ad.ctaText).toBe("Shop now");
  });
});

describe("helpers", () => {
  it("unwraps an l.facebook.com redirect to the real destination", () => {
    const wrapped = "https://l.facebook.com/l.php?u=https%3A%2F%2Fshop.example.com%2Fa%3Fb%3D1";
    expect(unwrapRedirect(wrapped)).toBe("https://shop.example.com/a?b=1");
  });

  it("leaves a direct URL alone", () => {
    expect(unwrapRedirect("https://example.com/x")).toBe("https://example.com/x");
    expect(unwrapRedirect(undefined)).toBeUndefined();
  });

  it("strips www from a domain and tolerates junk", () => {
    expect(domainOf("https://www.example.com/a")).toBe("example.com");
    expect(domainOf("not a url")).toBeUndefined();
  });

  it("unwraps text envelopes and passes bare strings through", () => {
    expect(text({ text: "hello" })).toBe("hello");
    expect(text("hello")).toBe("hello");
    expect(text({})).toBeUndefined();
    expect(text(null)).toBeUndefined();
  });

  it("converts timestamps and rejects nonsense", () => {
    expect(isoDate(1727766000)).toBe("2024-10-01");
    expect(isoDate(0)).toBeUndefined();
    expect(isoDate(null)).toBeUndefined();
  });
});
