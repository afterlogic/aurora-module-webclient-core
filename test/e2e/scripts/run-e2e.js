#!/usr/bin/env node
/**
 * Desktop E2E runner wrapper.
 *
 * Translates --setup "modules browsers" into Playwright --project flags:
 *   --setup "MailWebclient Chrome"
 *   --setup "MailWebclient,ContactsWebclient Chrome,Firefox"
 *
 * Without --setup, all discovered projects run (full matrix).
 */

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const coreRoot = path.join(__dirname, '..', '..', '..')
const e2eRoot = path.join(__dirname, '..')
const auroraRoot = path.join(coreRoot, '..', '..')
const configPath = path.join('test', 'e2e', 'playwright.config.js')

const BROWSERS = ['Chrome', 'Firefox', 'Safari']

const BROWSER_ALIASES = {
  chrome: 'Chrome',
  'desktop chrome': 'Chrome',
  firefox: 'Firefox',
  'desktop firefox': 'Firefox',
  safari: 'Safari',
  'desktop safari': 'Safari',
  webkit: 'Safari',
}

function discoverModules() {
  const modulesRoot = path.join(auroraRoot, 'modules')
  if (!fs.existsSync(modulesRoot)) {
    return []
  }

  return fs
    .readdirSync(modulesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => !/Mobile/i.test(d.name))
    .filter((d) => d.name !== 'CoreWebclient')
    .map((d) => d.name)
    .filter((moduleName) => {
      const testDir = path.join(modulesRoot, moduleName, 'test', 'e2e')
      if (!fs.existsSync(testDir) || !fs.statSync(testDir).isDirectory()) {
        return false
      }
      return fs.readdirSync(testDir).some((f) => f.endsWith('.spec.js'))
    })
    .sort((a, b) => a.localeCompare(b))
}

function splitCsv(value) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function normalizeBrowser(name) {
  const key = name.trim().toLowerCase()
  return BROWSER_ALIASES[key] || name.trim()
}

/**
 * Parse argv: extract --setup / --setup=, return { setup, rest }.
 */
function extractSetup(argv) {
  const rest = []
  let setup = null

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--setup') {
      const next = argv[i + 1]
      if (!next || next.startsWith('-')) {
        throw new Error(
          'Missing value for --setup. Example: --setup "MailWebclient Chrome"'
        )
      }
      setup = next
      i++
      continue
    }
    if (arg.startsWith('--setup=')) {
      setup = arg.slice('--setup='.length)
      continue
    }
    rest.push(arg)
  }

  return { setup, rest }
}

function parseSetupString(setup) {
  const match = setup.trim().match(/^(\S+)\s+(.+)$/)
  if (!match) {
    throw new Error(
      `Invalid --setup value: ${JSON.stringify(setup)}\n` +
        'Expected: "<modules> <browsers>"\n' +
        'Example: --setup "MailWebclient,ContactsWebclient Chrome,Firefox"'
    )
  }

  const modules = splitCsv(match[1])
  const browsers = splitCsv(match[2]).map(normalizeBrowser)

  if (modules.length === 0 || browsers.length === 0) {
    throw new Error(
      'Both modules and browsers are required in --setup "modules browsers"'
    )
  }

  return { modules, browsers }
}

function expandProjects(modules, browsers, knownModules) {
  const unknownModules = modules.filter((m) => !knownModules.includes(m))
  if (unknownModules.length > 0) {
    throw new Error(
      `Unknown module(s): ${unknownModules.join(', ')}\n` +
        `Available: ${knownModules.join(', ') || '(none discovered)'}`
    )
  }

  const unknownBrowsers = browsers.filter((b) => !BROWSERS.includes(b))
  if (unknownBrowsers.length > 0) {
    throw new Error(
      `Unknown browser(s): ${unknownBrowsers.join(', ')}\n` +
        `Available: ${BROWSERS.join(', ')}`
    )
  }

  const projects = []
  for (const moduleName of modules) {
    for (const browser of browsers) {
      projects.push(`${moduleName} · ${browser}`)
    }
  }
  return projects
}

function main() {
  let setup
  let rest
  try {
    ;({ setup, rest } = extractSetup(process.argv.slice(2)))
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }

  const playwrightArgs = ['test', `--config=${configPath}`]

  if (setup) {
    try {
      const knownModules = discoverModules()
      const { modules, browsers } = parseSetupString(setup)
      const projects = expandProjects(modules, browsers, knownModules)
      console.log(`  → --setup → projects: ${projects.join(' | ')}`)
      for (const name of projects) {
        playwrightArgs.push(`--project=${name}`)
      }
    } catch (err) {
      console.error(err.message)
      process.exit(1)
    }
  }

  playwrightArgs.push(...rest)

  const env = { ...process.env }
  const nodeModules = path.join(auroraRoot, 'node_modules')
  env.NODE_PATH = env.NODE_PATH
    ? `${nodeModules}${path.delimiter}${env.NODE_PATH}`
    : nodeModules

  const playwrightBin = path.join(
    nodeModules,
    '.bin',
    process.platform === 'win32' ? 'playwright.cmd' : 'playwright'
  )

  if (!fs.existsSync(playwrightBin)) {
    console.error(
      `Playwright not found at ${path.join(nodeModules, '@playwright/test')}`
    )
    console.error('From Aurora install root run: npm install')
    process.exit(1)
  }

  const result = spawnSync(playwrightBin, playwrightArgs, {
    cwd: coreRoot,
    env,
    stdio: 'inherit',
  })

  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }

  process.exit(result.status === null ? 1 : result.status)
}

main()
