const { test, expect } = require('@playwright/test')
const {
  hasCredentials,
  hasSecondaryCredentials,
  hasReserveCredentials,
  getTestCredentials,
  getPrimaryCredentials,
  getSecondaryCredentials,
  getReserveCredentials,
  getComposeTo,
} = require('./credentials')
const { initVariant, sel, navId } = require('./app-variant')
const { T } = require('./timeouts')
const { clickReady } = require('./ready')

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
    body = await page.screenshot({ fullPage: true, timeout: T(30000) })
  } catch {
    body = await page.screenshot({ timeout: T(10000) })
  }
  await test.info().attach(name, { body, contentType: 'image/png' })
  console.log(`  → screenshot: ${name}`)
}

function fieldControl(page, testId) {
  return page.locator(
    `[data-test-id="${testId}"] input, input[data-test-id="${testId}"], textarea[data-test-id="${testId}"]`
  )
}

const TURNSTILE_MODULE = 'CloudflareTurnstileWebclientPlugin'

/** Mirrors next/src/commons/utils/parseApiResponse.ts (tolerates a non-JSON prefix). */
function parseApiResponseText(text) {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      return null
    }
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

/**
 * Arm a listener for the bootstrap `Core/GetAppdata` response *before*
 * navigating. next/Vue fires this request immediately on app mount
 * (main.ts → loadBootstrapData()) — arming after goto() can miss it.
 * Resolves to null on desktop (no such request) or on timeout.
 */
function armAppDataResponse(page) {
  return page
    .waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        (res.request().postData() || '').includes('Method=GetAppdata'),
      { timeout: 20000 }
    )
    .then((res) => res.text())
    .then(parseApiResponseText)
    .catch(() => null)
}

/**
 * desktop: window.auroraAppData is inlined into the HTML before app.js runs,
 * so Core.AvailableClientModules is already there — read it directly.
 * next/Vue: app data only arrives via the GetAppdata API response (see
 * armAppDataResponse) — window.auroraAppData is never set.
 */
async function isTurnstileModuleActive(page, appDataResponsePromise) {
  const fromWindow = await page.evaluate((moduleName) => {
    const modules = window.auroraAppData?.Core?.AvailableClientModules
    return Array.isArray(modules) ? modules.includes(moduleName) : null
  }, TURNSTILE_MODULE)

  if (fromWindow !== null) {
    return fromWindow
  }

  const appData = appDataResponsePromise ? await appDataResponsePromise : null
  const modules = appData?.Result?.Core?.AvailableClientModules
  return Array.isArray(modules) && modules.includes(TURNSTILE_MODULE)
}

/**
 * Wait for a Cloudflare Turnstile token, but only when the backend reports
 * the plugin as active — otherwise the widget will never load and there is
 * nothing to wait for.
 * Script loads async — first detect widget/API, then wait for token.
 */
async function waitForTurnstileToken(page, appDataResponsePromise) {
  if (!(await isTurnstileModuleActive(page, appDataResponsePromise))) {
    return
  }

  // Give the Turnstile script a short window to appear.
  const appeared = await page
    .waitForFunction(
      () => {
        if (typeof window.turnstile !== 'undefined') return true
        return !!document.querySelector(
          '.cf-turnstile, .turnstile-place-cover, iframe[src*="challenges.cloudflare.com"]'
        )
      },
      // waitForFunction(pageFunction, arg, options) — arg must be explicit or
      // the "options" object is passed as arg instead, silently discarding
      // the timeout and falling back to the default actionTimeout.
      undefined,
      { timeout: T(8000) }
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
    undefined,
    { timeout: T(45000) }
  )
}

/**
 * Fresh anonymous session, then login with the given credentials.
 * Leaves the app on the post-login shell with header nav visible.
 *
 * Works for both:
 *   desktop — form-submit → page reload → waitForNavigation
 *   next    — AJAX auth → may reload or SPA-transition
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ login: string, password: string }} credentials
 */
async function loginAs(page, credentials) {
  const { login, password } = credentials
  if (!login || !password) {
    throw new Error('loginAs requires { login, password }')
  }

  // Must be armed before the first goto() — next/Vue fires GetAppdata
  // immediately on bootstrap, so listening starts before it can fire.
  const appDataResponsePromise = armAppDataResponse(page)

  await step('Open desktop login page (clean session)', async () => {
    await page.context().clearCookies()
    await gotoApp(page)

    // Detect which variant we are talking to (once per worker).
    await initVariant(page)

    // Vite dev server may return a blank page on cold start — short probe first.
    const appeared = await page
      .getByTestId(sel('loginEmail'))
      .waitFor({ state: 'visible', timeout: T(30000) })
      .then(() => true)
      .catch(() => false)

    if (!appeared) {
      console.log('  → login page blank, retrying goto…')
      await gotoApp(page)
      await page.getByTestId(sel('loginEmail')).waitFor({
        state: 'visible',
        timeout: T(30000),
      })
    }

    await attachScreenshot(page, 'login-form')
  })

  await step('Wait for Turnstile token (if present)', async () => {
    await waitForTurnstileToken(page, appDataResponsePromise)
  })

  await step(`Fill credentials (${login})`, async () => {
    await fieldControl(page, sel('loginEmail')).fill(login)
    await fieldControl(page, sel('loginPassword')).fill(password)
    await waitForTurnstileToken(page, appDataResponsePromise)
  })

  await step('Submit login form', async () => {
    await expect(page.getByTestId(sel('loginSubmit'))).toBeEnabled({
      timeout: T(10000),
    })

    // Always race click + waitForNavigation.
    //   desktop — form submit always navigates.
    //   next    — may reload after AJAX auth, or may SPA-transition.
    //   .catch(() => null) makes navigation-wait non-fatal for SPA.
    await Promise.all([
      page
        .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: T(45000) })
        .catch(() => null),
      page.getByTestId(sel('loginSubmit')).click(),
    ])
  })

  await step('Wait for app shell after login', async () => {
    const header = sel('headerTabs')

    try {
      await page.getByTestId(header).waitFor({
        state: 'visible',
        timeout: T(45000),
      })
    } catch (err) {
      const uiError = (
        await page
          .locator('.error, .report, .login_error, .alert, .notification')
          .first()
          .innerText()
          .catch(() => '')
      ).trim()
      throw new Error(
        `Login as ${login} did not reach the app shell. URL: ${page.url()}${
          uiError ? ` UI: ${uiError}` : ''
        }`
      )
    }

    // Confirm login form is gone.
    await expect(page.getByTestId(sel('loginEmail'))).not.toBeVisible({
      timeout: T(15000),
    })

    await expect(page.getByTestId(navId('mail'))).toBeVisible({
      timeout: T(30000),
    })

    await attachScreenshot(page, 'after-login-shell')
  })
}

