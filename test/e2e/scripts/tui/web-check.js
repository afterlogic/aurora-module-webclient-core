/**
 * Checks whether an installation serves the E2E settings files over HTTP.
 * .env.e2e files live under the web root and hold test passwords, so the web
 * server must refuse them.
 */

const http = require('http')
const https = require('https')

const TIMEOUT_MS = 6000
const MAX_REDIRECTS = 3

/** GET `url`, following a few redirects; resolves { status, body } (body capped). */
function fetchFollow(url, redirects = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http
    const req = lib.get(
      url,
      {
        // Local stands often use self-signed certificates.
        rejectUnauthorized: false,
        timeout: TIMEOUT_MS,
        headers: { 'User-Agent': 'aurora-e2e-launcher' },
      },
      (res) => {
        const location = res.headers.location
        if (res.statusCode >= 300 && res.statusCode < 400 && location && redirects > 0) {
          res.resume()
          resolve(fetchFollow(new URL(location, url).href, redirects - 1))
          return
        }
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          body += chunk
          if (body.length > 4096) {
            res.destroy()
          }
        })
        res.on('close', () => resolve({ status: res.statusCode, body }))
      }
    )
    req.on('timeout', () => req.destroy(new Error('timed out')))
    req.on('error', reject)
  })
}

/** Installation root URL: query and hash dropped, trailing slash kept. */
function installBase(url) {
  const base = new URL(url)
  base.search = ''
  base.hash = ''
  if (!base.pathname.endsWith('/')) {
    base.pathname += '/'
  }
  return base.href
}

/**
 * Probe `paths` (relative to the installation root) on `baseUrl`.
 * Resolves { state: 'safe' | 'exposed' | 'unknown', exposed: string[], error }.
 */
async function checkInstallation(baseUrl, paths) {
  const results = await Promise.all(
    paths.map((p) =>
      fetchFollow(new URL(p, baseUrl).href).then(
        (res) => ({ path: p, res }),
        (error) => ({ path: p, error })
      )
    )
  )
  // A served settings file is a 200 whose body has KEY=value lines; SPA
  // fallbacks and login redirects return HTML instead.
  const exposed = results
    .filter(({ res }) => res && res.status === 200 && /^[A-Z][A-Z0-9_]*=/m.test(res.body))
    .map(({ path }) => path)
  if (exposed.length) {
    return { state: 'exposed', exposed }
  }
  const failed = results.find((r) => r.error)
  if (failed && results.every((r) => r.error)) {
    return { state: 'unknown', exposed: [], error: failed.error.message }
  }
  return { state: 'safe', exposed: [] }
}

module.exports = { installBase, checkInstallation }
