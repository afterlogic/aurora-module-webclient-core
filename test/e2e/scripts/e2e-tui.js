#!/usr/bin/env node
/**
 * Interactive terminal launcher for the desktop and mobile E2E suites.
 *
 * Pick a suite, the installation to test, modules, browsers and a mode
 * (run / run + email report / Playwright UI). The launcher then calls the
 * suite's own runner with --setup "<modules> <browsers>", so project naming
 * stays in those runners. The installation URL is passed as E2E_BASE_URL /
 * PLAYWRIGHT_BASE_URL; the value from the environment / .env.e2e is the default.
 *
 * A suite that is not ready gets a setup screen: npm install, Playwright
 * browsers, and a step-by-step .env.e2e wizard built from .env.e2e.example.
 * The launcher also checks that .env.e2e is not served over HTTP by this
 * installation (WEB_INSTALL_URL) and by the target installation.
 *
 * Usage (from the install root):
 *   npm run test:e2e:tui
 *   npm run test:e2e:tui -- --grep compose     # extra args go to Playwright
 *
 * No dependencies: works in Windows Terminal / PowerShell / cmd, macOS and
 * Linux terminals. Git Bash under mintty has no real TTY — prefix the command
 * with `winpty` or use another terminal.
 */

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const {
  bold,
  dim,
  inverse,
  red,
  green,
  yellow,
  cyan,
  ESC,
  ALT_SCREEN_ON,
  ALT_SCREEN_OFF,
  CURSOR_HIDE,
  CURSOR_SHOW,
  screenSize,
  hr,
  wrap,
  quoteArg,
  createEditor,
  editKey,
  renderEditor,
} = require('./tui/term')
const envFile = require('./tui/env-file')
const { installBase, checkInstallation } = require('./tui/web-check')

const coreRoot = path.join(__dirname, '..', '..', '..')
const auroraRoot = path.join(coreRoot, '..', '..')
const modulesRoot = path.join(auroraRoot, 'modules')
const rootNodeModules = path.join(auroraRoot, 'node_modules')
const vueMobileRoot = path.join(modulesRoot, 'CoreMobileWebclient', 'vue-mobile')
const statePath = path.join(__dirname, '..', '.tui-state.json')

const extraArgs = process.argv.slice(2)

const BROWSER_ENGINES = ['chromium', 'firefox', 'webkit']
const MAIL_KEYS = [
  'MAIL_HOST',
  'MAIL_PORT',
  'MAIL_USERNAME',
  'MAIL_PASSWORD',
  'MAIL_FROM_ADDRESS',
  'E2E_MAIL_TO',
]
const URL_HISTORY_SIZE = 8

/** Keys with the same meaning in both suites' .env.e2e. */
const SHARED_KEYS = [
  'MAIL_HOST',
  'MAIL_PORT',
  'MAIL_ENCRYPTION',
  'MAIL_USERNAME',
  'MAIL_PASSWORD',
  'MAIL_FROM_ADDRESS',
  'MAIL_FROM_NAME',
  'E2E_MAIL_TO',
  'WEB_INSTALL_URL',
  'E2E_LOGIN_SECONDARY',
  'E2E_PASSWORD_SECONDARY',
  'E2E_COMPOSE_TO',
]
/** [desktop key, mobile key] pairs for the same setting. */
const RENAMED_KEYS = [
  ['PLAYWRIGHT_BASE_URL', 'PLAYWRIGHT_BASE_URL'],
  ['E2E_LOGIN_PRIMARY', 'E2E_LOGIN'],
  ['E2E_PASSWORD_PRIMARY', 'E2E_PASSWORD'],
]

function relToRoot(file) {
  return path.relative(auroraRoot, file).split(path.sep).join('/')
}

// --- Environment checks ------------------------------------------------------

/**
 * Checks are cached per menu session and dropped when the menu reopens after
 * a run, an install or the .env.e2e wizard, so fixes are picked up.
 */
let cache = {}
let webChecks = {}

function resetChecks() {
  cache = {}
  webChecks = {}
}

function cached(key, compute) {
  if (!(key in cache)) {
    cache[key] = compute()
  }
  return cache[key]
}

function readEnvFile(file) {
  return cached(`env:${file}`, () => envFile.readEnv(file))
}

function envValue(suite, key) {
  const file = readEnvFile(suite.envFile) || {}
  return process.env[key] || file[key] || ''
}

function playwrightInstalled() {
  return cached('playwright', () =>
    fs.existsSync(path.join(rootNodeModules, '@playwright', 'test'))
  )
}

/** { chromium: bool, firefox: bool, webkit: bool } — missing key = unknown. */
function installedEngines() {
  return cached('engines', () => {
    const result = {}
    let playwright
    try {
      playwright = require(path.join(rootNodeModules, 'playwright-core'))
    } catch {
      return result
    }
    for (const engine of BROWSER_ENGINES) {
      try {
        result[engine] = fs.existsSync(playwright[engine].executablePath())
      } catch {
        // Unknown for this Playwright version — do not block the browser.
      }
    }
    return result
  })
}

function hasPhp() {
  return cached('php', () => {
    const r = spawnSync('php', ['-v'], { stdio: 'ignore' })
    return !r.error && r.status === 0
  })
}

/** Async .env.e2e exposure check per installation; re-renders when done. */
function webCheck(url) {
  let base
  try {
    base = installBase(url)
  } catch {
    return { state: 'unknown', error: 'invalid URL' }
  }
  if (!webChecks[base]) {
    const record = { state: 'checking', base }
    webChecks[base] = record
    checkInstallation(base, SUITES.map((s) => relToRoot(s.envFile))).then((result) => {
      // Ignore results that arrive after the checks were reset.
      if (webChecks[base] === record) {
        webChecks[base] = { ...result, base }
        render()
      }
    })
  }
  return webChecks[base]
}

// --- Suites ------------------------------------------------------------------

function countSpecs(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.spec.js')).length
  } catch {
    return 0
  }
}

/** Same discovery rules as the suites' playwright.config.js. */
function discoverModules(testDirOf, skip) {
  if (!fs.existsSync(modulesRoot)) {
    return []
  }
  return fs
    .readdirSync(modulesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !skip(d.name))
    .map((d) => ({ id: d.name, specs: countSpecs(testDirOf(d.name)) }))
    .filter((m) => m.specs > 0)
    .sort((a, b) => a.id.localeCompare(b.id))
}

