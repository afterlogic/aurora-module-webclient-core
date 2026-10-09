/**
 * Diagnostics for E2E runs: print failed API answers and failed requests to the
 * test output. A server-side failure (rejected upload, save, list refresh) or a
 * dropped connection otherwise only shows up as "element not found" in a later
 * step, with nothing in the report to say why.
 *
 * Only the method, error code and a few non-sensitive request fields are
 * printed; credentials and other parameters never are.
 */

const watched = new WeakSet()

// Request fields that help to tell which storage/path an operation targeted.
const SAFE_FIELDS = ['Type', 'Path', 'Storage', 'AddressBookId', 'Folder']

function safeDetails(params) {
  try {
    const p = JSON.parse(params.get('Parameters') || '{}')
    const c = p.Contact || {}
    const parts = []
    for (const key of SAFE_FIELDS) {
      const value = p[key] ?? c[key]
      if (value !== undefined && typeof value !== 'object') {
        parts.push(`${key}=${String(value).slice(0, 80)}`)
      }
    }
    return parts.length ? ` ${parts.join(' ')}` : ''
  } catch {
    return ''
  }
}

function isApiUrl(url) {
  return /\/Api\/?(\?|$)/.test(url)
}

function watchApiErrors(page) {
  if (watched.has(page)) {
    return
  }
  watched.add(page)

  page.on('response', async (res) => {
    try {
      const req = res.request()
      if (req.method() !== 'POST' || !isApiUrl(res.url())) {
        return
      }
      const params = new URLSearchParams(req.postData() || '')
      const where = `${params.get('Module')}::${params.get('Method')}`
      if (res.status() >= 400) {
        console.log(`  ! API ${where} HTTP ${res.status()}`)
        return
      }
      const data = JSON.parse(await res.text())
      if (data && data.ErrorCode) {
        console.log(
          `  ! API ${where} failed: ErrorCode=${data.ErrorCode} ${
            data.ErrorMessage || ''
          }${safeDetails(params)}`.trim()
        )
      }
    } catch {
      /* diagnostics must never fail a test */
    }
  })

  page.on('requestfailed', (req) => {
    try {
      const failure = req.failure()
      // Aborted requests are normal (navigation, closed page).
      if (!failure || /ERR_ABORTED/.test(failure.errorText)) {
        return
      }
      const params = new URLSearchParams(req.postData() || '')
      const what = isApiUrl(req.url())
        ? `${params.get('Module')}::${params.get('Method')}`
        : new URL(req.url()).pathname
      console.log(`  ! Request ${what} failed: ${failure.errorText}`)
    } catch {
      /* diagnostics must never fail a test */
    }
  })
}

module.exports = { watchApiErrors }
