const { test, expect } = require('@playwright/test')
const {
  hasCredentials,
  getTestCredentials,
  getComposeTo,
} = require('./credentials')

/** Named step: shows in console + HTML report. */
async function step(title, fn) {
  console.log(`  → ${title}`)
  return test.step(title, fn)
}

/** Attach a PNG to the HTML report (visible under the test / step). */
async function attachScreenshot(page, name) {
  const body = await page.screenshot({ fullPage: true })
  await test.info().attach(name, { body, contentType: 'image/png' })
  console.log(`  → screenshot: ${name}`)
}

function fieldControl(page, testId) {
  return page.locator(
    `[data-test-id="${testId}"] input, input[data-test-id="${testId}"], textarea[data-test-id="${testId}"]`
  )
}

/**
 * Wait for Cloudflare Turnstile token when the plugin is active.
 * Script loads async — first detect widget/API, then wait for token.
 */
async function waitForTurnstileToken(page) {
  // Give the Turnstile script a short window to appear.
  const appeared = await page
    .waitForFunction(
      () => {
        if (typeof window.turnstile !== 'undefined') return true
        return !!document.querySelector(
          '.cf-turnstile, .turnstile-place-cover, iframe[src*="challenges.cloudflare.com"]'
        )
      },
      { timeout: 8000 }
    )
    .then(() => true)
    .catch(() => false)

  if (!appeared) {
    return
  }

  await page.waitForFunction(
    () => {
      try {
        return !!(window.turnstile && window.turnstile.getResponse())
      } catch (e) {
        return false
      }
    },
    { timeout: 45000 }
  )
}

/**
 * Fresh anonymous session, then login with this worker's account from the pool.
 * Leaves the app on the post-login shell with header nav visible.
 */
async function loginAsTestUser(page) {
  const { login, password } = getTestCredentials()

  await step('Open desktop login page (clean session)', async () => {
    await page.context().clearCookies()
    // '' = baseURL itself (safe for subdirectory installs; '/' would go to host root)
    await page.goto('', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('login-email').waitFor({
      state: 'visible',
      timeout: 30000,
    })
    await attachScreenshot(page, 'login-form')
  })

  await step('Wait for Turnstile token (if present)', async () => {
    await waitForTurnstileToken(page)
  })

  await step(`Fill credentials (${login})`, async () => {
    await fieldControl(page, 'login-email').fill(login)
    await fieldControl(page, 'login-password').fill(password)
    await waitForTurnstileToken(page)
  })

  await step('Submit login form', async () => {
    await expect(page.getByTestId('login-submit')).toBeEnabled({
      timeout: 10000,
    })
    await Promise.all([
      page
        .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 })
        .catch(() => null),
      page.getByTestId('login-submit').click(),
    ])
  })

  await step('Wait for app shell after login', async () => {
    await page.getByTestId('header-tabs').waitFor({
      state: 'visible',
      timeout: 45000,
    })
    await expect(page.getByTestId('login-email')).not.toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByTestId('nav-mail')).toBeVisible({
      timeout: 30000,
    })
    await attachScreenshot(page, 'after-login-shell')
  })
}

module.exports = {
  step,
  attachScreenshot,
  fieldControl,
  waitForTurnstileToken,
  loginAsTestUser,
  hasCredentials,
  getTestCredentials,
  getComposeTo,
}
