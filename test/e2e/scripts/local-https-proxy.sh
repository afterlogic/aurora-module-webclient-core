#!/usr/bin/env bash
# Terminates TLS in front of local Apache (default :8888) so Paranoid Encryption
# and WebCrypto APIs work in Chromium. Self-signed cert — Playwright uses
# ignoreHTTPSErrors.
#
# Usage:
#   ./modules/CoreWebclient/test/e2e/scripts/local-https-proxy.sh
# Then set in .env.e2e:
#   PLAYWRIGHT_BASE_URL=https://localhost:8890/

set -euo pipefail
SOURCE_PORT="${E2E_HTTPS_PORT:-8890}"
TARGET_PORT="${E2E_HTTP_PORT:-8888}"

echo "HTTPS :${SOURCE_PORT} → HTTP :${TARGET_PORT}"
echo "Set PLAYWRIGHT_BASE_URL=https://localhost:${SOURCE_PORT}/"
exec npx --yes local-ssl-proxy --source "${SOURCE_PORT}" --target "${TARGET_PORT}"
