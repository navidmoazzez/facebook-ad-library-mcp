#!/usr/bin/env node
/**
 * Entry point.
 *
 * `facebook-ad-library-mcp`          stdio, which is what MCP clients launch
 * `facebook-ad-library-mcp --http`   HTTP, for running it somewhere always on
 * `facebook-ad-library-mcp doctor`   check the setup and say what is wrong
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { buildServer, VERSION } from "./server.js";
import { httpOptionsFromEnv, startHttpServer } from "./transport/http.js";

const HELP = `facebook-ad-library-mcp ${VERSION}

  facebook-ad-library-mcp                     Run over stdio. This is what an MCP client launches.
  facebook-ad-library-mcp --http [--port=N]   Run over HTTP, for a machine that is always on.
  facebook-ad-library-mcp doctor              Check the setup and report what is wrong.
  facebook-ad-library-mcp --version           Print the version.

Backends. The default needs no key and no account:
  FBADS_BACKEND=browser           free, drives Chromium locally. Default.
  FBADS_BACKEND=scrapecreators    needs SCRAPECREATORS_API_KEY. Works serverless.
  FBADS_BACKEND=apify             needs APIFY_TOKEN. Works serverless.

Optional:
  META_ADS_ARCHIVE_TOKEN          unlocks EU spend, reach and demographics. Free from Meta.
  FBADS_HEADED=1                  show the browser, to see why a search came back empty
  FBADS_STORE_DIR                 where diff_advertiser keeps its snapshots
  FBADS_HYDRATE_MS                how long to let the page load, default 9000
  FBADS_SCROLL_WAIT_MS            pause between scrolls, default 4000
  FBADS_HTTP_PORT / _HOST / _TOKEN  for --http

https://github.com/navidmoazzez/facebook-ad-library-mcp
`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (argv.includes("--help") || argv.includes("-h") || command === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (command === "doctor") {
    const { runDoctor } = await import("./doctor.js");
    process.exitCode = await runDoctor();
    return;
  }

  const config = loadConfig();
  const built = buildServer(config);

  // Warn, never block. Checking a provider key over the network at startup would
  // delay the handshake, and the failure is more actionable on the call that hits it.
  if (config.backend === "scrapecreators" && !config.scrapeCreatorsKey) {
    process.stderr.write(
      "[facebook-ad-library-mcp] FBADS_BACKEND=scrapecreators but SCRAPECREATORS_API_KEY is not set. Run `facebook-ad-library-mcp doctor`.\n",
    );
  }
  if (config.backend === "apify" && !config.apifyToken) {
    process.stderr.write(
      "[facebook-ad-library-mcp] FBADS_BACKEND=apify but APIFY_TOKEN is not set. Run `facebook-ad-library-mcp doctor`.\n",
    );
  }

  const shutdown = async (close?: () => Promise<void>): Promise<void> => {
    if (close) await close().catch(() => undefined);
    await built.close().catch(() => undefined);
    process.exit(0);
  };

  if (argv.includes("--http")) {
    const { close } = await startHttpServer(built, httpOptionsFromEnv(argv));
    process.on("SIGTERM", () => void shutdown(close));
    process.on("SIGINT", () => void shutdown(close));
    return;
  }

  const transport = new StdioServerTransport();
  await built.server.connect(transport);

  // Handled so `docker stop` and a client shutting down return promptly, and so
  // Chromium is closed rather than left running.
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

main().catch((error: unknown) => {
  process.stderr.write(`[facebook-ad-library-mcp] ${(error as Error).message}\n`);
  process.exit(1);
});
