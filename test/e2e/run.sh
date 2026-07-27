#!/bin/bash
# Discover modules/*/test/e2e with *.spec.js and run desktop Playwright suite.
# Runner: modules/CoreWebclient/test/e2e (shared helpers, config, browsers).
#
# Usage (from Aurora install root):
#   ./modules/CoreWebclient/test/e2e/run.sh
#   yarn test:e2e-desktop
#   ./modules/CoreWebclient/test/e2e/run.sh -- --project="MailWebclient · Desktop Chrome"
#
# Env:
#   SKIP_YARN_INSTALL=1

set -uo pipefail

E2E_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$E2E_DIR/../../../.." && pwd)"
SKIP_YARN_INSTALL="${SKIP_YARN_INSTALL:-0}"

echo "Scanning modules for test/e2e/*.spec.js ..."
echo ""

found=0
for module_dir in "$ROOT"/modules/*; do
    [ -d "$module_dir" ] || continue
    module_name="$(basename "$module_dir")"
    # Skip Core runner folder (shared helpers only, no module scenarios)
    if [ "$module_name" = "CoreWebclient" ]; then
        continue
    fi
    e2e_dir="$module_dir/test/e2e"
    if [ ! -d "$e2e_dir" ]; then
        continue
    fi
    spec_count="$(find "$e2e_dir" -maxdepth 1 -name '*.spec.js' 2>/dev/null | wc -l | tr -d ' ')"
    if [ "$spec_count" = "0" ]; then
        echo "[skip] $module_name — test/e2e has no *.spec.js"
        continue
    fi
    echo "[found] $module_name ($spec_count specs)"
    found=$((found + 1))
done

echo ""
if [ "$found" -eq 0 ]; then
    echo "No modules with test/e2e/*.spec.js — nothing to run."
    exit 1
fi

if [ "$SKIP_YARN_INSTALL" != "1" ]; then
    if [ ! -d "$E2E_DIR/node_modules" ]; then
        echo "Installing CoreWebclient/test/e2e dependencies..."
        (cd "$E2E_DIR" && yarn install --frozen-lockfile) || exit 1
    fi
elif [ ! -d "$E2E_DIR/node_modules" ]; then
    echo "CoreWebclient/test/e2e/node_modules missing (SKIP_YARN_INSTALL=1)"
    exit 1
fi

echo "----------------------------------------"
echo "Running Playwright via CoreWebclient/test/e2e"
echo "----------------------------------------"

cd "$E2E_DIR"
if [ "${1:-}" = "--" ]; then
    shift
fi
yarn test:e2e_local "$@"