const desktopScripts = path.join(coreRoot, 'test', 'e2e', 'scripts')
const mobileScripts = path.join(vueMobileRoot, 'test', 'e2e', 'scripts')

const SUITES = [
  {
    id: 'desktop',
    label: 'Desktop',
    where: 'modules/*/test/e2e',
    runner: path.join(coreRoot, 'test', 'e2e', 'playwright.config.js'),
    readme: path.join(coreRoot, 'test', 'e2e', 'README.md'),
    cwd: coreRoot,
    envFile: path.join(coreRoot, 'test', 'e2e', '.env.e2e'),
    envTemplate: path.join(coreRoot, 'test', 'e2e', '.env.e2e.example'),
    requiredEnv: ['E2E_LOGIN_PRIMARY', 'E2E_PASSWORD_PRIMARY'],
    defaultUrl: 'http://localhost:8888/',
    discover: () =>
      discoverModules(
        (m) => path.join(modulesRoot, m, 'test', 'e2e'),
        (m) => m === 'CoreWebclient' || /MobileWebclient$/i.test(m)
      ),
    // Mirrors BROWSERS in run-e2e.js.
    browsers: [
      { id: 'Chrome', hint: 'Chromium', engine: 'chromium' },
      { id: 'Firefox', hint: 'Gecko', engine: 'firefox' },
      { id: 'Safari', hint: 'WebKit', engine: 'webkit' },
    ],
    testArgs: (mode, setup) =>
      mode === 'email'
        ? [path.join(desktopScripts, 'run-with-email-report.js'), '--setup', setup]
        : [path.join(desktopScripts, 'run-e2e.js'), '--setup', setup],
    reportArgs: () => [
      path.join(desktopScripts, 'playwright-cli.js'),
      'show-report',
      path.join('test', 'e2e', 'playwright-report'),
    ],
  },
  {
    id: 'mobile',
    label: 'Mobile',
    where: 'modules/*/vue-mobile/test/e2e',
    runner: path.join(vueMobileRoot, 'playwright.config.js'),
    readme: path.join(vueMobileRoot, 'test', 'e2e', 'README.md'),
    cwd: vueMobileRoot,
    envFile: path.join(vueMobileRoot, '.env.e2e'),
    envTemplate: path.join(vueMobileRoot, '.env.e2e.example'),
    requiredEnv: ['E2E_LOGIN', 'E2E_PASSWORD'],
    defaultUrl: 'http://localhost:8888/?mobile-version',
    discover: () =>
      discoverModules(
        (m) => path.join(modulesRoot, m, 'vue-mobile', 'test', 'e2e'),
        () => false
      ),
    // Mirrors DEVICES in vue-mobile/test/e2e/scripts/playwright-cli.js.
    browsers: [
      { id: 'iPhoneSE', hint: 'iPhone SE · Chromium', engine: 'chromium' },
      { id: 'iPhone13', hint: 'iPhone 13 · Chromium', engine: 'chromium' },
      { id: 'Pixel7', hint: 'Pixel 7 · Chromium', engine: 'chromium' },
      { id: 'Pixel7Firefox', hint: 'Pixel 7 · Firefox', engine: 'firefox' },
      { id: 'iPhoneSEWebKit', hint: 'iPhone SE · WebKit', engine: 'webkit' },
      { id: 'iPhone13WebKit', hint: 'iPhone 13 · WebKit', engine: 'webkit' },
    ],
    testArgs: (mode, setup) =>
      mode === 'email'
        ? [path.join(mobileScripts, 'run-with-email-report.js'), '--setup', setup]
        : [path.join(mobileScripts, 'playwright-cli.js'), 'test', '--setup', setup],
    reportArgs: () => [path.join(mobileScripts, 'playwright-cli.js'), 'show-report'],
  },
]

function suiteModules(suite) {
  return cached(`modules:${suite.id}`, () => suite.discover())
}

/** .env.e2e keys that are empty or still hold the template example. */
function unsetKeys(suite, keys) {
  return keys.filter((key) => {
    const value = envValue(suite, key)
    return !value || envFile.isPlaceholder(value)
  })
}

/**
 * Reasons the suite cannot run; empty when it is ready.
 * Each is { text, fix? } where fix is 'npm' | 'browsers' | 'env'.
 */
function suiteProblems(suite) {
  return cached(`problems:${suite.id}`, () => {
    const problems = []
    if (!fs.existsSync(suite.runner)) {
      problems.push({ text: `${relToRoot(path.dirname(suite.runner))} is not installed` })
      return problems
    }
    if (suiteModules(suite).length === 0) {
      problems.push({ text: `no *.spec.js found in ${suite.where}` })
    }
    const envFix = fs.existsSync(suite.envTemplate) ? 'env' : undefined
    if (!readEnvFile(suite.envFile)) {
      problems.push({ text: `${relToRoot(suite.envFile)} is missing`, fix: envFix })
    } else {
      const missing = unsetKeys(suite, suite.requiredEnv)
      if (missing.length) {
        problems.push({
          text: `${missing.join(', ')} not set in ${relToRoot(suite.envFile)}`,
          fix: envFix,
        })
      }
    }
    if (!playwrightInstalled()) {
      problems.push({
        text: '@playwright/test is not installed in the install-root node_modules',
        fix: 'npm',
      })
    } else if (!suite.browsers.some(browserInstalled)) {
      problems.push({
        text: 'Playwright browsers are not installed for this Playwright version',
        fix: 'browsers',
      })
    }
    return problems
  })
}

function browserInstalled(browser) {
  return installedEngines()[browser.engine] !== false
}

// --- Installations -----------------------------------------------------------

/** Base URL from the environment / .env.e2e, else the config default. */
function defaultInstall(suite) {
  if (process.env.PLAYWRIGHT_BASE_URL) {
    return { url: process.env.PLAYWRIGHT_BASE_URL, source: 'from environment' }
  }
  const file = readEnvFile(suite.envFile) || {}
  if (file.PLAYWRIGHT_BASE_URL) {
    return { url: file.PLAYWRIGHT_BASE_URL, source: 'from .env.e2e' }
  }
  return { url: suite.defaultUrl, source: 'config default' }
}

/** Accepts http(s) URLs only; mobile URLs get ?mobile-version if missing. */
function normalizeUrl(input, suite) {
  let url
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }
  url.hash = ''
  if (!url.pathname.endsWith('/')) {
    url.pathname += '/'
  }
  let href = url.href
  if (suite.id === 'mobile' && !url.searchParams.has('mobile-version')) {
    href += `${url.search ? '&' : '?'}mobile-version`
  }
  return href
}

