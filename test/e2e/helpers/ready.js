const { expect } = require('@playwright/test')

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

        const emptyVisible = emptyTestId
          ? await page
              .getByTestId(emptyTestId)
              .isVisible()
              .catch(() => false)
          : false

        if (emptyVisible) {
          if (emptySince == null) {
            emptySince = Date.now()
          }
          if (Date.now() - emptySince >= emptySettleMs) {
            return 'empty'
          }
          return 'pending'
        }

        emptySince = null
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
        timeout: 5000,
      })
    }
  }
}

/** Click only after the locator is visible. */
async function clickReady(locator, options = {}) {
  await expect(locator).toBeVisible({ timeout: options.timeout || 30000 })
  await locator.click(options.clickOptions || {})
}

/** Header tab: data-test-id on the tab wrapper, click inner a.link. */
async function clickNav(page, testId) {
  await clickReady(page.getByTestId(testId).locator('a.link').first())
}

/** ConfirmPopup OK when present (many desktop deletes skip the dialog). */
async function confirmOkIfVisible(page, timeout = 15000) {
  const confirmOk = page.getByTestId('confirm-ok')
  if (await confirmOk.isVisible({ timeout }).catch(() => false)) {
    await clickReady(confirmOk)
    await expect(confirmOk)
      .toBeHidden({ timeout: 45000 })
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
