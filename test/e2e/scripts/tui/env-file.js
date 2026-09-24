/**
 * .env.e2e handling for the E2E launcher: parsing, template-driven field
 * list for the setup wizard, validation and writing the file back.
 *
 * The template (.env.e2e.example) is the source of truth for the fields,
 * their order and descriptions: comment lines right above a key describe it,
 * `# --- Heading ---` lines start a section, and commented-out keys
 * (`# KEY=example`) are optional fields that stay commented when left empty.
 */

const fs = require('fs')

const ACTIVE_KEY = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/
const COMMENTED_KEY = /^#\s*([A-Z_][A-Z0-9_]*)=(.*)$/

/** Short labels for keys the templates leave without a comment. */
const LABELS = {
  E2E_LOGIN: 'Test user login',
  E2E_PASSWORD: 'Test user password',
  MAIL_HOST: 'SMTP server host',
  MAIL_PORT: 'SMTP port: 465 (ssl), 587 (tls) or 25 (none)',
  MAIL_ENCRYPTION: 'SMTP encryption: tls, ssl or none',
  MAIL_USERNAME: 'SMTP login',
  MAIL_PASSWORD: 'SMTP password',
  MAIL_FROM_ADDRESS: 'Sender address of the report email',
  MAIL_FROM_NAME: 'Sender name of the report email',
  E2E_MAIL_TO: 'Report recipients, comma-separated',
  E2E_MAIL_SUBJECT: 'Report email subject',
  WEB_INSTALL_URL:
    'URL of this installation: used for the report link and to check that .env.e2e is not served over HTTP',
}

/** Template values that are examples to replace, not usable settings. */
function isPlaceholder(value) {
  return /^your-|@example\.(com|org|net)$|^mail-account-|^MAIL_SERVER_ADDRESS$|^comma-separated-/i.test(
    String(value || '').trim()
  )
}

/** Parse active KEY=value lines the same way the playwright.config.js do. */
function parseEnv(text) {
  const values = {}
  text.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      values[match[1].trim()] = match[2].trim()
    }
  })
  return values
}

function readEnv(file) {
  return fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : null
}

/**
 * Fields in template order:
 * { key, templateValue, optional, example, section, description: string[] }
 * (description holds paragraphs).
 */
function templateFields(templateText) {
  const lines = templateText.split(/\r?\n/).map((l) => l.trim())
  const activeKeys = new Set(
    lines.map((l) => l.match(ACTIVE_KEY)).filter(Boolean).map((m) => m[1])
  )
  const examples = {}
  const fields = []
  const seen = new Set()
  let section = ''
  let comments = []
  let afterKey = false

  for (const line of lines) {
    if (line === '') {
      comments = []
      afterKey = false
      continue
    }
    const active = line.match(ACTIVE_KEY)
    const commented = !active && line.match(COMMENTED_KEY)
    if (active || commented) {
      const key = (active || commented)[1]
      const value = (active || commented)[2].trim()
      afterKey = true
      if (commented && activeKeys.has(key)) {
        // `# KEY=other` above an active KEY line is an example of its values.
        examples[key] = value
        continue
      }
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      // A comment block describes the key right below it; keys further down
      // the same block (PASSWORD after LOGIN) share it unless they have a label.
      const firstInBlock = !fields.length || fields[fields.length - 1].blockComments !== comments
      const label = LABELS[key] ? [LABELS[key]] : []
      const block = comments.length ? [comments.join(' ')] : []
      let description
      if (firstInBlock) {
        description = [...block, ...label]
      } else {
        description = label.length ? label : block
      }
      fields.push({
        key,
        templateValue: active ? value : '',
        optional: !active,
        example: commented ? value : '',
        section,
        description,
        blockComments: comments,
      })
      continue
    }
    const text = line.replace(/^#\s?/, '')
    if (afterKey) {
      comments = []
      afterKey = false
    }
    const heading = text.match(/^-{2,}\s*(.*?)\s*-*$/)
    if (heading) {
      section = heading[1]
      comments = []
    } else if (text.trim() === '') {
      comments = []
    } else {
      comments.push(text)
    }
  }

  for (const field of fields) {
    if (!field.example && examples[field.key]) {
      field.example = examples[field.key]
    }
    delete field.blockComments
  }
  return fields
}

// --- Validation --------------------------------------------------------------

const EMAIL = /^[^\s@,]+@[^\s@,]+$/

function checkUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? ''
      : 'must be an http:// or https:// URL'
  } catch {
    return 'must be a full http:// or https:// URL'
  }
}

