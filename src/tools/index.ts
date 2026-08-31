/**
 * Every tool, grouped by what it reaches rather than by which endpoint it calls.
 */

import type { AnyToolSpec } from "./kit.js";
import { SEARCH_TOOLS } from "./search.js";
import { SESSION_TOOLS } from "./session.js";
import { TRACK_TOOLS } from "./track.js";
import { TRANSPARENCY_TOOLS } from "./transparency.js";

export const ALL_TOOLS: AnyToolSpec[] = [
  ...SEARCH_TOOLS,
  ...TRACK_TOOLS,
  ...TRANSPARENCY_TOOLS,
  ...SESSION_TOOLS,
];
