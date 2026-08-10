/**
 * Central timeout scaling for E2E waits.
 *
 * All the individual `{ timeout: N }` / `test.setTimeout(N)` values across
 * these helpers and specs were tuned against the fast local backend
 * (localhost:8081 / vite proxying to it). Pointing PLAYWRIGHT_BASE_URL /
 * VITE_WEBCLIENT_BACKEND_ORIGIN at a real remote host adds real internet
 * latency (TLS handshake + response time alone can be 1-2s+ per request,
 * see .env.e2e comments) on top of every wait, so those same budgets start
 * producing false failures that pass on retry — not real bugs.
 *
 * E2E_TIMEOUT_SCALE (set in .env.e2e) multiplies every timeout that goes
 * through `T()` below. Defaults to 1 (no change) so local/legacy runs are
 * unaffected.
 */
const SCALE = (() => {
  const raw = Number(process.env.E2E_TIMEOUT_SCALE)
  return Number.isFinite(raw) && raw > 0 ? raw : 1
})()

/** Scale a timeout (ms) by E2E_TIMEOUT_SCALE. */
function T(ms) {
  return Math.round(ms * SCALE)
}

module.exports = { SCALE, T }
