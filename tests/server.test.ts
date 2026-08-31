/**
 * The server surface, without touching the network.
 *
 * A fake backend stands in for the real ones, so these assert the contract the
 * tools depend on rather than Meta's availability.
 */

import { describe, expect, it } from "vitest";
import { buildUrl } from "../src/adlibrary/url.js";
import { ALL_TOOLS } from "../src/tools/index.js";
import { loadConfig } from "../src/config.js";
import { createBackend } from "../src/backends/index.js";
import { AdLibraryError } from "../src/errors.js";

describe("tool surface", () => {
  it("registers a stable set of uniquely named tools", () => {
    const names = ALL_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("search_ads");
    expect(names).toContain("diff_advertiser");
  });

  it("gives every tool a title and a description that says something", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.title, tool.name).toBeTruthy();
      // A one-line description is the interface a model reads. Anything this
      // short is a placeholder that slipped through.
      expect(tool.description.length, tool.name).toBeGreaterThan(80);
    }
  });
});

describe("buildUrl", () => {
  it("builds a keyword search", () => {
    const url = new URL(buildUrl({ query: "cold plunge", country: "GB" }));
    expect(url.searchParams.get("q")).toBe("cold plunge");
    expect(url.searchParams.get("country")).toBe("GB");
    expect(url.searchParams.get("search_type")).toBe("keyword_unordered");
  });

  it("switches to a page view when given a page id", () => {
    const url = new URL(buildUrl({ pageId: "123" }));
    expect(url.searchParams.get("view_all_page_id")).toBe("123");
    expect(url.searchParams.get("search_type")).toBe("page");
  });

  it("defaults to active ads in the US", () => {
    const url = new URL(buildUrl({ query: "x" }));
    expect(url.searchParams.get("active_status")).toBe("active");
    expect(url.searchParams.get("country")).toBe("US");
  });
});

describe("backend selection", () => {
  it("defaults to the free browser backend with no configuration", () => {
    const backend = createBackend(loadConfig());
    expect(backend.name).toBe("browser");
    expect(backend.needsKey).toBe(false);
  });

  it("refuses a provider backend without its key, and names the variable", () => {
    expect(() => createBackend({ ...loadConfig(), backend: "scrapecreators", scrapeCreatorsKey: undefined }))
      .toThrow(AdLibraryError);
    try {
      createBackend({ ...loadConfig(), backend: "apify", apifyToken: undefined });
    } catch (error) {
      expect((error as AdLibraryError).hint).toContain("APIFY_TOKEN");
    }
  });
});

describe("AdLibraryError", () => {
  it("serialises the hint, so a model is told how to fix it", () => {
    const error = new AdLibraryError("broke", { hint: "set X", backend: "browser" });
    expect(error.toJSON()).toEqual({ error: "broke", hint: "set X", backend: "browser" });
  });
});
