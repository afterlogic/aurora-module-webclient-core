const { test, expect } = require('@playwright/test')
const {
  hasCredentials,
  getTestCredentials,
  getComposeTo,
} = require('./credentials')
const { initVariant, sel, navId, isSPA, isTraditional } = require('./app-variant')

/** Named step: shows in console + HTML report. */
async function step(title, fn) {
  console.log(`  → ${title}`)
  return test.step(title, fn)
}

/** Attach a PNG to the HTML report (visible under the test / step). */
async function attachScreenshot(page, name) {
  // fullPage waits for layout → can hang on slow font loading (Vite dev server).
  // Use an explicit 30 s timeout; fall back to viewport screenshot on timeout.
  let body
  try {
    body = await page.screenshot({ fullPage: true, timeout: 30000 })
  } catch {
    body = await page.screenshot({ timeout: 10000 })
  }
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
 *
 * Works for both:
 *   desktop — form-submit → page reload → waitForNavigation
 *   next    — AJAX auth → may reload or SPA-transition
 */
async function loginAsTestUser(page) {
  const { login, password } = getTestCredentials()

  await step('Open desktop login page (clean session)', async () => {
    await page.context().clearCookies()
    // '' = baseURL itself (safe for subdirectory installs; '/' would go to host root)
    await page.goto('', { waitUntil: 'domcontentloaded' })

    // Detect which variant we are talking to (once per worker).
    await initVariant(page)

    // Vite dev server may return a blank page on cold start — short probe first.
    const appeared = await page
      .getByTestId(sel('loginEmail'))
      .waitFor({ state: 'visible', timeout: isSPA() ? 8000 : 30000 })
      .then(() => true)
      .catch(() => false)

    if (!appeared) {
      console.log('  → login page blank, retrying goto…')
      await page.goto('', { waitUntil: 'domcontentloaded' })
      await page.getByTestId(sel('loginEmail')).waitFor({
        state: 'visible',
        timeout: 30000,
      })
    }

    await attachScreenshot(page, 'login-form')
  })

  await step('Wait for Turnstile token (if present)', async () => {
    await waitForTurnstileToken(page)
  })

  await step(`Fill credentials (${login})`, async () => {
    await fieldControl(page, sel('loginEmail')).fill(login)
    await fieldControl(page, sel('loginPassword')).fill(password)
    await waitForTurnstileToken(page)
  })

  await step('Submit login form', async () => {
    await expect(page.getByTestId(sel('loginSubmit'))).toBeEnabled({
      timeout: 10000,
    })

    // Always race click + waitForNavigation.
    //   desktop — form submit always navigates.
    //   next    — may reload after AJAX auth, or may SPA-transition.
    //   .catch(() => null) makes navigation-wait non-fatal for SPA.
    await Promise.all([
      page
        .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 })
        .catch(() => null),
      page.getByTestId(sel('loginSubmit')).click(),
    ])

    // Give the SPA a moment to start the transition.
    if (isSPA()) {
      await page.waitForTimeout(500)
    }
  })

  await step('Wait for app shell after login', async () => {
    const header = sel('headerTabs')

    // Wait for header tabs (or its equivalent).
    await page.getByTestId(header).waitFor({
      state: 'visible',
      timeout: 45000,
    })

    // Confirm login form is gone.
    await expect(page.getByTestId(sel('loginEmail'))).not.toBeVisible({
      timeout: 15000,
    })

    if (isTraditional()) {
      // Desktop: nav-mail proves the full shell is ready.
      await expect(page.getByTestId(navId('mail'))).toBeVisible({
        timeout: 30000,
      })
    }
    // Next / SPA: header-tabs + login-form-gone is sufficient.
    // Mail is the default view → nav-mail is not in the header.

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
