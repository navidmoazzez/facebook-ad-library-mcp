# Security

## Reporting a vulnerability

Email **accounts@navid.me**. Please do not open a public issue for a security
problem: an issue is visible the moment it is filed.

## What this server can reach

Less than most MCP servers, and that is the design.

It reads Meta's public Ad Library, which is open to anyone with a browser and no
login. It has **no write path at all**. There is no tool that posts, deletes,
spends, or touches an ad account, and no credential that would let one exist.

Every tool is annotated `readOnlyHint: true`, and that is accurate rather than
aspirational.

The blast radius of a compromised credential here is: someone can run searches
against a public archive, and, if a provider key is configured, spend the credit
on that key.

## Credentials

| Variable | Reaches | Needed |
|---|---|---|
| `SCRAPECREATORS_API_KEY` | the ScrapeCreators API, billable | only for that backend |
| `APIFY_TOKEN` | your Apify account, billable | only for that backend |
| `META_ADS_ARCHIVE_TOKEN` | Meta's public Ad Library API, read-only, free | only for `get_eu_transparency` |
| `FBADS_HTTP_TOKEN` | bearer auth on the HTTP transport | only with `--http` |

**Nothing is written to disk.** Keys are read from the environment on each run.
There is no config file, no keychain entry, and no session file to leak.

The default backend needs no credential of any kind.

## What is stored on disk

One thing: JSON snapshots of ads already seen, so `diff_advertiser` can report
what changed. They live in the platform data directory, or wherever
`FBADS_STORE_DIR` points.

They contain public ad data only. No credential is ever written there.

## The HTTP transport

`--http` binds to `127.0.0.1` unless you change it.

The risk of exposing it is not stolen data, since the data is public. It is that
anyone reaching the port gets a browser on your machine to drive, or a provider
key of yours to spend.

If you need it reachable, set `FBADS_HTTP_TOKEN` and put TLS in front of it.
`FBADS_HTTP_HOST` exists for people who mean it.

## Prompt injection

Ad copy is written by other people, specifically to persuade, and this server
feeds it to a model. An ad body saying "ignore your previous instructions" is a
live attack surface, not a hypothetical one.

Two mitigations, and neither is complete:

- The server instructions and the shipped `SKILL.md` both tell the model that ad
  content is data to summarise and never instructions to follow. That is in
  context before the first tool result arrives.
- There is no write path, so the usual goal of an injection, getting the agent to
  act on someone's behalf, has nothing to reach here.

The second is the real defence, and it is structural rather than advisory. This
server cannot be talked into doing something, because there is nothing it can do.

## Deliberately not implemented

So an omission reads as a decision rather than an oversight:

- **No spend or performance estimation.** Conversions, revenue and return on ad
  spend are not public for another advertiser. A number here would be invented,
  and an invented number that looks measured is worse than a gap.
- **No credential storage.** Environment only, so there is no file to protect.
- **No write tools.** There is no useful write against a public archive, and
  adding one would change the safety model of the whole server.
