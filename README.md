<img src="https://cdn.navid.media/connectors/facebook-ad-library-icon.png" alt="Facebook Ad Library" width="88">

# Facebook Ad Library MCP

[![Stars](https://img.shields.io/github/stars/navidmoazzez/facebook-ad-library-mcp?style=flat&logo=github&label=Stars)](https://github.com/navidmoazzez/facebook-ad-library-mcp)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)
[![npm](https://img.shields.io/npm/v/@thenavidm/facebook-ad-library-mcp?color=orange&label=npm)](https://www.npmjs.com/package/@thenavidm/facebook-ad-library-mcp)
[![Downloads](https://img.shields.io/npm/dm/@thenavidm/facebook-ad-library-mcp?color=green&label=downloads)](https://www.npmjs.com/package/@thenavidm/facebook-ad-library-mcp)
[![CI](https://img.shields.io/github/actions/workflow/status/navidmoazzez/facebook-ad-library-mcp/ci.yml?branch=main&label=CI)](https://github.com/navidmoazzez/facebook-ad-library-mcp/actions)
[![YouTube](https://img.shields.io/badge/YouTube-@thenavidm-red?logo=youtube&logoColor=white)](https://youtube.com/@thenavidm?sub_confirmation=1)
[![X](https://img.shields.io/badge/X-@thenavidm-black?logo=x)](https://x.com/thenavidm)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-thenavidm-0A66C2?logo=linkedin&logoColor=white)](https://linkedin.com/in/thenavidm)

Give any AI agent read access to every ad running on Facebook, Instagram, Messenger, Threads and Audience Network. Free, no API key, any country.

Meta's Ad Library is the largest public archive of advertising creative in the world, and it is completely open. This puts it inside your agent.

> **You:** What is Ridge testing right now?
>
> **Claude:** They have 34 ads live. The oldest has run 214 days: a single static
> image, "The last wallet you will buy", straight to a product page. The eleven
> newest are all video with a founder talking to camera, and every one of them
> points at a quiz funnel instead. They are moving from product-led to
> problem-led, and the old ad is still running because it still works.

Built by [Navid Moazzez](https://navid.me?utm_source=github&utm_medium=readme&utm_campaign=facebook-ad-library-mcp).

<img src="https://cdn.navid.media/repos/facebook-ad-library-mcp.gif?v=1" alt="Claude Code using the Facebook Ad Library MCP server" width="520">

## Contents

| | Section | |
|---|---|---|
| 1 | [What you can ask it](#1-what-you-can-ask-it-) | Real prompts, not features |
| 2 | [Quick install](#2-quick-install-) | One command, no account |
| 3 | [Setup](#3-setup-) | Optional, and why you probably do not need it |
| 4 | [Connect your client](#4-connect-your-client-) | Every client, copy and paste |
| 5 | [Check it worked](#5-check-it-worked-) | `doctor`, and what actually fails |
| 6 | [Tools](#6-tools-%EF%B8%8F) | All eight, and what each reaches |
| 7 | [How it works](#7-how-it-works-%EF%B8%8F) | Why it returns more than a scraper |
| 8 | [Limits, honestly](#8-limits-honestly-) | What no source can tell you |
| | [FAQ](#faq-) | |

## 1. What you can ask it 💬

- "What ads is Ridge running right now, and which has been live longest?"
- "Show me every hook Athletic Greens is testing this month, grouped by angle."
- "Compare two competitors: who runs more creative, and who refreshes it faster?"
- "Find advertisers running cold plunge ads in the UK, ranked by ad count."
- "Pull every ad from this Page and tell me which landing pages they send to."
- "What changed for this advertiser since last week?"
- "Which of these are video and which are static? Give me the video URLs."
- "This ad has run 8 months. Read the copy and tell me why it works."
- "What is this German brand spending, and who is paying for it?"

## 2. Quick install ⚡

Node 20 or newer. Nothing else.

```bash
npx -y @thenavidm/facebook-ad-library-mcp --version
```

The free backend drives a real browser, so install Chromium once:

```bash
npx playwright install chromium
```

That is the whole install. No account, no API key, no credential.

## 3. Setup 🔑

**There is nothing to set up.** The default backend needs no key and no account.

Everything below is optional, and only worth doing if you hit a specific limit.

### Optional: a provider key, for speed and scale

The free backend runs Chromium on your machine, so a search takes 30 to 60 seconds and Meta will rate limit you if you hammer it. Two hosted providers remove both problems for money.

| Backend | Roughly | Adds |
|---|---|---|
| `scrapecreators` | $1.88 per 1,000 ads | fast, serverless, `transcribe_ad` |
| `apify` | $3.40 to $5.80 per 1,000 ads | fast, serverless, e-commerce enrichment |

Set `FBADS_BACKEND` and the matching key in your client config. Every tool behaves identically on all three.

### Optional: EU spend and reach

Meta's official Ad Library API publishes real spend, impressions and demographics. It is free, and it covers political and issue ads worldwide plus every ad delivered in the EU.

1. Go to [developers.facebook.com](https://developers.facebook.com) and create an app.
2. Generate an access token for it.
3. Set it as `META_ADS_ARCHIVE_TOKEN`.

`get_eu_transparency` then returns data. Everything else works without it.

## 4. Connect your client 🔌

The long version, every step with what to do when one fails, is in [INSTALL.md](INSTALL.md).

### Claude Code

```bash
claude mcp add facebook-ads -- npx -y @thenavidm/facebook-ad-library-mcp@latest
```

`--scope user` makes it available in every project rather than the current one.

With a provider key:

```bash
claude mcp add facebook-ads \
  -e FBADS_BACKEND=scrapecreators \
  -e SCRAPECREATORS_API_KEY=xxx \
  -- npx -y @thenavidm/facebook-ad-library-mcp@latest
```

### Claude Desktop

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "facebook-ads": {
      "command": "npx",
      "args": ["-y", "@thenavidm/facebook-ad-library-mcp@latest"]
    }
  }
}
```

> **Tip**
> Claude Desktop does not inherit your shell PATH. If `npx` is not found, use
> the absolute path from `which npx`.

Quit Claude Desktop completely and reopen it.

### claude.ai on the web

claude.ai runs connectors from Anthropic's cloud, not from your machine, so it needs a public HTTPS URL.

```bash
npx -y @thenavidm/facebook-ad-library-mcp@latest --http --port 8000
```

Host that somewhere with a public HTTPS URL, then in claude.ai: **Customize**, **Connectors**, **+**, **Add custom connector**. Paste the URL and click **Add**.

Note the free backend needs a real browser, so whatever hosts it must be able to run Chromium. A provider backend is the easier choice for a hosted deployment.

### Cursor

`.cursor/mcp.json`, same JSON shape as Claude Desktop, key `mcpServers`.

### Windsurf

`~/.codeium/windsurf/mcp_config.json`, key `mcpServers`.

### VS Code

`.vscode/mcp.json`. The key is **`servers`**, not `mcpServers`, and each entry takes `"type": "stdio"`.

```json
{
  "servers": {
    "facebook-ads": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@thenavidm/facebook-ad-library-mcp@latest"]
    }
  }
}
```

### Codex CLI

`~/.codex/config.toml`:

```toml
[mcp_servers.facebook-ads]
command = "npx"
args = ["-y", "@thenavidm/facebook-ad-library-mcp@latest"]
```

### Gemini CLI

`~/.gemini/settings.json`, key `mcpServers`.

### Everything else

Any stdio MCP client takes the same three things: the command `npx`, the args, and an optional env block.

## 5. Check it worked 🩺

```bash
npx -y @thenavidm/facebook-ad-library-mcp@latest doctor
```

It launches a browser, runs a real search, and tells you whether ads came back.

| Symptom | Fix |
|---|---|
| "Chromium will not launch" | `npx playwright install chromium` |
| "Meta served a captcha" | Wait a few minutes, or set a provider key |
| Empty results on every search | Meta is rate limiting this machine |
| Server missing from the client | `npx` not on the client's PATH, use an absolute path |

## 6. Tools 🛠️

Every tool is read-only. This server cannot post, cannot spend, and cannot reach an ad account.

| Tool | What it does |
|---|---|
| `search_ads` | Keyword search, or every ad from one Page. The main one. |
| `list_advertisers` | Resolve a brand name to Page IDs, ranked by ad count. |
| `get_ad` | One ad in full: every creative, every copy variant. |
| `diff_advertiser` | What an advertiser started and stopped running since last look. |
| `get_eu_transparency` | Spend, reach and demographics. EU and political ads only. |
| `transcribe_ad` | Speech to text on a video ad. Needs the `scrapecreators` backend. |
| `backend_status` | Which backend is active and whether it costs money. |
| `ad_library_url` | Turn filters into a URL a person can open and check. |

Plus two prompts, `competitor-teardown` and `creative-angles`, and two resources so a client can read the config and the Ad Library's own concepts without spending a tool call.

`diff_advertiser` is the one worth knowing about. Every other tool answers "what is running". That one answers "what changed", which needs a memory of last time. The first call records a baseline.

## 7. How it works ⚙️

Worth knowing, because it explains what you get back.

The Ad Library is a React app. Meta hands it every ad as structured JSON. The obvious way to scrape it is to let the page render, flatten it to text, and pull the fields back out with regular expressions.

That round trip loses most of the ad. You get one creative instead of the six in the carousel, a redirect instead of the real landing page, and an empty platform list because those render as icons rather than text.

**This server reads the JSON the page was already given.** Same browser, same cost, no parsing step.

It reads two places, because Meta uses two: the first page of results is embedded in the document, and later pages arrive over the wire as you scroll. Reading only the second is why scrapers return nothing on the first search.

What that buys you, per ad:

| | |
|---|---|
| Creatives | all of them, with HD and SD video URLs |
| Platforms | `Facebook, Instagram, Messenger, Threads, Audience Network` |
| Destination | the real URL, query string intact |
| Call to action | `SHOP_NOW`, from the payload rather than matched against a label list |
| Pagination | a real cursor, plus Meta's own total result count |
| Also | page likes, ad format, variant count, EU spend and reach |

## 8. Limits, honestly 🧭

**No performance data exists.** Conversions, revenue, cost per acquisition, return on ad spend: none of it is public for another advertiser, from any source, at any price.

What you can infer is longevity. An ad running six months is probably working, because advertisers turn off ads that lose money. That is a hypothesis worth acting on, and it is not a measurement. The server's own instructions tell the model not to report it as one.

**Spend and reach are usually null.** They exist only for ads delivered in the EU, under the Digital Services Act, and for political ads anywhere. A null on a US ecommerce ad is the correct answer, not a bug.

**The free backend gets rate limited.** It drives a real browser against a public site. If searches start coming back empty, wait. That is also the point where a provider key starts paying for itself.

**Creative URLs expire.** Meta's CDN links are short-lived. Download what you want to keep, when you find it.

## FAQ ❓

<details>
<summary><b>What is an MCP server?</b></summary>

An MCP server is a standard way to give an AI assistant real tools. Once this is connected, your assistant can search the Ad Library itself instead of you copying results into a chat.

</details>

<details>
<summary><b>Do I need a Facebook account?</b></summary>

You do not need one. The Ad Library is public and this reads it without signing in to anything.

</details>

<details>
<summary><b>Does it cost money?</b></summary>

It is free by default. The free backend runs on your machine. The two provider backends bill per ad and are opt-in.

</details>

<details>
<summary><b>Why is it slow?</b></summary>

The free backend launches a real browser and scrolls a page, which takes 30 to 60 seconds. A provider backend answers in about a second, for money.

</details>

<details>
<summary><b>Can I see how much a competitor spends?</b></summary>

Only for EU-delivered ads and political ads, through `get_eu_transparency`. For a US commercial advertiser that number is not published anywhere.

</details>

<details>
<summary><b>Can it tell me which of their ads performs best?</b></summary>

It does not. and nothing can. You can see which have run longest, which is a reasonable proxy and not the same thing.

</details>

<details>
<summary><b>Why does an ad body say `{{product.brand}}`?</b></summary>

It is a catalogue ad. Meta fills those tokens per product at delivery. That is the real ad text.

</details>

<details>
<summary><b>Can I run it on a server?</b></summary>

It does. with `--http`. The free backend needs Chromium available; a provider backend is easier to host.

</details>

<details>
<summary><b>Is scraping the Ad Library allowed?</b></summary>

The Ad Library is published deliberately, for transparency, and is open without login. This reads it the way a browser does. You are responsible for your own use.

</details>

<details>
<summary><b>Which countries work?</b></summary>

All of them. Pass any two-letter country code.

</details>

## Dependencies

| Package | License | Why |
|---|---|---|
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MIT | the MCP protocol implementation |
| [zod](https://github.com/colinhacks/zod) | MIT | tool argument schemas |
| [playwright](https://github.com/microsoft/playwright) | Apache-2.0 | drives Chromium for the free backend, optional |

## Questions

Run into a problem or have a question? [Open an issue](https://github.com/navidmoazzez/facebook-ad-library-mcp/issues) and I will help.

## About the author 👋

Navid Moazzez is a leading AI business strategist, and the host of the AI Creator Summit, watched by 100,000+ creators. He helps creators and founders master AI and build their own AI Operating System (AI OS) to automate their business and life. This MCP server is one piece of that system.

**Links**

- Personal website: [navid.me](https://navid.me?utm_source=github&utm_medium=readme&utm_campaign=facebook-ad-library-mcp)
- Navid Media: [navid.media](https://navid.media?utm_source=github&utm_medium=readme&utm_campaign=facebook-ad-library-mcp)
- YouTube: [@thenavidm](https://youtube.com/@thenavidm?sub_confirmation=1) and [@thenavidai](https://youtube.com/@thenavidai?sub_confirmation=1)
- X: [@thenavidm](https://x.com/thenavidm)
- Instagram: [@thenavidm](https://instagram.com/thenavidm)
- LinkedIn: [thenavidm](https://linkedin.com/in/thenavidm)

If this is useful, star the repo and come say hi on [X](https://x.com/thenavidm).

## License

[MIT](./LICENSE). Free to use, modify, and share.

Not affiliated with, endorsed by, or connected to Meta Platforms, Inc.

---

© 2026 [NM Media](https://navid.media?utm_source=github&utm_medium=readme&utm_campaign=facebook-ad-library-mcp). Made with ❤️ by [Navid Moazzez](https://navid.me?utm_source=github&utm_medium=readme&utm_campaign=facebook-ad-library-mcp).
