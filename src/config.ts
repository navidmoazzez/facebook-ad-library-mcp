/**
 * Settings, all from the environment.
 *
 * Environment variables rather than CLI flags: a user editing a client config is
 * already inside a JSON `env` block, and flags mean editing `args` separately.
 */

import type { BackendName } from "./adlibrary/types.js";

export type Config = {
  backend: BackendName;
  headless: boolean;
  scrapeCreatorsKey?: string;
  apifyToken?: string;
  /** Which Apify actor to run. "lite" is far cheaper; "full" adds enrichment. */
  apifyActor?: "lite" | "full";
  /** Days a cached provider response stays acceptable. 0 always pays for fresh. */
  cacheDays: number;
  archiveToken?: string;
  storeDir?: string;
  hydrateMs: number;
  scrollWaitMs: number;
  retries: number;
};

/** Like intFromEnv but accepts 0, for settings where zero is a real choice. */
function intOrZeroFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function backendFromEnv(): BackendName {
  const raw = (process.env["FBADS_BACKEND"] ?? "browser").toLowerCase();
  if (raw === "scrapecreators" || raw === "apify" || raw === "browser") return raw;
  return "browser";
}

export function loadConfig(): Config {
  return {
    backend: backendFromEnv(),
    // Headed is for watching why a search came back empty.
    headless: process.env["FBADS_HEADED"] !== "1",
    scrapeCreatorsKey: process.env["SCRAPECREATORS_API_KEY"] || undefined,
    apifyToken: process.env["APIFY_TOKEN"] || undefined,
    apifyActor: process.env["APIFY_ACTOR"] === "full" ? "full" : "lite",
    cacheDays: intOrZeroFromEnv("FBADS_CACHE_DAYS", 1),
    archiveToken: process.env["META_ADS_ARCHIVE_TOKEN"] || undefined,
    storeDir: process.env["FBADS_STORE_DIR"] || undefined,
    hydrateMs: intFromEnv("FBADS_HYDRATE_MS", 9000),
    scrollWaitMs: intFromEnv("FBADS_SCROLL_WAIT_MS", 4000),
    retries: intOrZeroFromEnv("FBADS_RETRIES", 1),
  };
}
