# Working on this repo

For agents editing this repo. Users read `README.md`; models driving the server read `SKILL.md`.

## What this is

An MCP server that reads Meta's public Ad Library. TypeScript, Node 20+, ESM, published as `@thenavidm/facebook-ad-library-mcp`.

Every tool is read-only. There is no write path, so there is no confirm gating and no audit log, unlike the other servers in this family. Do not add one "for consistency": the safety model here is that the server cannot act at all.

## The one idea the whole repo rests on

The Ad Library is a React app that receives ads from Meta as structured JSON. Most scrapers render that JSON to a DOM, flatten it to markdown, and regex the fields back out, which loses most of each ad.

**We read the JSON.** `src/backends/browser.ts` attaches a response listener and keeps the payload the page was already given.

Meta serves it from **two** places, and both are needed:

1. The first page is inlined in the document inside a `<script type="application/json">` block, with no network call at all.
2. Later pages arrive as GraphQL responses triggered by scrolling.

Reading only the second is why the first search intermittently returned nothing. If ads stop coming back, check that both sources are still being read before assuming a rate limit.

## Where things are

| Path | Holds |
|---|---|
| `src/adlibrary/harvest.ts` | finding ad cards in any payload, by shape not by path |
| `src/adlibrary/normalize.ts` | every source's payload into one `Ad` |
| `src/adlibrary/url.ts` | the Ad Library URL builder, shared by browser and Apify |
| `src/backends/` | the three backends behind one interface |
| `src/format/ads.ts` | shaping ads for a model: compact in lists, complete in detail |
| `src/store/snapshots.ts` | JSON snapshots, only for `diff_advertiser` |
| `src/tools/` | one module per group, `kit.ts` is the registration plumbing |

## Rules specific to this repo

**Never hardcode a path into Meta's payload.** `harvest.ts` walks for shape: an object with `edges` and `page_info` is a connection, one with `ad_archive_id` is an ad. Meta has moved that path before and will again. A test pins this.

**Creatives live in three disjoint keys.** `images` for IMAGE ads, `videos` for VIDEO, `cards` for DCO, DPA and CAROUSEL. Reading only one is the most common bug in this domain. Tests cover all three.

**Never invent spend or reach.** Those fields are null outside the EU and outside political ads, and that is the correct answer. Do not add an estimator, do not infer a range from `days_active`.

**Longevity is a hypothesis, never a measurement.** The instructions, the SKILL.md and the prompts all say this. Keep it that way in anything new.

**Pin nothing from memory.** The Graph API version, the SDK version, the action versions and the provider endpoints were each verified by a live probe. Re-probe rather than recall:

```bash
npm view @modelcontextprotocol/sdk version
curl -s "https://graph.facebook.com/v26.0/ads_archive?ad_reached_countries=%5B%22DE%22%5D"
curl -sL https://api.github.com/repos/actions/checkout/releases/latest | grep tag_name
```

A valid Graph version answers with error code 1; an unsupported one answers 100.

## Testing

```bash
npm test          # vitest, fixtures only, no network
npm run typecheck
npm run build
```

Tests never touch the network. The fixture in `tests/fixtures/` is a real trimmed Meta response covering all three creative shapes.

Unit tests are not enough for a change to the browser backend. Run a real client handshake against a live search before claiming it works.

## Writing

No em dashes. Short paragraphs. Comments explain why, not what. Never name another repo or maintainer as a comparison.