/** Hide the password part of user:pass@host URLs. */
function displayUrl(value) {
  try {
    const url = new URL(value)
    if (url.password) {
      url.password = '***'
    }
    return url.href
  } catch {
    return value
  }
}

// --- State -------------------------------------------------------------------

const MODES = [
  { id: 'run', label: 'Run', hint: 'run in this terminal, HTML report afterwards' },
  { id: 'email', label: 'Run + email report', hint: 'send the report by email after the run' },
  { id: 'ui', label: 'Playwright UI', hint: 'open the interactive UI mode' },
]

const STEPS = ['suite', 'install', 'modules', 'browsers', 'mode', 'confirm']
const STEP_TITLES = {
  suite: 'Suite',
  install: 'Installation',
  modules: 'Modules',
  browsers: 'Browsers',
  mode: 'Mode',
  confirm: 'Run',
}

const FIXES = {
  npm: 'Install npm dependencies (npm install in the install root)',
  browsers: 'Install Playwright browsers (Chromium, Firefox, WebKit)',
  env: 'Set up .env.e2e step by step',
}

function loadSaved() {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'))
  } catch {
    return {}
  }
}

const saved = loadSaved()

const state = {
  phase: 'menu', // menu | running | after-run
  screen: 'steps', // steps | fix | wizard
  step: 0,
  cursor: 0,
  offset: 0,
  message: '',
  editing: null, // editor for "Other URL…", or null
  suite: SUITES.find((s) => s.id === saved.suite) || SUITES[0],
  mode: MODES.find((m) => m.id === saved.mode) || MODES[0],
  picks: {},
  fix: null, // { suite, cursor }
  wizard: null, // see openWizard()
  lastRun: null, // { kind: 'tests' | 'task', status }
}

/** Per-suite selection, seeded from the last session. */
function picksFor(suite) {
  if (!state.picks[suite.id]) {
    const prev = saved[suite.id] || {}
    const moduleIds = suiteModules(suite).map((m) => m.id)
    const browserIds = suite.browsers.map((b) => b.id)
    const modules = (prev.modules || moduleIds).filter((id) => moduleIds.includes(id))
    const browsers = (prev.browsers || [browserIds[0]]).filter((id) =>
      browserIds.includes(id)
    )
    state.picks[suite.id] = {
      modules: new Set(modules),
      browsers: new Set(browsers),
      url: defaultInstall(suite).url,
      urls: (prev.urls || []).slice(0, URL_HISTORY_SIZE),
    }
  }
  return state.picks[suite.id]
}

/** Browsers that are selected and installed, in list order. */
function selectedBrowsers(suite) {
  const picks = picksFor(suite)
  return suite.browsers.filter((b) => picks.browsers.has(b.id) && browserInstalled(b))
}

function modeProblems(mode) {
  if (mode.id !== 'email') {
    return []
  }
  const problems = []
  if (!hasPhp()) {
    problems.push('php is not in PATH')
  }
  const missing = unsetKeys(state.suite, MAIL_KEYS)
  if (missing.length) {
    problems.push(`${missing.join(', ')} not set in ${relToRoot(state.suite.envFile)}`)
  }
  return problems
}

function saveState() {
  const data = { suite: state.suite.id, mode: state.mode.id }
  for (const [suiteId, picks] of Object.entries(state.picks)) {
    data[suiteId] = {
      modules: [...picks.modules],
      browsers: [...picks.browsers],
      urls: picks.urls,
    }
  }
  try {
    fs.writeFileSync(statePath, `${JSON.stringify(data, null, 2)}\n`)
  } catch {
    // Remembering the selection is a convenience only.
  }
}

function stepId() {
  return STEPS[state.step]
}

/**
 * Items of the current list step:
 * { id, label, hint, on, disabled, details: string[] }.
 */
function stepItems() {
  const suite = state.suite
  switch (stepId()) {
    case 'suite':
      return SUITES.map((s) => {
        const problems = suiteProblems(s)
        const fixable = problems.some((p) => p.fix)
        return {
          id: s.id,
          label: s.label,
          hint: problems.length
            ? 'not configured'
            : `${suiteModules(s).length} modules · ${s.where}`,
          on: s === suite,
          disabled: problems.length > 0,
          details: problems.length
            ? [
                `${s.label} tests need to be set up:`,
                ...problems.map((p) => `  • ${p.text}`),
                fixable ? 'Press Enter to fix it here.' : `See ${relToRoot(s.readme)}`,
              ]
            : null,
        }
      })
    case 'install': {
      const picks = picksFor(suite)
      const def = defaultInstall(suite)
      const items = [{ id: def.url, label: displayUrl(def.url), hint: def.source }]
      for (const url of picks.urls) {
        if (url !== def.url) {
          items.push({ id: url, label: displayUrl(url), hint: 'used before · D forget', history: true })
        }
      }
      items.forEach((item) => (item.on = item.id === picks.url))
      items.push({ id: '', label: 'Other URL…', hint: 'type an installation URL' })
      return items
    }
    case 'modules': {
      const picks = picksFor(suite)
      return suiteModules(suite).map((m) => ({
        id: m.id,
        label: m.id,
        hint: `${m.specs} spec${m.specs === 1 ? '' : 's'}`,
        on: picks.modules.has(m.id),
      }))
    }
    case 'browsers': {
      const picks = picksFor(suite)
      return suite.browsers.map((b) => {
        const installed = browserInstalled(b)
        return {
          id: b.id,
          label: b.id,
          hint: installed ? b.hint : `${b.hint} · not installed`,
          on: installed && picks.browsers.has(b.id),
          disabled: !installed,
          details: installed ? null : [`${b.engine} is not installed. Press I to install browsers.`],
        }
      })
    }
    case 'mode':
      return MODES.map((m) => {
        const problems = modeProblems(m)
        return {
          id: m.id,
          label: m.label,
          hint: problems.length ? 'not configured' : m.hint,
          on: m === state.mode,
          disabled: problems.length > 0,
          details: problems.length
            ? [
                'Email report needs:',
                ...problems.map((p) => `  • ${p}`),
                'Press Enter to fill in the mail settings in .env.e2e.',
              ]
            : null,
        }
      })
    default:
      return []
  }
}

function isMultiSelect() {
  return stepId() === 'modules' || stepId() === 'browsers'
}

