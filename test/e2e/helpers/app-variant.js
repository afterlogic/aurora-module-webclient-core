/**
 * Variant-aware selectors and strategies for desktop E2E.
 *
 * Two apps share the same backend:
 *   desktop — classic Knockout.js UI (PHP-twined, form-submit login, page reloads)
 *   next    — Vue SPA (client-side routing, API-based auth, no page navigation)
 *
 * Detection:
 *   1. Explicit: E2E_APP_VARIANT=desktop|next in .env.e2e
 *   2. Auto-detect: checks a known stable element on the login page
 *
 * By default the  variant is 'desktop' (backward-compatible).
 */

let _variant = null

/** All selectors keyed by variant. Same key for both; override next values as needed. */
const SELECTOR_MAP = {
  desktop: {
    // ----- Login page -----
    loginEmail:    'login-email',
    loginPassword: 'login-password',
    loginSubmit:   'login-submit',

    // ----- Post-login shell -----
    headerTabs:    'header-tabs',
    /** nav-{module} is generated dynamically — prefix only */
    navPrefix:     'nav-',

    // ----- Inner element clicked inside a nav tab wrapper -----
    /** CSS selector for the click target inside a nav tab [data-test-id] wrapper */
    navInnerClick: 'a.link',

    // The first element that proves we are post-login on desktop
    shellAnchor:   'nav-mail',
  },

  next: {
    // ----- Login page -----
    loginEmail:    'login-email',
    loginPassword: 'login-password',
    loginSubmit:   'login-submit',

    // ----- Post-login shell -----
    headerTabs:    'header-tabs',
    navPrefix:     'nav-',

    // Vue SPA uses <router-link> or <button> inside the nav
    navInnerClick: 'a, button, [role="button"]',

    // First element that proves we are post-login on next
    shellAnchor:   'nav-mail',
  },
}

// ---------------------------------------------------------------------------
// Runtime auto-detection
// ---------------------------------------------------------------------------

/**
 * Try to detect the app variant by checking a known desktop-only marker
 * on the login page.  If the marker is present we assume 'desktop',
 * otherwise 'next'.
 *
 * Call AFTER navigating to the login page.
 */
async function detectVariant(page) {
  if (!page) return resolveVariant() // fallback to env

  try {
    // Next / Vue SPA — look for a Vue mount point first.
    // Note: #app is a Vue mount; .login_panel exists in BOTH apps,
    // so we must check for next markers before desktop ones.
    const vueApp = page.locator('#app').first()
    if (await vueApp.isVisible({ timeout: 3000 }).catch(() => false)) {
      return 'next'
    }
  } catch { /* ignore */ }

  try {
    // Desktop login form — Knockout-bound container.
    const koMarker = page.locator('.login_panel, [data-bind*="login"]').first()
    if (await koMarker.isVisible({ timeout: 3000 }).catch(() => false)) {
      return 'desktop'
    }
  } catch { /* ignore */ }

  return resolveVariant()
}

function resolveVariant() {
  if (_variant) return _variant
  const env = process.env.E2E_APP_VARIANT
  if (env === 'next' || env === 'desktop') {
    _variant = env
    return _variant
  }
  _variant = 'desktop'
  return _variant
}

/** Call once per worker (e.g. from loginAsTestUser). */
async function initVariant(page) {
  if (_variant) return _variant
  if (process.env.E2E_APP_VARIANT) {
    _variant = resolveVariant()
    return _variant
  }
  _variant = await detectVariant(page)
  console.log(`  → App variant: ${_variant}`)
  return _variant
}

function getVariant() {
  return resolveVariant()
}

// ---------------------------------------------------------------------------
// Selector helpers
// ---------------------------------------------------------------------------

/** Get a named selector for the current variant. */
function sel(name) {
  const v = resolveVariant()
  return SELECTOR_MAP[v]?.[name] || SELECTOR_MAP.desktop[name] || name
}

/** Build nav-{module} test-id for the current variant. */
function navId(moduleName) {
  return sel('navPrefix') + String(moduleName).toLowerCase()
}

// ---------------------------------------------------------------------------
// Strategy flags
// ---------------------------------------------------------------------------

/** True when the login flow should NOT wait for page navigation (SPA / API auth). */
function isSPA() {
  return resolveVariant() === 'next'
}

/** True when login uses form-submit and page reload. */
function isTraditional() {
  return resolveVariant() === 'desktop'
}

// ---------------------------------------------------------------------------

module.exports = {
  SELECTOR_MAP,
  detectVariant,
  initVariant,
  resolveVariant,
  getVariant,
  sel,
  navId,
  isSPA,
  isTraditional,
}
