/** Picking a backend, failing with a message that names the fix. */

import { AdLibraryError } from "../errors.js";
import type { Backend } from "../adlibrary/types.js";
import type { Config } from "../config.js";
import { ApifyBackend } from "./apify.js";
import { BrowserBackend } from "./browser.js";
import { ScrapeCreatorsBackend } from "./scrapecreators.js";

export function createBackend(config: Config): Backend {
  switch (config.backend) {
    case "browser":
      return new BrowserBackend({
        headless: config.headless,
        hydrateMs: config.hydrateMs,
        scrollWaitMs: config.scrollWaitMs,
        retries: config.retries,
      });
    case "scrapecreators":
      return new ScrapeCreatorsBackend(config.scrapeCreatorsKey ?? "", undefined, config.cacheDays);
    case "apify":
      return new ApifyBackend(config.apifyToken ?? "", { actor: config.apifyActor });
    default:
      throw new AdLibraryError(`Unknown backend ${String(config.backend)}.`, {
        hint: "FBADS_BACKEND must be browser, scrapecreators or apify.",
      });
  }
}

export { ApifyBackend, BrowserBackend, ScrapeCreatorsBackend };
