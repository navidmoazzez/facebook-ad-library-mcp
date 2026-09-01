/**
 * Shared plumbing every tool uses.
 *
 * Registering tools by hand is a chance per tool to forget an annotation, leak
 * a stack trace, or return a shape the model cannot read. This wraps that once
 * so a tool module only describes what it actually does.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, type ZodRawShape } from "zod";
import type { Backend } from "../adlibrary/types.js";
import type { Config } from "../config.js";
import { AdLibraryError } from "../errors.js";
import type { SnapshotStore } from "../store/snapshots.js";

export type ToolContext = {
  backend: Backend;
  config: Config;
  store: SnapshotStore;
};

export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/**
 * Both shapes, every time.
 *
 * `structuredContent` is what a client renders as a table or a card, and it is
 * only sent when the tool declares an `outputSchema`. `content` stays populated
 * because a client that ignores structured output would otherwise show nothing
 * at all, and because the model reads it directly.
 */
export function ok(data: unknown, structured = true): ToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const result: ToolResult = { content: [{ type: "text", text }] };
  if (structured && data && typeof data === "object" && !Array.isArray(data)) {
    result.structuredContent = data as Record<string, unknown>;
  }
  return result;
}

/**
 * Errors come back as a normal result with `isError`, not a thrown exception.
 *
 * A thrown MCP error reaches the model as a protocol failure with no structure.
 * A result it can read tells it what went wrong and usually how to fix it,
 * which is the difference between a correct retry and a give-up. Verified
 * against a real client handshake rather than assumed.
 */
export function fail(error: unknown): ToolResult {
  const payload =
    error instanceof AdLibraryError
      ? error.toJSON()
      : { error: (error as Error)?.message ?? String(error) };
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], isError: true };
}

/** Filters shared by every tool that searches. Described once, reused everywhere. */
export const searchArgs = {
  country: z
    .string()
    .length(2)
    .optional()
    .describe("Two-letter country the ads were delivered in, e.g. US, GB, DE. Default US."),
  active_status: z
    .enum(["active", "inactive", "all"])
    .optional()
    .describe("Only ads running now, only stopped ads, or both. Default active."),
  media_type: z
    .enum(["all", "image", "meme", "video", "none"])
    .optional()
    .describe("Filter by creative type. 'meme' is Meta's name for an image with text on it."),
  ad_type: z
    .enum([
      "all",
      "political_and_issue_ads",
      "employment_ads",
      "housing_ads",
      "financial_products_and_services_ads",
    ])
    .optional()
    .describe("Ad category. 'all' covers ordinary commercial ads and is what you usually want."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe("How many ads to return. On the browser backend a higher number costs more time."),
};

export type ToolSpec<S extends ZodRawShape, O extends ZodRawShape = ZodRawShape> = {
  name: string;
  /** One line, imperative. Shown in tool pickers. */
  title: string;
  description: string;
  schema: S;
  /** Declared so clients get `structuredContent` rather than a JSON string. */
  outputSchema?: O;
  /**
   * Every tool in this server reads a public archive. None of them writes, so
   * `readOnlyHint` is true throughout and there is no confirm gating to apply.
   * `openWorldHint` is false only where a tool touches no network at all.
   */
  touchesNetwork?: boolean;
  handler: (args: z.infer<z.ZodObject<S>>, ctx: ToolContext) => Promise<unknown>;
};

export function defineTool<S extends ZodRawShape, O extends ZodRawShape = ZodRawShape>(
  spec: ToolSpec<S, O>,
): ToolSpec<S, O> {
  return spec;
}

/**
 * A tool of any shape, for the one place tools are collected into a list.
 *
 * `ToolSpec` is generic over its schema, so a list of tools with different
 * schemas has no single type: each handler takes a different argument shape and
 * function parameters are contravariant. The safety that matters lives inside
 * each `defineTool` call, where schema and handler are checked against each
 * other. This only loosens the seam where they are collected.
 */
export type AnyToolSpec = Omit<ToolSpec<ZodRawShape, ZodRawShape>, "handler"> & {
  handler: (args: never, ctx: ToolContext) => Promise<unknown>;
};

export function register(
  server: McpServer,
  contextFor: () => ToolContext,
  spec: AnyToolSpec,
): void {
  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.schema,
      ...(spec.outputSchema ? { outputSchema: spec.outputSchema } : {}),
      annotations: {
        title: spec.title,
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: spec.touchesNetwork !== false,
      },
    },
    // The SDK derives its callback type from the schema generic. This wrapper is
    // generic over the same shape, but TypeScript cannot prove the two equal
    // through the indirection, so the cast lives at this single boundary rather
    // than in every tool definition.
    (async (args: Record<string, unknown>) => {
      try {
        return ok(await spec.handler(args as never, contextFor()), Boolean(spec.outputSchema));
      } catch (error) {
        return fail(error);
      }
    }) as never,
  );
}
