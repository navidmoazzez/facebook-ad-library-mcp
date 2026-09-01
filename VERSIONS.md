# Facebook Ad Library MCP Versions

| Component | Version | Last Updated |
|-----------|---------|--------------|
| facebook-ad-library-mcp | 0.3.0 | 2026-09-01 |

---

What changed, newest first, in terms of what it means for someone using it.

## 0.3.0

**Results now arrive as real objects.** Every tool declares an output schema and
returns `structuredContent`, so a client can render a table or a card instead of
printing a JSON string. This was promised in 0.1.0 and not delivered.

**Searches are about three times faster.** The browser backend waited on fixed
timers: nine seconds to hydrate, four per scroll, whether or not the page was
ready. It now waits for the markup carrying the results and for the response each
scroll triggers. A test search went from 36 seconds to 10.

**An empty search retries instead of giving up.** Meta rate limits by IP and
recovers within a minute. Returning nothing with a note telling a human to wait
was no help to an agent. `FBADS_RETRIES` controls it, default 1.

## 0.2.0

**Repeat searches on ScrapeCreators are now free.** Their API serves a cached
response for zero credits when you tell it how old an answer you will accept, and
we were not asking. A research session that searches the same advertiser thirty
times was being billed thirty times. Default is one day; `FBADS_CACHE_DAYS=0`
always pays for fresh.

**The Apify backend now runs a much cheaper actor by default.** Roughly $0.30 per
1,000 results against $3.40 to $5.80, and it takes the filters directly instead of
a prebuilt URL, so nothing is lost in translation. `APIFY_ACTOR=full` switches back
to the original, which is the only one with e-commerce enrichment.

Two failures now say something useful instead of dumping a status code: an Apify
plan that cannot run public Actors, and `get_ad` on an actor whose input has no
field for an ad id.

## 0.1.1

Fixes the ScrapeCreators backend, which was returning one unrelated ad instead
of the thousands that matched.

It sent `ad_type=ALL`. Their API accepts that and then silently collapses the
result set to a single row rather than erroring, so the failure looked like an
empty search. The parameter has to stay lowercase. Verified against the live API.

## 0.1.0

First release.

- Reads Meta's Ad Library from the structured JSON the page receives, rather than
  from rendered text. Every creative in a carousel, the real destination URL, the
  full platform list and a real pagination cursor.
- Three backends behind one set of tools: `browser` (free, no key, the default),
  `scrapecreators` and `apify`.
- Eight tools, all read-only, including `diff_advertiser` for what an advertiser
  started and stopped running since the last look.
- `get_eu_transparency` for real spend, reach and demographics on EU and political
  ads, through Meta's official API.
- stdio and streamable HTTP transports.
- Two prompts, `competitor-teardown` and `creative-angles`, and two resources.
- `doctor` runs a real search and reports what is actually broken.
