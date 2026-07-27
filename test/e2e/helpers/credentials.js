/**
 * Per-worker account pool for parallel E2E.
 *
 * Prefer indexed accounts in `.env.e2e`:
 *   E2E_LOGIN_0 / E2E_PASSWORD_0
 *   E2E_LOGIN_1 / E2E_PASSWORD_1
 *   …
 * Fallback: single E2E_LOGIN / E2E_PASSWORD (forces safe workers: 1).
 *
 * Worker N uses account N % poolSize (via TEST_PARALLEL_INDEX).
 */

function loadAccountPool() {
  const pool = []
  for (let i = 0; i < 16; i++) {
    const login = process.env[`E2E_LOGIN_${i}`]
    const password = process.env[`E2E_PASSWORD_${i}`]
    if (login && password) {
      pool.push({ login, password })
    }
  }
  if (pool.length > 0) {
    return pool
  }
  if (process.env.E2E_LOGIN && process.env.E2E_PASSWORD) {
    return [
      {
        login: process.env.E2E_LOGIN,
        password: process.env.E2E_PASSWORD,
      },
    ]
  }
  return []
}

function accountPoolSize() {
  return loadAccountPool().length
}

function hasCredentials() {
  return accountPoolSize() > 0
}

function getWorkerIndex() {
  const raw = process.env.TEST_PARALLEL_INDEX
  const index = raw === undefined || raw === '' ? 0 : Number(raw)
  return Number.isFinite(index) && index >= 0 ? index : 0
}

/** Credentials for the current Playwright worker. */
function getTestCredentials() {
  const pool = loadAccountPool()
  if (pool.length === 0) {
    throw new Error(
      'Set E2E_LOGIN_0/E2E_PASSWORD_0 (… ) or E2E_LOGIN/E2E_PASSWORD in .env.e2e'
    )
  }
  return pool[getWorkerIndex() % pool.length]
}

/**
 * Compose recipient for the current worker.
 * E2E_COMPOSE_TO overrides (same for all workers — use only when intentional).
 * Otherwise send to the worker's own mailbox.
 */
function getComposeTo() {
  if (process.env.E2E_COMPOSE_TO) {
    return process.env.E2E_COMPOSE_TO
  }
  return getTestCredentials().login
}

/**
 * Default worker count: 2 when 2+ accounts exist (speed vs load), else 1.
 * Cap at pool size. Override with PLAYWRIGHT_WORKERS.
 */
function resolveWorkerCount() {
  const poolSize = Math.max(accountPoolSize(), 1)
  const fromEnv = process.env.PLAYWRIGHT_WORKERS
  if (fromEnv !== undefined && fromEnv !== '') {
    const n = Number(fromEnv)
    if (Number.isFinite(n) && n >= 1) {
      return Math.min(Math.floor(n), poolSize)
    }
  }
  const conservativeDefault = poolSize >= 2 ? 2 : 1
  return Math.min(conservativeDefault, poolSize)
}

module.exports = {
  loadAccountPool,
  accountPoolSize,
  hasCredentials,
  getWorkerIndex,
  getTestCredentials,
  getComposeTo,
  resolveWorkerCount,
}