const VALIDATORS = [
  [/_URL$/, checkUrl],
  [/^(MAIL_PORT|PLAYWRIGHT_WORKERS)$/, (v) => (/^[1-9]\d*$/.test(v) ? '' : 'must be a positive whole number')],
  [/^E2E_TIMEOUT_SCALE$/, (v) => (Number(v) > 0 ? '' : 'must be a positive number')],
  [/^MAIL_ENCRYPTION$/, (v) => (/^(tls|ssl|none)$/i.test(v) ? '' : 'must be tls, ssl or none')],
  [/^E2E_APP_VARIANT$/, (v) => (/^(desktop|next)$/.test(v) ? '' : 'must be desktop or next')],
  [/^(MAIL_FROM_ADDRESS|E2E_COMPOSE_TO)$/, (v) => (EMAIL.test(v) ? '' : 'must be an email address')],
  [
    /^E2E_MAIL_TO$/,
    (v) =>
      v.split(',').every((a) => EMAIL.test(a.trim()) || isPlaceholder(a))
        ? ''
        : 'must be comma-separated email addresses',
  ],
]

/** Error text for a non-empty value, or '' when it is fine. */
function validate(key, value) {
  if (value === '' || isPlaceholder(value)) {
    return ''
  }
  const entry = VALIDATORS.find(([pattern]) => pattern.test(key))
  return entry ? entry[1](value) : ''
}

// --- Writing -----------------------------------------------------------------

/**
 * Render .env.e2e from the template with `values` filled in. Optional keys
 * left empty stay commented out; keys the previous file had but the template
 * does not are appended so nothing is lost.
 */
function buildEnvText(templateText, fields, values, previous) {
  const eol = templateText.includes('\r\n') ? '\r\n' : '\n'
  const optional = new Set(fields.filter((f) => f.optional).map((f) => f.key))
  const out = []

  for (const raw of templateText.split(/\r?\n/)) {
    const line = raw.trim()
    const active = line.match(ACTIVE_KEY)
    const commented = !active && line.match(COMMENTED_KEY)
    if (active) {
      const key = active[1]
      out.push(`${key}=${key in values ? values[key] : active[2].trim()}`)
    } else if (commented && optional.has(commented[1])) {
      const key = commented[1]
      const value = values[key] || ''
      // A login without a password line would read as "not configured".
      const pairedLogin = key.replace(/^E2E_PASSWORD/, 'E2E_LOGIN')
      if (value !== '' || (pairedLogin !== key && values[pairedLogin])) {
        out.push(`${key}=${value}`)
        optional.delete(key)
      } else {
        out.push(raw)
      }
    } else {
      out.push(raw)
    }
  }

  const known = new Set(fields.map((f) => f.key))
  const extra = Object.keys(previous || {}).filter((key) => !known.has(key))
  if (extra.length) {
    while (out.length && out[out.length - 1].trim() === '') {
      out.pop()
    }
    out.push('', '# Kept from the previous .env.e2e')
    extra.forEach((key) => out.push(`${key}=${previous[key]}`))
    out.push('')
  }
  return out.join(eol)
}

module.exports = {
  isPlaceholder,
  parseEnv,
  readEnv,
  templateFields,
  validate,
  buildEnvText,
}
