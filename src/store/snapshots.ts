/**
 * Local snapshot store. The only reason it exists is `diff_advertiser`.
 *
 * Every other tool answers "what is running". That one answers "what changed",
 * which needs a memory of what was running last time.
 *
 * This is not a cache. Searches always hit the live archive; this only records
 * what came back, so a later call can compare.
 *
 * Deliberately a JSON file per advertiser rather than SQLite. `node:sqlite` is
 * not stable on Node 20, which is our floor, and a native dependency would
 * break the `npx` install story for the sake of a few hundred rows.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { Ad } from "../adlibrary/types.js";

export type StoredAd = Ad & { firstSeen: number; lastSeen: number };

/** Application Support on macOS, APPDATA on Windows, XDG on Linux. */
export function defaultStoreDir(): string {
  const env = process.env;
  if (env["FBADS_STORE_DIR"]) return env["FBADS_STORE_DIR"];
  if (platform() === "win32") {
    return join(env["APPDATA"] ?? homedir(), "facebook-ad-library-mcp");
  }
  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", "facebook-ad-library-mcp");
  }
  return join(env["XDG_DATA_HOME"] ?? join(homedir(), ".local", "share"), "facebook-ad-library-mcp");
}

/** Page IDs come from Meta and are digits, but this is a filename, so be strict. */
function safeName(pageId: string): string {
  return pageId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
}

export class SnapshotStore {
  constructor(private readonly dir: string = defaultStoreDir()) {}

  private fileFor(pageId: string): string {
    return join(this.dir, `${safeName(pageId)}.json`);
  }

  async snapshot(pageId: string): Promise<Map<string, StoredAd>> {
    try {
      const raw = await readFile(this.fileFor(pageId), "utf8");
      const parsed = JSON.parse(raw) as StoredAd[];
      return new Map(parsed.map((ad) => [ad.libraryId, ad]));
    } catch {
      // No file yet, or an unreadable one. Either way there is no baseline.
      return new Map();
    }
  }

  /** Upsert. `firstSeen` is preserved so an ad's real age survives re-reads. */
  async record(pageId: string, ads: Ad[]): Promise<number> {
    if (!pageId || ads.length === 0) return 0;
    const now = Date.now();
    const existing = await this.snapshot(pageId);

    for (const ad of ads) {
      if (!ad.libraryId) continue;
      const prior = existing.get(ad.libraryId);
      existing.set(ad.libraryId, {
        ...ad,
        firstSeen: prior?.firstSeen ?? now,
        lastSeen: now,
      });
    }

    await mkdir(this.dir, { recursive: true });
    await writeFile(this.fileFor(pageId), JSON.stringify([...existing.values()], null, 1), "utf8");
    return ads.length;
  }

  async trackedPages(): Promise<number> {
    try {
      const files = await readdir(this.dir);
      return files.filter((name) => name.endsWith(".json")).length;
    } catch {
      return 0;
    }
  }
}
