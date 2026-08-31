# Facebook Ad Library MCP Versions

| Component | Version | Last Updated |
|-----------|---------|--------------|
| facebook-ad-library-mcp | 0.1.0 | 2026-08-31 |

---

What changed, newest first, in terms of what it means for someone using it.

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
