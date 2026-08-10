const fs = require('fs')
const path = require('path')
const { test: setup } = require('@playwright/test')
const { sharedHelper } = require(path.join(process.env.AURORA_E2E_ROOT, 'helpers/paths'))
const { loginAsTestUser, hasCredentials } = sharedHelper('login')

const authDir = path.join(process.env.AURORA_E2E_ROOT, '.auth')

/**
 * Runs once per browser engine (see playwright.config.js `dependencies`).
 * Saves cookies + localStorage so module projects can start already logged in
 * via `use.storageState`, instead of every test re-submitting the login form.
 */
setup('authenticate', async ({ page }, testInfo) => {
  setup.skip(!hasCredentials(), 'Set E2E_LOGIN_PRIMARY/E2E_PASSWORD_PRIMARY in .env.e2e')

  await loginAsTestUser(page)

  fs.mkdirSync(authDir, { recursive: true })
  const browserName = testInfo.project.name.replace(/^auth setup · /, '')
  await page.context().storageState({
    path: path.join(authDir, `${browserName}.json`),
  })
})
