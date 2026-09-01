/** What this server is configured to do right now. */

import { backendStatusOutput } from "../adlibrary/schemas.js";
import { defineTool, type AnyToolSpec } from "./kit.js";

const backendStatus = defineTool({
  name: "backend_status",
  title: "Backend status",
  description:
    "Which backend is serving requests, whether it costs money per call, and which optional " +
    "features are available in this configuration. Call this when a tool reports something " +
    "unavailable, before telling the user it cannot be done.",
  schema: {},
  touchesNetwork: false,
  outputSchema: backendStatusOutput,
  handler: async (_args, ctx) => ({
    backend: ctx.backend.name,
    needs_api_key: ctx.backend.needsKey,
    costs_money_per_request: ctx.backend.needsKey,
    transcription_available: typeof ctx.backend.transcribe === "function",
    eu_transparency_available: Boolean(ctx.config.archiveToken),
    tracked_advertisers: await ctx.store.trackedPages(),
    note:
      "The browser backend is free and drives Chromium locally, so it cannot run in a " +
      "serverless function. Provider backends bill per ad returned and run anywhere.",
  }),
});

export const SESSION_TOOLS: AnyToolSpec[] = [backendStatus] as AnyToolSpec[];
