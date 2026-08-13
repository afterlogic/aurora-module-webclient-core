// @ts-check
const fs = require('fs')
const path = require('path')
const {
  stripLoopbackProxyFromProcessEnv,
} = require('./scripts/strip-loopback-proxy')

// IDE sandboxes may inject HTTP_PROXY=127.0.0.1 → ERR_CONNECTION_CLOSED to staging.
stripLoopbackProxyFromProcessEnv()

const e2eRoot = __dirname
// CoreWebclient/test/e2e → CoreWebclient → modules → install root
const auroraRoot = path.join(__dirname, '..', '..', '..', '..')

process.env.AURORA_E2E_ROOT = e2eRoot
process.env.AURORA_ROOT = auroraRoot

// Specs live under modules/*/test/e2e — resolve @playwright/test from install root.
const runnerNodeModules = path.join(auroraRoot, 'node_modules')
const prevNodePath = process.env.NODE_PATH || ''
if (!prevNodePath.split(path.delimiter).includes(runnerNodeModules)) {
  process.env.NODE_PATH = prevNodePath
    ? `${runnerNodeModules}${path.delimiter}${prevNodePath}`
    : runnerNodeModules
  // eslint-disable-next-line no-underscore-dangle
  require('module').Module._initPaths()
}

const { defineConfig, devices } = require('@playwright/test')

function loadEnvE2e() {
  const envPath = path.join(e2eRoot, '.env.e2e')
  if (!fs.existsSync(envPath)) {
    return
  }

  // File wins: Playwright UI keeps process.env across config reloads, so
  // `if (!process.env[key])` would keep a stale PRIMARY after .env.e2e edits.
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) {
        process.env[match[1].trim()] = match[2].trim()
      }
    })
}

loadEnvE2e()

/**
 * Discover modules/<Name>/test/e2e that contain at least one *.spec.js.
 * Skip *Mobile* modules (their E2E lives under vue-mobile/test/e2e).
 */
function discoverModuleE2eDirs() {
  const modulesRoot = path.join(auroraRoot, 'modules')
  if (!fs.existsSync(modulesRoot)) {
    return []
  }

  return fs
    .readdirSync(modulesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => !/Mobile/i.test(d.name))
    .filter((d) => d.name !== 'CoreWebclient')
    .map((d) => {
      const moduleName = d.name
      const testDir = path.join(modulesRoot, moduleName, 'test', 'e2e')
      return { moduleName, testDir }
    })
    .filter(({ testDir }) => {
      if (!fs.existsSync(testDir) || !fs.statSync(testDir).isDirectory()) {
        return false
      }
      return fs.readdirSync(testDir).some((f) => f.endsWith('.spec.js'))
    })
    .sort((a, b) => a.moduleName.localeCompare(b.moduleName))
}

const browsers = [
  {
    name: 'Chrome',
    use: {
      ...devices['Desktop Chrome'],
      // Docker containers have small /dev/shm (64 MB default).
      // --disable-dev-shm-usage makes Chromium use /tmp instead.
      // Chromium-only flag: Firefox silently ignores it, but WebKit's
      // launcher hard-rejects unknown args ("Cannot parse arguments") and
      // exits immediately, so this must not go in the shared/global `use`.
      launchOptions: { args: ['--disable-dev-shm-usage'] },
    },
  },
  { name: 'Firefox', use: { ...devices['Desktop Firefox'] } },
  // Playwright WebKit (Safari engine) — not real Mobile Safari on a device.
  { name: 'Safari', use: { ...devices['Desktop Safari'] } },
]

const moduleDirs = discoverModuleE2eDirs()

// One authenticated storageState per browser engine (cookies/localStorage
// aren't shared across engines). Each module project depends on the setup
// project for its own browser, so `--project` filters still pull it in.
const authDir = path.join(e2eRoot, '.auth')

/** @type {import('@playwright/test').Project[]} */
const projects = []
for (const browser of browsers) {
  const setupProjectName = `auth setup · ${browser.name}`

  projects.push({
    name: setupProjectName,
    testDir: e2eRoot,
    testMatch: /auth\.setup\.js/,
    use: { ...browser.use },
  })

  for (const { moduleName, testDir } of moduleDirs) {
    projects.push({
      name: `${moduleName} · ${browser.name}`,
      testDir,
      testMatch: '*.spec.js',
      use: {
        ...browser.use,
        storageState: path.join(authDir, `${browser.name}.json`),
      },
      dependencies: [setupProjectName],
    })
  }
}

if (projects.length === 0) {
  console.warn(
    '[CoreWebclient/test/e2e] No modules/<Name>/test/e2e/*.spec.js found under',
    path.join(auroraRoot, 'modules')
  )
}

/**
 * Desktop E2E against a running Aurora instance (MAMP / staging).
 * Specs: modules/<Webclient>/test/e2e/
 * Deps / npm scripts: modules/CoreWebclient/package.json
 *
 * Override URL: PLAYWRIGHT_BASE_URL=https://staging.example/subdir/
 * Workers: PLAYWRIGHT_WORKERS (default 1).
 *
 * For subdirectory installs always include a trailing slash. Helpers use
 * page.goto('') (baseURL itself); goto('/') would hit the host root.
 */
function normalizeBaseUrl(url) {
  try {
    const u = new URL(url)
    if (!u.pathname.endsWith('/')) {
      u.pathname += '/'
    }
    return u.href
  } catch {
    return url.endsWith('/') ? url : `${url}/`
  }
}

function resolveWorkers() {
  const raw = process.env.PLAYWRIGHT_WORKERS
  if (raw !== undefined && raw !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 1) {
      return Math.floor(n)
    }
  }
  return 1
}

const baseURL = normalizeBaseUrl(
  process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8888/'
)

const { T } = require('./helpers/timeouts')

function resolveRetries() {
  const raw = Number(process.env.E2E_RETRIES)
  if (Number.isFinite(raw) && raw >= 0) {
    return raw
  }
  return 1
}

module.exports = defineConfig({
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: resolveRetries(),
  workers: resolveWorkers(),
  timeout: T(120000),
  expect: {
    timeout: T(15000),
  },
  reporter: [
    ['list', { printSteps: true }],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL,
    testIdAttribute: 'data-test-id',
    actionTimeout: T(30000),
    navigationTimeout: T(45000),
    trace: process.env.CI ? 'on-first-retry' : 'on',
    screenshot: 'only-on-failure',
  },
  projects,
})
