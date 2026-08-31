#!/usr/bin/env bash
# One-shot local install for people who would rather not edit a client config by
# hand. Installs the package, the browser it needs, then runs doctor so a broken
# setup is visible immediately rather than on the first tool call.
set -euo pipefail

PACKAGE="@thenavidm/facebook-ad-library-mcp"

command -v node >/dev/null 2>&1 || {
  echo "Node 20 or newer is required. Get it from https://nodejs.org" >&2
  exit 1
}

MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$MAJOR" -lt 20 ]; then
  echo "Node $MAJOR found, but 20 or newer is required." >&2
  exit 1
fi

echo "Installing Chromium for the free backend..."
npx -y playwright install chromium

echo
echo "Checking the setup..."
npx -y "$PACKAGE@latest" doctor

cat <<'NEXT'

Add it to Claude Code with:

  claude mcp add facebook-ads -- npx -y @thenavidm/facebook-ad-library-mcp@latest

For every other client, see the README.
NEXT
