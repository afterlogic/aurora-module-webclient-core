const path = require('path')

/**
 * Resolve shared runner helpers (credentials, login, ready, …).
 * AURORA_E2E_ROOT is set by playwright.config.js (CoreWebclient/test/e2e).
 */
function sharedHelper(name) {
  const root =
    process.env.AURORA_E2E_ROOT || path.join(__dirname, '..')
  const base = String(name).replace(/\.js$/, '')
  return require(path.join(root, 'helpers', base))
}

/**
 * Resolve a domain helper living in modules/<Module>/test/e2e/helpers/.
 * AURORA_ROOT is the Aurora install root (parent of modules/).
 */
function moduleHelper(moduleName, name) {
  const root =
    process.env.AURORA_ROOT ||
    path.join(__dirname, '..', '..', '..', '..', '..')
  const base = String(name).replace(/\.js$/, '')
  return require(
    path.join(root, 'modules', moduleName, 'test', 'e2e', 'helpers', base)
  )
}

function fixturePath(...parts) {
  const root =
    process.env.AURORA_E2E_ROOT || path.join(__dirname, '..')
  return path.join(root, 'fixtures', ...parts)
}

module.exports = {
  sharedHelper,
  moduleHelper,
  fixturePath,
}
