# Setup, in full

The short version: there is nothing to set up. The default backend needs no key, no account and no credential.

This page covers the optional parts, and is only worth reading if you have hit a specific limit.

---

## Optional: a provider key

The free backend runs Chromium on your own machine. That makes it free, and it makes it slow (30 to 60 seconds a search) and rate limited (Meta will start refusing a machine that hammers it).

Two hosted providers remove both problems in exchange for money. Every tool behaves identically on all three backends, so switching is one environment variable.

### ScrapeCreators

Roughly $1.88 per 1,000 ads. The cheaper of the two, a plain REST call, and the only backend that can transcribe a video ad.

1. Go to [scrapecreators.com](https://scrapecreators.com) and sign up. There is a free tier to test with.
2. Copy the API key from the dashboard.
3. Set two variables in your client config:

```json
"env": {
  "FBADS_BACKEND": "scrapecreators",
  "SCRAPECREATORS_API_KEY": "your-key"
}
```

### Apify

Roughly $3.40 to $5.80 per 1,000 ads. More expensive, and it runs as an actor job rather than a request, so it has no pagination cursor: raise `limit` instead of paging. Worth it if you already have an Apify account, or want their e-commerce enrichment.

1. Sign in at [apify.com](https://apify.com).
2. **Settings**, then **API & Integrations**, then copy your personal API token.
3. Set:

```json
"env": {
  "FBADS_BACKEND": "apify",
  "APIFY_TOKEN": "your-token"
}
```

### Revoking

Both keys are revoked from the same dashboard page you created them on. Nothing here stores a key: it is read from the environment on each run.

---

## Optional: EU spend and reach

Meta publishes real spend, impressions and demographic breakdowns through its official Ad Library API. It is free.

**What it covers, and this is the whole catch:**

| Case | What you get |
|---|---|
| Political and issue ads, worldwide | spend and impression ranges |
| Any ad delivered in the EU | reach, under the Digital Services Act |
| An ordinary commercial ad outside the EU | nothing |

So this will not tell you what a US ecommerce brand spends. That number is not published anywhere, by anyone.

### Getting a token

1. Go to [developers.facebook.com](https://developers.facebook.com) and sign in.
2. **My Apps**, then **Create App**. Any type is fine; "Other" then "Business" works.
3. Open the app, then **Tools**, then **Graph API Explorer**.
4. Select your app in the dropdown and click **Generate Access Token**.
5. Copy it.

```json
"env": {
  "META_ADS_ARCHIVE_TOKEN": "your-token"
}
```

The token the Explorer hands you is short-lived. For something that keeps working, exchange it for a long-lived token or create a System User token in Business Settings.

`get_eu_transparency` then returns data. Every other tool works without it.

---

## Environment variables, complete

| Variable | Default | Does |
|---|---|---|
| `FBADS_BACKEND` | `browser` | `browser`, `scrapecreators` or `apify` |
| `SCRAPECREATORS_API_KEY` | | required by the `scrapecreators` backend |
| `APIFY_TOKEN` | | required by the `apify` backend |
| `META_ADS_ARCHIVE_TOKEN` | | unlocks `get_eu_transparency` |
| `META_GRAPH_VERSION` | `v26.0` | override if Meta retires that version |
| `FBADS_HEADED` | | `1` shows the browser window, to see why a search is empty |
| `FBADS_STORE_DIR` | platform default | where `diff_advertiser` keeps snapshots |
| `FBADS_HYDRATE_MS` | `9000` | how long to let the page load |
| `FBADS_SCROLL_WAIT_MS` | `4000` | pause between scrolls |
| `FBADS_HTTP_PORT` | `8787` | port for `--http` |
| `FBADS_HTTP_HOST` | `127.0.0.1` | bind address for `--http` |
| `FBADS_HTTP_TOKEN` | | require `Authorization: Bearer <token>` on HTTP |

---

## Running it over HTTP

```bash
npx -y @thenavidm/facebook-ad-library-mcp@latest --http --port 8787
```

It binds to loopback by default. This server reads a public archive, so the risk of exposing it is not stolen data: it is handing anyone on your network a free browser to drive, or a provider key to spend.

If you need it reachable, set `FBADS_HTTP_TOKEN` and put it behind TLS.

---

## Troubleshooting

Run the built-in check first. It launches a browser, runs a real search, and reports what actually failed.

```bash
npx -y @thenavidm/facebook-ad-library-mcp@latest doctor
```

| Symptom | Cause and fix |
|---|---|
| "Chromium will not launch" | Run `npx playwright install chromium` |
| "Meta served a captcha" | Rate limited. Wait a few minutes, or set a provider key |
| Empty results everywhere | Same cause. Confirm with `ad_library_url` opened in a real browser |
| One search empty, others fine | Genuinely no results. Broaden the keyword or set `active_status` to `all` |
| `spend` and `reach` are null | Correct outside the EU and outside political ads |
| Body contains `{{product.brand}}` | A real catalogue ad, not corrupted data |
| `transcribe_ad` unavailable | Only on the `scrapecreators` backend |
| Server missing from the client | `npx` is not on the client's PATH. Use the absolute path from `which npx` |