function goStep(index) {
  state.screen = 'steps'
  state.step = Math.max(0, Math.min(STEPS.length - 1, index))
  state.offset = 0
  state.editing = null
  const items = stepItems()
  let cursor = isMultiSelect() ? -1 : items.findIndex((i) => i.on && !i.disabled)
  if (cursor < 0) {
    cursor = items.findIndex((i) => !i.disabled)
  }
  state.cursor = Math.max(0, cursor)
}

// --- Command -----------------------------------------------------------------

function buildSetup() {
  const suite = state.suite
  const picks = picksFor(suite)
  const all = suiteModules(suite)
  const modules = all.filter((m) => picks.modules.has(m.id)).map((m) => m.id)
  const browsers = selectedBrowsers(suite).map((b) => b.id)
  const modulePart = modules.length === all.length ? '*' : modules.join(',')
  return { modules, browsers, setup: `${modulePart} ${browsers.join(',')}` }
}

function buildTestCommand() {
  const suite = state.suite
  const url = picksFor(suite).url
  const args = suite.testArgs(state.mode.id, buildSetup().setup)
  if (state.mode.id === 'ui') {
    args.push('--ui')
  }
  args.push(...extraArgs)
  // Desktop config lets .env.e2e override the environment, so it reads the
  // launcher's choice from E2E_BASE_URL; mobile reads PLAYWRIGHT_BASE_URL.
  const env = { ...process.env, E2E_BASE_URL: url, PLAYWRIGHT_BASE_URL: url }
  return { command: process.execPath, cwd: suite.cwd, args, env }
}

function describeCommand({ cwd, args }) {
  const [script, ...rest] = args
  const rel = path.relative(cwd, script).split(path.sep).join('/')
  return `node ${rel} ${rest.map(quoteArg).join(' ')}`.trim()
}

// --- Rendering ---------------------------------------------------------------

function renderHeader() {
  const crumbs = STEPS.map((id, i) => {
    const title = STEP_TITLES[id]
    if (i === state.step) {
      return inverse(bold(` ${title} `))
    }
    return i < state.step ? cyan(title) : dim(title)
  })
  const context = []
  if (state.step > 0) {
    context.push(state.suite.label)
  }
  if (state.step > 1) {
    context.push(displayUrl(picksFor(state.suite).url))
  }
  return [
    `${bold(' Aurora E2E')}  ${dim(context.join(' · '))}`,
    ` ${crumbs.join(dim(' › '))}`,
    hr(),
  ]
}

/** Status lines of the .env.e2e HTTP exposure check for `suite`. */
function renderWebChecks(suite, targetUrl) {
  const local = envValue(suite, 'WEB_INSTALL_URL')
  const targets = []
  if (local && !envFile.isPlaceholder(local)) {
    targets.push({ label: 'this installation', url: local })
  }
  if (targetUrl) {
    targets.push({ label: 'target', url: targetUrl })
  }

  const lines = [` ${dim('.env.e2e over HTTP')}`]
  const seen = {}
  let exposed = false
  for (const target of targets) {
    const result = webCheck(target.url)
    const key = result.base || target.url
    if (seen[key]) {
      seen[key].label += ` = ${target.label}`
      continue
    }
    const row = { label: target.label, result, url: target.url }
    seen[key] = row
  }
  for (const { label, result, url } of Object.values(seen)) {
    const where = `${label} ${dim(displayUrl(result.base || url))}`
    if (result.state === 'checking') {
      lines.push(`   ${dim('…')} ${where} ${dim('checking')}`)
    } else if (result.state === 'safe') {
      lines.push(`   ${green('✔')} ${where} ${green('not served')}`)
    } else if (result.state === 'exposed') {
      exposed = true
      lines.push(`   ${red('✖')} ${where} ${red(`serves ${result.exposed.join(', ')}`)}`)
    } else {
      lines.push(`   ${yellow('?')} ${where} ${yellow(`could not check: ${result.error}`)}`)
    }
  }
  if (!targets.some((t) => t.label === 'this installation')) {
    lines.push(`   ${dim('Set WEB_INSTALL_URL in .env.e2e to check this installation too.')}`)
  }
  if (exposed) {
    lines.push(
      ` ${red('Passwords in .env.e2e are readable from the web. Deny access to .env* files')}`,
      ` ${red('in the web server config, e.g. Apache: <FilesMatch "^\\.env"> Require all denied </FilesMatch>')}`
    )
  }
  return lines
}

function listPrompt() {
  const suite = state.suite
  switch (stepId()) {
    case 'suite':
      return 'Which test suite?'
    case 'install':
      return 'Installation to test against'
    case 'modules': {
      const n = picksFor(suite).modules.size
      return `Modules to test  ${dim(`${n} of ${suiteModules(suite).length} selected`)}`
    }
    case 'browsers':
      return `Browsers / devices  ${dim(`${selectedBrowsers(suite).length} selected`)}`
    default:
      return 'How to run?'
  }
}

/** Lines shown under the list for the current step / item. */
function listExtras(items) {
  const current = items[state.cursor] || {}
  const lines = []
  if (state.editing) {
    const width = Math.max(20, screenSize().cols - 10)
    lines.push('', ` ${bold('URL')} ${cyan('›')} ${renderEditor(state.editing, width)}`)
    if (state.suite.id === 'mobile') {
      lines.push(dim('   ?mobile-version is added when missing'))
    }
    return lines
  }
  if (current.details) {
    lines.push('', ...current.details.map((line) => ` ${yellow(line)}`))
  }
  if (stepId() === 'suite') {
    const suite = SUITES.find((s) => s.id === current.id)
    if (suite && readEnvFile(suite.envFile)) {
      lines.push('', ...renderWebChecks(suite, defaultInstall(suite).url))
    }
  }
  return lines
}

