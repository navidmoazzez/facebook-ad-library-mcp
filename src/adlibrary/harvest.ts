/**
 * Finding ad cards in a payload without hardcoding where they live.
 *
 * Three sources hand us JSON: Meta's own GraphQL, ScrapeCreators (which proxies
 * Meta's payload but does not document its envelope) and Apify (which flattens
 * it). Meta has also moved its connection path more than once.
 *
 * So nothing here hardcodes a path. We walk for the *shape*: a node carrying
 * both `edges` and `page_info` is a connection, and one carrying `ad_archive_id`
 * is an ad. That survives all three sources and Meta's next reshuffle.
 */

/** Keys any recognisable ad card carries, in the order we prefer them. */
const AD_ID_KEYS = ["ad_archive_id", "adArchiveId", "adArchiveID"] as const;

/**
 * Meta inlines the first page of results into the document inside a JSON script
 * tag and fires no GraphQL call for it; only later pages arrive over the wire.
 * Reading both sources is what makes the first search reliable rather than
 * dependent on a scroll landing in time.
 */
const INLINE_JSON = /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g;

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every object in a payload, at any depth. Iterative so deep trees cannot blow the stack. */
function* walk(root: unknown): Generator<Json> {
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (isObject(current)) {
      yield current;
      for (const value of Object.values(current)) stack.push(value);
    } else if (Array.isArray(current)) {
      for (const value of current) stack.push(value);
    }
  }
}

export function adId(node: Json): string | undefined {
  for (const key of AD_ID_KEYS) {
    const value = node[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return undefined;
}

/** Any object holding both `edges` and `page_info`, at any depth. */
export function findConnections(payload: unknown): Json[] {
  const found: Json[] = [];
  for (const node of walk(payload)) {
    if ("edges" in node && "page_info" in node) found.push(node);
  }
  return found;
}

/**
 * Every object that looks like an ad card, deduplicated by id.
 *
 * A card must also carry a snapshot or a page, which guards against matching a
 * bare `{ad_archive_id: "..."}` reference elsewhere in the payload.
 */
export function findAdNodes(payload: unknown): Json[] {
  const out: Json[] = [];
  const seen = new Set<string>();
  for (const node of walk(payload)) {
    const id = adId(node);
    if (!id || seen.has(id)) continue;
    if (!("snapshot" in node) && !("page_id" in node) && !("page_name" in node)) continue;
    seen.add(id);
    out.push(node);
  }
  return out;
}

/** The JSON script blocks in an Ad Library document that actually mention an ad. */
export function inlinePayloads(html: string): string[] {
  const out: string[] = [];
  for (const match of html.matchAll(INLINE_JSON)) {
    const body = match[1];
    if (body && AD_ID_KEYS.some((key) => body.includes(key))) out.push(body);
  }
  return out;
}

export type Harvest = {
  nodes: Json[];
  cursor?: string;
  hasMore: boolean;
  /** Meta's own result count for the search. */
  total?: number;
  /** Meta is challenging us rather than answering. */
  captcha: boolean;
};

/**
 * Parse raw response bodies, or a payload a provider already parsed for us.
 *
 * A string, or an array of strings, is raw and gets decoded. Anything else is
 * treated as already parsed. Conflating the two silently yields zero ads,
 * because the strings never get decoded.
 */
function* documents(input: unknown): Generator<unknown> {
  if (typeof input === "string") {
    yield* decodeLines(input);
    return;
  }
  if (Array.isArray(input) && input.every((item) => typeof item === "string")) {
    for (const body of input as string[]) yield* decodeLines(body);
    return;
  }
  yield input;
}

/**
 * Meta streams some GraphQL responses as newline-delimited JSON objects, so
 * parse per line and skip fragments rather than assuming one object per body.
 */
function* decodeLines(body: string): Generator<unknown> {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      yield JSON.parse(trimmed);
    } catch {
      // A partial chunk. The next body usually carries the whole object.
    }
  }
}

export function parsePayloads(input: unknown): Harvest {
  const out: Harvest = { nodes: [], hasMore: false, captcha: false };
  const seen = new Set<string>();

  for (const doc of documents(input)) {
    for (const conn of findConnections(doc)) {
      const info = conn["page_info"];
      if (isObject(info)) {
        if (typeof info["end_cursor"] === "string") out.cursor = info["end_cursor"];
        if (info["has_next_page"] === true) out.hasMore = true;
      }
    }

    for (const node of walk(doc)) {
      if (out.total === undefined && typeof node["count"] === "number" && "edges" in node) {
        out.total = node["count"];
      }
      if (node["xfb_ad_library_is_captcha_required"] === true) out.captcha = true;
    }

    for (const node of findAdNodes(doc)) {
      const id = adId(node);
      if (id && !seen.has(id)) {
        seen.add(id);
        out.nodes.push(node);
      }
    }
  }

  return out;
}
