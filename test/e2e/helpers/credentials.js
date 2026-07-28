/**
 * Role-based accounts for desktop E2E (see .env.e2e.example).
 *
 *   E2E_LOGIN_PRIMARY / E2E_PASSWORD_PRIMARY   — default login (mutations)
 *   E2E_LOGIN_SECONDARY / E2E_PASSWORD_SECONDARY — sharing / multi-user flows
 *   E2E_LOGIN_RESERVE / E2E_PASSWORD_RESERVE   — permissions / ACL scenarios
 *
 * Parallel workers stay at 1 by default (PLAYWRIGHT_WORKERS). Roles are for
 * intentional multi-user steps inside a test, not for worker isolation.
 */

function pair(loginKey, passwordKey) {
  const login = process.env[loginKey]
  const password = process.env[passwordKey]
  if (login && password) {
    return { login, password }
  }
  return null
}

function getPrimaryCredentials() {
  const creds = pair('E2E_LOGIN_PRIMARY', 'E2E_PASSWORD_PRIMARY')
  if (!creds) {
    throw new Error(
      'Set E2E_LOGIN_PRIMARY and E2E_PASSWORD_PRIMARY in test/e2e/.env.e2e'
    )
  }
  return creds
}

/** Alias used by existing specs / login helper. */
function getTestCredentials() {
  return getPrimaryCredentials()
}

function getSecondaryCredentials() {
  const creds = pair('E2E_LOGIN_SECONDARY', 'E2E_PASSWORD_SECONDARY')
  if (!creds) {
    throw new Error(
      'Set E2E_LOGIN_SECONDARY and E2E_PASSWORD_SECONDARY in test/e2e/.env.e2e'
    )
  }
  return creds
}

function getReserveCredentials() {
  const creds = pair('E2E_LOGIN_RESERVE', 'E2E_PASSWORD_RESERVE')
  if (!creds) {
    throw new Error(
      'Set E2E_LOGIN_RESERVE and E2E_PASSWORD_RESERVE in test/e2e/.env.e2e'
    )
  }
  return creds
}

function hasCredentials() {
  return !!(process.env.E2E_LOGIN_PRIMARY && process.env.E2E_PASSWORD_PRIMARY)
}

function hasSecondaryCredentials() {
  return !!(
    process.env.E2E_LOGIN_SECONDARY && process.env.E2E_PASSWORD_SECONDARY
  )
}

function hasReserveCredentials() {
  return !!(process.env.E2E_LOGIN_RESERVE && process.env.E2E_PASSWORD_RESERVE)
}

/**
 * Compose recipient for the default (primary) user.
 * E2E_COMPOSE_TO overrides when set.
 */
function getComposeTo() {
  if (process.env.E2E_COMPOSE_TO) {
    return process.env.E2E_COMPOSE_TO
  }
  return getPrimaryCredentials().login
}

module.exports = {
  getPrimaryCredentials,
  getTestCredentials,
  getSecondaryCredentials,
  getReserveCredentials,
  hasCredentials,
  hasSecondaryCredentials,
  hasReserveCredentials,
  getComposeTo,
}