function renderList(maxRows) {
  const items = stepItems()
  const multi = isMultiSelect()
  const below = listExtras(items)
  const lines = [` ${bold(listPrompt())}`, '']
  const room = Math.max(3, maxRows - lines.length - below.length)

  if (state.cursor < state.offset) {
    state.offset = state.cursor
  } else if (state.cursor >= state.offset + room) {
    state.offset = state.cursor - room + 1
  }

  const labelWidth = Math.max(...items.map((i) => i.label.length), 8) + 2
  const visible = items.slice(state.offset, state.offset + room)
  visible.forEach((item, idx) => {
    const index = state.offset + idx
    const active = index === state.cursor
    let mark
    if (multi) {
      mark = item.on ? green('[x]') : '[ ]'
    } else {
      mark = item.on ? green('(*)') : '( )'
    }
    if (item.disabled) {
      mark = dim(multi ? '[-]' : '(-)')
    }
    const pointer = active ? cyan('›') : ' '
    let label = item.label.padEnd(labelWidth)
    label = item.disabled ? dim(label) : active ? bold(label) : label
    const hint = item.disabled ? yellow(item.hint) : dim(item.hint || '')
    lines.push(` ${pointer} ${mark} ${label}${hint}`)
  })

  if (state.offset > 0) {
    lines[2] += dim(`   ↑ ${state.offset} more`)
  }
  const hidden = items.length - state.offset - visible.length
  if (hidden > 0) {
    lines[lines.length - 1] += dim(`   ↓ ${hidden} more`)
  }
  return [...lines, ...below]
}

function renderConfirm() {
  const { cols } = screenSize()
  const { modules, browsers } = buildSetup()
  const all = suiteModules(state.suite)
  const width = Math.max(30, cols - 15)
  const pad = ' '.repeat(15)
  const url = picksFor(state.suite).url
  const moduleText =
    modules.length === all.length ? `all (${all.length})` : modules.join(', ')

  const lines = [
    ` ${bold('Ready to run')}`,
    '',
    ` ${dim('Suite')}         ${state.suite.label}`,
    ` ${dim('Installation')}  ${displayUrl(url)}`,
    ...wrap(moduleText, width, pad).map((l, i) => (i === 0 ? ` ${dim('Modules')}       ${l}` : l)),
    ` ${dim('Browsers')}      ${browsers.join(', ')}`,
    ` ${dim('Mode')}          ${state.mode.label}`,
  ]
  if (extraArgs.length) {
    lines.push(` ${dim('Extra args')}    ${extraArgs.map(quoteArg).join(' ')}`)
  }
  lines.push('', ` ${dim('Command')}`, `   ${cyan(describeCommand(buildTestCommand()))}`)
  lines.push('', ...renderWebChecks(state.suite, url))
  return lines
}

function footerKeys() {
  const back = state.step > 0 ? '  Esc back' : ''
  if (state.editing) {
    return 'Type the URL  ←→ move  Ctrl+U clear  Enter accept  Esc cancel'
  }
  switch (stepId()) {
    case 'suite':
      return '↑↓ move  Enter select  E edit .env.e2e  Q quit'
    case 'modules':
      return `↑↓ move  Space toggle  A all/none  Enter next${back}  Q quit`
    case 'browsers':
      return `↑↓ move  Space toggle  A all/none  I install browsers  Enter next${back}  Q quit`
    case 'confirm':
      return `Enter run${back}  Q quit`
    default:
      return `↑↓ move  Enter select${back}  Q quit`
  }
}

// --- Fix screen --------------------------------------------------------------

function openFix(suite) {
  state.screen = 'fix'
  state.fix = { suite, cursor: 0 }
}

function fixItems() {
  const suite = state.fix.suite
  const present = new Set(suiteProblems(suite).map((p) => p.fix).filter(Boolean))
  const items = ['npm', 'browsers', 'env']
    .filter((fix) => present.has(fix))
    .map((fix) => ({ id: fix, label: FIXES[fix] }))
  items.push({ id: 'back', label: 'Back' })
  return items
}

function renderFix() {
  const suite = state.fix.suite
  const problems = suiteProblems(suite)
  const lines = [
    `${bold(' Aurora E2E')}  ${dim(`${suite.label} · setup`)}`,
    hr(),
    ` ${bold(`${suite.label} tests need to be set up`)}`,
    '',
    ...problems.map((p) => ` ${yellow('•')} ${p.text}`),
    '',
  ]
  fixItems().forEach((item, i) => {
    const active = i === state.fix.cursor
    lines.push(` ${active ? cyan('›') : ' '} ${active ? bold(item.label) : item.label}`)
  })
  if (problems.some((p) => !p.fix)) {
    lines.push('', ` ${dim(`Other items: see ${relToRoot(suite.readme)}`)}`)
  }
  return lines
}

function onFixKey(str, key) {
  const items = fixItems()
  const name = key.name || str
  if (name === 'up' || name === 'k') {
    state.fix.cursor = Math.max(0, state.fix.cursor - 1)
  } else if (name === 'down' || name === 'j') {
    state.fix.cursor = Math.min(items.length - 1, state.fix.cursor + 1)
  } else if (name === 'escape' || name === 'left') {
    goStep(0)
  } else if (name === 'q') {
    quit(0)
  } else if (name === 'return' || name === 'enter') {
    const item = items[state.fix.cursor]
    if (item.id === 'back') {
      goStep(0)
    } else if (item.id === 'env') {
      openWizard(state.fix.suite)
    } else {
      runFix(item.id)
    }
  }
}

function runFix(fix) {
  if (fix === 'npm') {
    runTask('npm install (install root)', {
      command: 'npm',
      args: ['install'],
      cwd: auroraRoot,
      shell: process.platform === 'win32',
    })
  } else {
    const note =
      process.platform === 'linux'
        ? 'If a browser fails to start, install its system libraries: sudo npx playwright install-deps'
        : ''
    runTask(
      'Install Playwright browsers',
      {
        command: process.execPath,
        args: [path.join(desktopScripts, 'playwright-cli.js'), 'install', ...BROWSER_ENGINES],
        cwd: coreRoot,
      },
      note
    )
  }
}

// --- .env.e2e wizard ---------------------------------------------------------

/** Value for `key` from the other suite's .env.e2e, if it is set there. */
function otherSuiteValue(suite, key) {
  const other = SUITES.find((s) => s !== suite)
  const values = envFile.readEnv(other.envFile)
  if (!values) {
    return null
  }
  const ours = suite.id === 'desktop' ? 0 : 1
  const pair = RENAMED_KEYS.find((p) => p[ours] === key)
  const otherKey = pair ? pair[1 - ours] : SHARED_KEYS.includes(key) ? key : null
  let value = otherKey && values[otherKey]
  if (!value || envFile.isPlaceholder(value)) {
    return null
  }
  if (key === 'PLAYWRIGHT_BASE_URL') {
    try {
      value = suite.id === 'mobile' ? normalizeUrl(value, suite) : installBase(value)
    } catch {
      return null
    }
  }
  return value ? { value, source: `from ${other.label} .env.e2e` } : null
}

