/**
 * Cursor / IDE sandboxes inject HTTP(S)_PROXY → 127.0.0.1 which Playwright
 * inherits. CONNECT to external staging then fails (403 / ERR_CONNECTION_CLOSED)
 * while a normal browser (no proxy) still works.
 *
 * Strip only loopback proxy vars; leave real corporate proxies alone.
 */

const PROXY_KEYS = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
  'no_proxy',
  'SOCKS_PROXY',
  'SOCKS5_PROXY',
  'socks_proxy',
  'socks5_proxy',
  'GIT_HTTP_PROXY',
  'GIT_HTTPS_PROXY',
]

function isLoopbackProxyUrl(value) {
  if (!value || typeof value !== 'string') {
    return false
  }
  return /^(https?|socks5?):\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i.test(
    value.trim()
  )
}

function stripLoopbackProxyEnv(env) {
  const next = { ...env }
  for (const key of PROXY_KEYS) {
    if (isLoopbackProxyUrl(next[key])) {
      delete next[key]
    }
  }
  return next
}

function stripLoopbackProxyFromProcessEnv() {
  for (const key of PROXY_KEYS) {
    if (isLoopbackProxyUrl(process.env[key])) {
      delete process.env[key]
    }
  }
}

module.exports = {
  stripLoopbackProxyEnv,
  stripLoopbackProxyFromProcessEnv,
}
