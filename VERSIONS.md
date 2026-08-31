# Facebook Ad Library MCP Versions

| Component | Version | Last Updated |
|-----------|---------|--------------|
| facebook-ad-library-mcp | 0.1.1 | 2026-09-01 |

---

What changed, newest first, in terms of what it means for someone using it.

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