/**
 * Walks every template field; the input is prefilled with the default
 * (current .env.e2e → other suite → template), so Enter keeps it.
 */
function openWizard(suite) {
  const templateText = fs.readFileSync(suite.envTemplate, 'utf8')
  const fields = envFile.templateFields(templateText)
  const previous = envFile.readEnv(suite.envFile)
  const values = {}
  const sources = {}
  for (const field of fields) {
    const fromOther = otherSuiteValue(suite, field.key)
    if (previous && field.key in previous) {
      values[field.key] = previous[field.key]
      sources[field.key] = 'current .env.e2e'
    } else if (fromOther) {
      values[field.key] = fromOther.value
      sources[field.key] = fromOther.source
    } else {
      values[field.key] = field.templateValue
      sources[field.key] = field.templateValue ? 'template' : ''
    }
  }
  state.wizard = {
    suite,
    templateText,
    fields,
    previous,
    values,
    sources,
    index: 0,
    review: false,
    reviewCursor: 0,
    backToReview: false,
    editor: createEditor(values[fields[0].key]),
    error: '',
    returnTo: { screen: state.screen, step: state.step },
  }
  state.screen = 'wizard'
}

function wizardField() {
  const w = state.wizard
  return w.fields[w.index]
}

function editField(index) {
  const w = state.wizard
  w.index = index
  w.review = false
  w.error = ''
  w.editor = createEditor(w.values[w.fields[index].key])
}

function closeWizard(message) {
  const { returnTo } = state.wizard
  state.wizard = null
  resetChecks()
  if (returnTo.screen === 'fix' && suiteProblems(state.fix.suite).length) {
    state.screen = 'fix'
    state.fix.cursor = 0
  } else {
    goStep(returnTo.screen === 'fix' ? 0 : returnTo.step)
  }
  state.message = message || ''
}

function acceptField() {
  const w = state.wizard
  const field = wizardField()
  let value = w.editor.text.trim()
  if (value && field.key === 'PLAYWRIGHT_BASE_URL') {
    const normalized = normalizeUrl(value, w.suite)
    if (!normalized) {
      w.error = 'must be a full http:// or https:// URL'
      return
    }
    value = normalized
  }
  if (!value && w.suite.requiredEnv.includes(field.key)) {
    w.error = 'required'
    return
  }
  const error = envFile.validate(field.key, value)
  if (error) {
    w.error = error
    return
  }
  w.values[field.key] = value
  if (w.backToReview || w.index === w.fields.length - 1) {
    w.review = true
    w.reviewCursor = w.index
    w.backToReview = false
  } else {
    editField(w.index + 1)
  }
}

function saveWizard() {
  const w = state.wizard
  const text = envFile.buildEnvText(w.templateText, w.fields, w.values, w.previous)
  try {
    fs.writeFileSync(w.suite.envFile, text)
  } catch (err) {
    state.message = `Could not save: ${err.message}`
    return
  }
  closeWizard(`Saved ${relToRoot(w.suite.envFile)}`)
}

function onWizardKey(str, key) {
  const w = state.wizard
  const name = key.name || str
  if (w.review) {
    if (name === 'up' || name === 'k') {
      w.reviewCursor = Math.max(0, w.reviewCursor - 1)
    } else if (name === 'down' || name === 'j') {
      w.reviewCursor = Math.min(w.fields.length - 1, w.reviewCursor + 1)
    } else if (name === 'pageup') {
      w.reviewCursor = Math.max(0, w.reviewCursor - 10)
    } else if (name === 'pagedown') {
      w.reviewCursor = Math.min(w.fields.length - 1, w.reviewCursor + 10)
    } else if (name === 'return' || name === 'enter') {
      editField(w.reviewCursor)
      w.backToReview = true
    } else if (name === 's') {
      saveWizard()
    } else if (name === 'escape') {
      editField(w.fields.length - 1)
    } else if (name === 'q') {
      closeWizard('.env.e2e setup cancelled — nothing saved.')
    }
    return
  }
  w.error = ''
  const action = editKey(w.editor, str, key)
  if (action === 'accept') {
    acceptField()
  } else if (action === 'cancel') {
    if (w.backToReview) {
      w.review = true
      w.backToReview = false
    } else if (w.index > 0) {
      editField(w.index - 1)
    } else {
      closeWizard('.env.e2e setup cancelled — nothing saved.')
    }
  } else if (name === 'up' || name === 'down') {
    // Up/Down move between fields, keeping what was typed.
    const target = w.index + (name === 'up' ? -1 : 1)
    if (target >= 0 && target < w.fields.length) {
      w.values[wizardField().key] = w.editor.text.trim()
      editField(target)
    }
  }
}

function renderWizardField(maxRows) {
  const w = state.wizard
  const field = wizardField()
  const { cols } = screenSize()
  const width = Math.max(30, cols - 4)
  const text = w.editor.text.trim()
  const lines = [
    `${bold(' Aurora E2E')}  ${dim(`${w.suite.label} · ${relToRoot(w.suite.envFile)}`)}`,
    ` ${dim(`Field ${w.index + 1} of ${w.fields.length}`)}  ${progressBar(w.index, w.fields.length)}`,
    hr(),
  ]
  if (field.section) {
    lines.push(` ${cyan(field.section)}`)
  }
  field.description.forEach((d) => wrap(d, width).forEach((l) => lines.push(` ${dim(l)}`)))
  lines.push('')

  let tag = ''
  if (w.suite.requiredEnv.includes(field.key)) {
    tag = yellow(' required')
  } else if (field.optional) {
    tag = dim(' optional · empty keeps it commented out')
  }
  lines.push(` ${bold(field.key)}${tag}`)
  lines.push(` ${cyan('›')} ${renderEditor(w.editor, Math.max(20, cols - 4))}`)

  const notes = []
  if (w.sources[field.key]) {
    notes.push(`default ${w.sources[field.key]}`)
  }
  if (field.example && field.example !== text) {
    notes.push(`e.g. ${field.example}`)
  }
  if (notes.length) {
    lines.push(`   ${dim(notes.join(' · '))}`)
  }
  if (envFile.isPlaceholder(text)) {
    lines.push(`   ${yellow('template example — replace it with a real value')}`)
  }
  if (w.error) {
    lines.push(`   ${red(w.error)}`)
  }
  return lines.slice(0, maxRows)
}

