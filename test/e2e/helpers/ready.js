const { expect } = require('@playwright/test')
const { T } = require('./timeouts')

/**
 * Wait until a list finished loading: items appeared, or empty-state stayed
 * visible long enough that it is not a pre-fetch flash.
 */
async function waitForListReady(
  page,
  {
    itemTestIds,
    emptyTestId,
    spinnerSelectors = [],
    timeout = 60000,
    emptySettleMs = 2000,
  }
) {
  timeout = T(timeout)
  const ids = Array.isArray(itemTestIds) ? itemTestIds : [itemTestIds]
  let emptySince = null

  await expect
    .poll(
      async () => {
        for (const sel of spinnerSelectors) {
          const spinner = page.locator(sel).first()
          if (await spinner.isVisible().catch(() => false)) {
            emptySince = null
            return 'pending'
          }
        }

        let hasItems = false
        for (const id of ids) {
          const loc = page.getByTestId(id)
          const n = await loc.count()
          for (let i = 0; i < n; i++) {
            if (await loc.nth(i).isVisible().catch(() => false)) {
              hasItems = true
              break
            }
          }
          if (hasItems) break
        }

        if (hasItems) {
          emptySince = null
          return 'items'
        }

        // No spinner and no items already means the list is done loading
        // with nothing to show — don't hard-require the decorative
        // emptyTestId marker on top of that. Some empty-state branches
        // (e.g. "no results for this search", in both legacy's
        // ContactsView.html and next's ContactsListPanel.vue) render
        // without any data-test-id at all, which used to strand this in
        // 'pending' forever whenever that specific branch was the one
        // showing. Still settle for emptySettleMs to avoid a pre-fetch flash.
        if (emptySince == null) {
          emptySince = Date.now()
        }
        if (Date.now() - emptySince >= emptySettleMs) {
          return 'empty'
        }
        return 'pending'
      },
      { timeout, intervals: [200, 400, 800] }
    )
    .toMatch(/^(items|empty)$/)
}

/**
 * Soft variant for virtual folders (e.g. Starred) that may stay pending
 * without items or empty-state. Timeout is OK if `listVisibleTestId` is shown.
 */
async function waitForListReadySoft(
  page,
  options,
  { listVisibleTestId, softTimeout = 15000 } = {}
) {
  try {
    await waitForListReady(page, { ...options, timeout: softTimeout })
  } catch {
    if (listVisibleTestId) {
      await expect(page.getByTestId(listVisibleTestId)).toBeVisible({
        timeout: T(5000),
      })
    }
  }
}

/** Click only after the locator is visible. */
async function clickReady(locator, options = {}) {
  await expect(locator).toBeVisible({ timeout: T(options.timeout || 30000) })
  await locator.click(options.clickOptions || {})
}

/**
 * Header tab: data-test-id on the tab wrapper, click inner element.
 *
 * Inner click target is variant-aware:
 *   desktop — a.link (classic Knockout nav item)
 *   next    — a, button, [role="button"] (Vue SPA router-link or button)
 *
 * Strategy: first ensure the wrapper is visible, then click the best available
 * target.  Playwright's visibility check on deeply nested elements can be flaky
 * with Vite's incremental DOM — fall back to clicking the wrapper directly.
 */
async function clickNav(page, testId) {
  const wrapper = page.getByTestId(testId)

  // Ensure the nav tab itself is rendered and visible.
  await expect(wrapper).toBeVisible({ timeout: T(15000) })

  // Quick probe: is there a clickable child we should prefer?
  const innerSelector = 'a.link, a, button, [role="button"]'
  const inner = wrapper.locator(innerSelector).first()
  const innerVisible = await inner
    .isVisible({ timeout: T(3000) })
    .catch(() => false)
  const target = innerVisible ? inner : wrapper

  await target.click()

  // Both apps mark the active tab wrapper with a `current` CSS class
  // (legacy: HeaderItemView.html `css: {current: isCurrent}`; next:
  // AppHeaderLinkItem.vue `:class="{ current: isCurrent }"` — same
  // data-test-id element). Occasionally a first click right after login
  // lands with no observable effect (no route change, no network call) —
  // cause not pinned down, but retrying the click is a safe, cheap
  // mitigation since it's idempotent (re-clicking the same tab is a noop).
  const becameCurrent = await expect(wrapper)
    .toHaveClass(/current/, { timeout: T(4000) })
    .then(() => true)
    .catch(() => false)

  if (!becameCurrent) {
    await target.click().catch(() => undefined)
  }
}

/** ConfirmPopup OK when present (many desktop deletes skip the dialog). */
async function confirmOkIfVisible(page, timeout = 15000) {
  const confirmOk = page.getByTestId('confirm-ok')
  // isVisible() does not actually wait/poll (Playwright ignores its timeout
  // option) — use waitFor so a popup that renders a beat late isn't missed.
  const appeared = await confirmOk
    .waitFor({ state: 'visible', timeout: T(timeout) })
    .then(() => true)
    .catch(() => false)
  if (appeared) {
    await clickReady(confirmOk)
    await expect(confirmOk)
      .toBeHidden({ timeout: T(45000) })
      .catch(() => undefined)
  }
}

module.exports = {
  waitForListReady,
  waitForListReadySoft,
  clickReady,
  clickNav,
  confirmOkIfVisible,
}
