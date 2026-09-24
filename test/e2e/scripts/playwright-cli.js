#!/usr/bin/env node
/**
 * Spawn Playwright CLI from the Aurora install-root node_modules.
 * Usage (cwd = modules/CoreWebclient):
 *   node test/e2e/scripts/playwright-cli.js show-report test/e2e/playwright-report
 *   node test/e2e/scripts/playwright-cli.js install chromium firefox webkit
 */

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { stripLoopbackProxyEnv } = require('./strip-loopback-proxy')

const coreRoot = path.join(__dirname, '..', '..', '..')
const auroraRoot = path.join(coreRoot, '..', '..')
const nodeModules = path.join(auroraRoot, 'node_modules')
// Run the CLI script with node rather than the .bin shim: on Windows the
// playwright.cmd shim needs a shell, which splits "--project=Module · Chrome".
const playwrightCli = path.join(nodeModules, '@playwright', 'test', 'cli.js')

if (!fs.existsSync(playwrightCli)) {
  console.error(
    `Playwright not found at ${path.join(nodeModules, '@playwright/test')}`
  )
  console.error('From Aurora install root run: npm install')
  process.exit(1)
}

const env = stripLoopbackProxyEnv({ ...process.env })
if (
  env.PLAYWRIGHT_BROWSERS_PATH &&
  /cursor-sandbox-cache/i.test(env.PLAYWRIGHT_BROWSERS_PATH)
) {
  delete env.PLAYWRIGHT_BROWSERS_PATH
}
env.NODE_PATH = env.NODE_PATH
  ? `${nodeModules}${path.delimiter}${env.NODE_PATH}`
  : nodeModules

const result = spawnSync(process.execPath, [playwrightCli, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status === null ? 1 : result.status)