function progressBar(done, total) {
  const width = 20
  const filled = Math.round((done / total) * width)
  return cyan('█'.repeat(filled)) + dim('░'.repeat(width - filled))
}

function renderWizardReview(maxRows) {
  const w = state.wizard
  const lines = [
    `${bold(' Aurora E2E')}  ${dim(`${w.suite.label} · ${relToRoot(w.suite.envFile)}`)}`,
    ` ${bold('Review and save')}  ${dim(`${w.fields.length} fields`)}`,
    hr(),
  ]
  const room = Math.max(3, maxRows - lines.length)
  const start = Math.max(
    0,
    Math.min(w.reviewCursor - Math.floor(room / 2), w.fields.length - room)
  )
  const keyWidth = Math.max(...w.fields.map((f) => f.key.length)) + 2
  w.fields.slice(start, start + room).forEach((field, i) => {
    const index = start + i
    const active = index === w.reviewCursor
    const value = w.values[field.key]
    let shown
    if (value === '') {
      shown = dim(field.optional ? '(commented out)' : '(empty)')
    } else if (envFile.isPlaceholder(value)) {
      shown = yellow(`${value}  ← template example`)
    } else {
      shown = value
    }
    const label = field.key.padEnd(keyWidth)
    lines.push(` ${active ? cyan('›') : ' '} ${active ? bold(label) : label}${shown}`)
  })
  return lines
}

function wizardFooter() {
  const w = state.wizard
  if (w.review) {
    return '↑↓ move  Enter edit  S save  Esc last field  Q cancel'
  }
  const back = w.backToReview ? 'Esc review' : w.index > 0 ? 'Esc previous' : 'Esc cancel'
  return `Enter next  ${back}  ↑↓ fields  ←→ cursor  Ctrl+U clear`
}

// --- Screen / process control ------------------------------------------------

function render() {
  if (state.phase !== 'menu') {
    return
  }
  const { rows } = screenSize()
  let footer
  let body
  if (state.screen === 'wizard') {
    footer = [hr(), ` ${dim(wizardFooter())}`]
  } else if (state.screen === 'fix') {
    footer = [hr(), ` ${dim('↑↓ move  Enter select  Esc back  Q quit')}`]
  } else {
    footer = [hr(), ` ${dim(footerKeys())}`]
  }
  if (state.message) {
    footer.unshift(` ${yellow(state.message)}`)
  }
  const bodyRows = rows - footer.length - 1

  if (state.screen === 'wizard') {
    body = state.wizard.review ? renderWizardReview(bodyRows) : renderWizardField(bodyRows)
  } else if (state.screen === 'fix') {
    body = renderFix()
  } else {
    const header = renderHeader()
    const rest = stepId() === 'confirm' ? renderConfirm() : renderList(bodyRows - header.length)
    body = [...header, ...rest]
  }

  const lines = body.slice(0, bodyRows)
  while (lines.length < rows - footer.length) {
    lines.push('')
  }
  lines.push(...footer)
  process.stdout.write(
    `${ESC}H${lines.slice(0, rows).map((l) => `${l}${ESC}K`).join('\n')}${ESC}J`
  )
}

function enterScreen() {
  resetChecks()
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdout.write(ALT_SCREEN_ON + CURSOR_HIDE)
  state.phase = 'menu'
  // Re-validate where we are: something may have been fixed or broken.
  if (state.screen === 'fix' && !suiteProblems(state.fix.suite).length) {
    state.suite = state.fix.suite
    goStep(0)
    state.message = `${state.suite.label} tests are ready.`
  } else if (state.screen === 'steps' && state.step > 0 && suiteProblems(state.suite).length) {
    goStep(0)
  }
  render()
}

function leaveScreen() {
  process.stdout.write(`${ESC}2J${ESC}H${CURSOR_SHOW}${ALT_SCREEN_OFF}`)
  process.stdin.setRawMode(false)
  process.stdin.pause()
}

function quit(code) {
  saveState()
  if (state.phase === 'menu') {
    leaveScreen()
  } else {
    process.stdin.setRawMode(false)
  }
  process.exit(code)
}

/** Run a child with inherited stdio; Ctrl+C stops the child, not the launcher. */
function runChild({ command, args, cwd, env, shell }) {
  const ignore = () => {}
  process.on('SIGINT', ignore)
  const result = spawnSync(command, args, { cwd, env, shell, stdio: 'inherit' })
  process.removeListener('SIGINT', ignore)
  if (result.error) {
    console.error(red(result.error.message))
    return 1
  }
  return result.status === null ? 1 : result.status
}

function afterRunPrompt() {
  const { kind, status } = state.lastRun
  console.log('')
  console.log(hr())
  if (status === 0) {
    console.log(green(bold(kind === 'tests' ? ' ✔ Passed' : ' ✔ Done')))
  } else {
    console.log(red(bold(` ✖ Finished with exit code ${status}`)))
  }
  const report = kind === 'tests' && state.mode.id !== 'ui' ? '  R open HTML report' : ''
  console.log(dim(` Enter back to launcher${report}  Q quit`))
  state.phase = 'after-run'
  process.stdin.setRawMode(true)
  process.stdin.resume()
}

function runTests() {
  saveState()
  const command = buildTestCommand()
  leaveScreen()
  console.log(bold(`▶ ${state.suite.label} E2E`))
  console.log(dim(`  installation: ${displayUrl(picksFor(state.suite).url)}`))
  console.log(dim(`  cwd: ${command.cwd}`))
  console.log(cyan(`  ${describeCommand(command)}`))
  console.log('')
  state.phase = 'running'
  state.lastRun = { kind: 'tests', status: runChild(command) }
  afterRunPrompt()
}

function runTask(title, command, note = '') {
  leaveScreen()
  console.log(bold(`▶ ${title}`))
  console.log(dim(`  cwd: ${command.cwd}`))
  console.log('')
  state.phase = 'running'
  state.lastRun = { kind: 'task', status: runChild(command) }
  if (note) {
    console.log(dim(`\n${note}`))
  }
  afterRunPrompt()
}

function showReport() {
  process.stdin.setRawMode(false)
  process.stdin.pause()
  state.phase = 'running'
  console.log(dim('\nServing the HTML report — press Ctrl+C to stop.\n'))
  runChild({
    command: process.execPath,
    args: state.suite.reportArgs(),
    cwd: state.suite.cwd,
    env: process.env,
  })
  afterRunPrompt()
}

// --- Keys --------------------------------------------------------------------