/** Login as PRIMARY (default account for most specs). */
async function loginAsTestUser(page) {
  await loginAs(page, getPrimaryCredentials())
}

async function loginAsSecondary(page) {
  await loginAs(page, getSecondaryCredentials())
}

async function loginAsReserve(page) {
  await loginAs(page, getReserveCredentials())
}

/** Logout via header control and wait for the login form. */
async function logoutToLoginForm(page) {
  await step('Logout to login form', async () => {
    await clickReady(page.getByTestId('settings-logout'))
    await expect(page.getByTestId(sel('loginEmail'))).toBeVisible({
      timeout: T(30000),
    })
  })
}

/**
 * Switch account in one scenario: logout (if shell visible) then loginAs.
 */
async function switchToUser(page, credentials) {
  const onLogin = await page
    .getByTestId(sel('loginEmail'))
    .isVisible()
    .catch(() => false)
  if (!onLogin) {
    await logoutToLoginForm(page)
  }
  await loginAs(page, credentials)
}

async function switchToSecondary(page) {
  await switchToUser(page, getSecondaryCredentials())
}

async function switchToPrimary(page) {
  await switchToUser(page, getPrimaryCredentials())
}

/**
 * Fresh browser context (no PRIMARY storageState) + login.
 * Use for SECONDARY/RESERVE in the same test as PRIMARY — logout+relogin
 * on the authenticated context races Turnstile and leftover session state.
 *
 * Caller must close `context` (e.g. in `finally`).
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {{ login: string, password: string }} credentials
 * @param {{ baseURL: string }} options
 * @returns {Promise<{ context: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page }>}
 */
async function openLoggedInPage(browser, credentials, { baseURL }) {
  const context = await browser.newContext({
    baseURL,
    testIdAttribute: 'data-test-id',
    storageState: { cookies: [], origins: [] },
  })
  const page = await context.newPage()
  await loginAs(page, credentials)
  return { context, page }
}

/**
 * Navigate to baseURL with a remote-staging-friendly budget.
 * Remote hosts can exceed the default 45s navigationTimeout; retry once on
 * timeout before failing (same mitigation as the blank-login-page retry).
 */
async function gotoApp(page) {
  const gotoOpts = { waitUntil: 'domcontentloaded', timeout: T(90000) }
  try {
    // '' = baseURL itself (safe for subdirectory installs; '/' would go to host root)
    await page.goto('', gotoOpts)
  } catch (err) {
    if (!/Timeout.*exceeded/i.test(String(err))) {
      throw err
    }
    console.log('  → goto slow/failed, retrying…')
    await page.goto('', gotoOpts)
  }
}

async function isOnLoginPage(page) {
  return page
    .getByTestId(sel('loginEmail'))
    .or(page.getByRole('button', { name: /sign in/i }))
    .first()
    .isVisible()
    .catch(() => false)
}

/**
 * Open the app on a context that already carries an authenticated
 * storageState (see StandardLoginFormWebclient/test/e2e/auth.setup.js). If the session is missing or stale
 * (login form), sign in as PRIMARY instead of waiting for the shell.
 */
async function gotoLoggedIn(page) {
  await step('Open app (reuse authenticated session)', async () => {
    await gotoApp(page)

    const header = page.getByTestId(sel('headerTabs'))
    const loginEmail = page.getByTestId(sel('loginEmail'))

    await Promise.race([
      header.waitFor({ state: 'visible', timeout: T(15000) }).catch(() => null),
      loginEmail.waitFor({ state: 'visible', timeout: T(15000) }).catch(() => null),
    ])

    if (await isOnLoginPage(page)) {
      console.log('  → no session (login form), signing in as PRIMARY')
      await loginAs(page, getPrimaryCredentials())
      return
    }

    await header.waitFor({
      state: 'visible',
      timeout: T(60000),
    })

    await expect(page.getByTestId(navId('mail'))).toBeVisible({
      timeout: T(30000),
    })
  })
}

module.exports = {
  step,
  attachScreenshot,
  fieldControl,
  waitForTurnstileToken,
  loginAs,
  loginAsTestUser,
  gotoLoggedIn,
  loginAsSecondary,
  loginAsReserve,
  logoutToLoginForm,
  switchToUser,
  switchToSecondary,
  switchToPrimary,
  openLoggedInPage,
  hasCredentials,
  hasSecondaryCredentials,
  hasReserveCredentials,
  getTestCredentials,
  getPrimaryCredentials,
  getSecondaryCredentials,
  getReserveCredentials,
  getComposeTo,
}
