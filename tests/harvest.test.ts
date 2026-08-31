/**
 * The harvester, against a real Meta payload.
 *
 * The fixture is a genuine GraphQL response trimmed to three ads, one per
 * creative shape Meta serves: cards (DPA/DCO/carousel), a bare video, and a
 * bare image. Those three paths are where every other Ad Library scraper loses
 * data, so they are what the tests pin.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { adId, findAdNodes, findConnections, inlinePayloads, parsePayloads } from "../src/adlibrary/harvest.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/graphql_search.json", import.meta.url)), "utf8"),
);

describe("parsePayloads", () => {
  it("finds every ad in a real Meta response", () => {
    const harvest = parsePayloads(fixture);
    expect(harvest.nodes).toHaveLength(3);
    expect(harvest.cursor).toBe("FIXTURECURSOR");
    expect(harvest.hasMore).toBe(true);
    expect(harvest.total).toBe(14912);
    expect(harvest.captcha).toBe(false);
  });

  it("parses raw body strings as well as parsed objects", () => {
    const raw = JSON.stringify(fixture);
    expect(parsePayloads(raw).nodes).toHaveLength(3);
    expect(parsePayloads([raw]).nodes).toHaveLength(3);
    expect(parsePayloads(fixture).nodes).toHaveLength(3);
  });

  it("treats an array of strings as raw bodies, not as a parsed payload", () => {
    // The bug this pins: an array of JSON strings silently yielded zero ads
    // because it was mistaken for an already-parsed list.
    const bodies = [JSON.stringify({ x: { ad_archive_id: "1", page_name: "A", snapshot: {} } })];
    expect(parsePayloads(bodies).nodes).toHaveLength(1);
  });

  it("handles newline-delimited streamed responses and skips fragments", () => {
    const body = [
      JSON.stringify({ a: { ad_archive_id: "1", page_name: "A", snapshot: {} } }),
      '{"broken": ',
      JSON.stringify({ b: { ad_archive_id: "2", page_name: "B", snapshot: {} } }),
    ].join("\n");
    expect(parsePayloads(body).nodes).toHaveLength(2);
  });

  it("deduplicates ads that appear in more than one response", () => {
    const one = JSON.stringify({ a: { ad_archive_id: "1", page_name: "A", snapshot: {} } });
    expect(parsePayloads([one, one]).nodes).toHaveLength(1);
  });

  it("reports a captcha rather than an empty result", () => {
    const harvest = parsePayloads({ xfb_ad_library_is_captcha_required: true });
    expect(harvest.captcha).toBe(true);
  });

  it("returns nothing rather than throwing on junk", () => {
    expect(parsePayloads("not json").nodes).toEqual([]);
    expect(parsePayloads("").nodes).toEqual([]);
    expect(parsePayloads({}).nodes).toEqual([]);
  });
});

describe("findAdNodes", () => {
  it("ignores a bare id reference with no snapshot or page", () => {
    expect(findAdNodes({ ref: { ad_archive_id: "123" } })).toEqual([]);
  });

  it("accepts the alternative id spellings providers use", () => {
    expect(adId({ adArchiveId: "9" })).toBe("9");
    expect(adId({ adArchiveID: "9" })).toBe("9");
    expect(adId({ nothing: true })).toBeUndefined();
  });
});

describe("findConnections", () => {
  it("locates the connection by shape rather than by path", () => {
    // Meta has moved this path before. Nesting it somewhere new must still work.
    const moved = { some: { new: { place: { edges: [], page_info: { end_cursor: "x" } } } } };
    expect(findConnections(moved)).toHaveLength(1);
  });
});

describe("inlinePayloads", () => {
  it("returns only the script blocks that mention an ad", () => {
    const html =
      '<script type="application/json">{"ad_archive_id":"1"}</script>' +
      '<script type="application/json">{"unrelated":true}</script>' +
      '<script type="text/javascript">{"ad_archive_id":"2"}</script>';
    const found = inlinePayloads(html);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("ad_archive_id");
  });
});