function selectUrl(url) {
  const picks = picksFor(state.suite)
  picks.url = url
  if (url !== defaultInstall(state.suite).url) {
    picks.urls = [url, ...picks.urls.filter((u) => u !== url)].slice(0, URL_HISTORY_SIZE)
  }
}

function next() {
  const items = stepItems()
  const item = items[state.cursor]
  switch (stepId()) {
    case 'suite': {
      const suite = SUITES.find((s) => s.id === item.id)
      if (item.disabled) {
        if (suiteProblems(suite).some((p) => p.fix)) {
          openFix(suite)
        } else {
          state.message = `${item.label} is not available — see the details.`
        }
        return
      }
      state.suite = suite
      break
    }
    case 'install':
      if (item.id === '') {
        state.editing = createEditor()
        return
      }
      selectUrl(item.id)
      break
    case 'modules':
      if (picksFor(state.suite).modules.size === 0) {
        state.message = 'Select at least one module.'
        return
      }
      break
    case 'browsers':
      if (selectedBrowsers(state.suite).length === 0) {
        state.message = 'Select at least one browser.'
        return
      }
      break
    case 'mode':
      if (item.disabled) {
        if (fs.existsSync(state.suite.envTemplate)) {
          openWizard(state.suite)
        } else {
          state.message = `${item.label} is not available — see the details.`
        }
        return
      }
      state.mode = MODES.find((m) => m.id === item.id)
      break
    case 'confirm':
      runTests()
      return
  }
  goStep(state.step + 1)
}

function toggle(all) {
  const picks = picksFor(state.suite)
  const set = stepId() === 'modules' ? picks.modules : picks.browsers
  const items = stepItems().filter((i) => !i.disabled)
  if (all) {
    const everything = items.every((i) => i.on)
    items.forEach((i) => (everything ? set.delete(i.id) : set.add(i.id)))
    return
  }
  const item = stepItems()[state.cursor]
  if (item.disabled) {
    state.message = `${item.label} is not available — see the details.`
  } else if (set.has(item.id)) {
    set.delete(item.id)
  } else {
    set.add(item.id)
  }
}

function forgetUrl() {
  const item = stepItems()[state.cursor]
  if (stepId() !== 'install' || !item.history) {
    return
  }
  const picks = picksFor(state.suite)
  picks.urls = picks.urls.filter((u) => u !== item.id)
  if (picks.url === item.id) {
    picks.url = defaultInstall(state.suite).url
  }
  moveCursor(0)
}

function moveCursor(delta) {
  const count = stepItems().length
  if (count === 0) {
    return
  }
  state.cursor = Math.max(0, Math.min(count - 1, state.cursor + delta))
}

function onUrlEditKey(str, key) {
  const action = editKey(state.editing, str, key)
  if (action === 'accept') {
    const url = normalizeUrl(state.editing.text, state.suite)
    if (!url) {
      state.message = 'Enter a full http:// or https:// URL.'
      return
    }
    selectUrl(url)
    goStep(state.step + 1)
  } else if (action === 'cancel') {
    state.editing = null
  }
}

function onStepsKey(str, key) {
  const name = key.name || str
  if (state.editing) {
    onUrlEditKey(str, key)
    return
  }
  const page = Math.max(1, screenSize().rows - 10)

  if (name === 'q') {
    quit(0)
  } else if (name === 'up' || name === 'k') {
    moveCursor(-1)
  } else if (name === 'down' || name === 'j') {
    moveCursor(1)
  } else if (name === 'pageup') {
    moveCursor(-page)
  } else if (name === 'pagedown') {
    moveCursor(page)
  } else if (name === 'home') {
    moveCursor(-Infinity)
  } else if (name === 'end') {
    moveCursor(Infinity)
  } else if (name === 'space' && isMultiSelect()) {
    toggle(false)
  } else if (name === 'a' && isMultiSelect()) {
    toggle(true)
  } else if ((name === 'd' || name === 'delete') && stepId() === 'install') {
    forgetUrl()
  } else if (name === 'e' && stepId() === 'suite') {
    const suite = SUITES.find((s) => s.id === stepItems()[state.cursor].id)
    if (fs.existsSync(suite.envTemplate)) {
      openWizard(suite)
    } else {
      state.message = `${relToRoot(suite.envTemplate)} not found.`
    }
  } else if (name === 'i' && stepId() === 'browsers') {
    runFix('browsers')
  } else if (name === 'return' || name === 'enter' || name === 'right' || (name === 'space' && !isMultiSelect())) {
    next()
  } else if (name === 'escape' || name === 'backspace' || name === 'left') {
    goStep(state.step - 1)
  }
}

function onMenuKey(str, key) {
  state.message = ''
  if (state.screen === 'wizard') {
    onWizardKey(str, key)
  } else if (state.screen === 'fix') {
    onFixKey(str, key)
  } else {
    onStepsKey(str, key)
  }
  render()
}

function onAfterRunKey(str, key) {
  const name = key.name || str
  if (name === 'q' || name === 'escape') {
    quit(state.lastRun.status || 0)
  } else if (name === 'r' && state.lastRun.kind === 'tests' && state.mode.id !== 'ui') {
    showReport()
  } else if (name === 'return' || name === 'enter') {
    enterScreen()
  }
}

function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const script = path.relative(process.cwd(), __filename).split(path.sep).join('/')
    console.error('The E2E launcher needs an interactive terminal.')
    if (process.env.MSYSTEM) {
      console.error(`Git Bash (mintty): run \`winpty node ${script}\`,`)
      console.error('or use Windows Terminal / PowerShell.')
    }
    process.exit(1)
  }

  readline.emitKeypressEvents(process.stdin)
  process.stdin.on('keypress', (str, key = {}) => {
    if (key.ctrl && key.name === 'c') {
      quit(state.phase === 'after-run' ? state.lastRun.status || 0 : 130)
    } else if (state.phase === 'menu') {
      onMenuKey(str, key)
    } else if (state.phase === 'after-run') {
      onAfterRunKey(str, key)
    }
  })
  process.stdout.on('resize', render)
  process.on('exit', () => process.stdout.write(CURSOR_SHOW))

  // Start on the first ready suite; unavailable saved choices fall back.
  if (suiteProblems(state.suite).length) {
    state.suite = SUITES.find((s) => !suiteProblems(s).length) || state.suite
  }
  if (modeProblems(state.mode).length) {
    state.mode = MODES[0]
  }
  goStep(0)
  enterScreen()
}

main()
