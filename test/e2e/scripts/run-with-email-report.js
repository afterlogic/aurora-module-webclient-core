const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const e2eRoot = path.join(__dirname, '..')
const defaultHtmlReport = path.join(e2eRoot, 'playwright-report', 'index.html')

/**
 * If the report is already HTML, return it as-is.
 * Otherwise wrap plain text in a minimal HTML page for viewing in a browser.
 *
 * @param {string} reportPath
 * @returns {string} path to an HTML file
 */
function ensureHtmlReport(reportPath) {
  if (!reportPath || !fs.existsSync(reportPath)) {
    throw new Error(`E2E report file not found: ${reportPath || '(empty path)'}`)
  }

  const ext = path.extname(reportPath).toLowerCase()
  if (ext === '.html' || ext === '.htm') {
    return reportPath
  }

  const raw = fs.readFileSync(reportPath, 'utf8')
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const htmlPath = `${reportPath}.html`
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>E2E report</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 24px; background: #111; color: #eee; }
    pre { white-space: pre-wrap; word-break: break-word; line-height: 1.4; }
  </style>
</head>
<body>
  <h1>E2E report</h1>
  <pre>${escaped}</pre>
</body>
</html>
`
  fs.writeFileSync(htmlPath, html, 'utf8')
  return htmlPath
}

/**
 * Sends the test report by email via the PHP mailer. The PHP script reads
 * playwright-report/results.json itself to build the pass/fail summary in the email body.
 * @param {string} reportHtmlPath
 */
function sendTestReportEmail(reportHtmlPath, exitCode) {
  const phpScript = path.join(__dirname, 'send-e2e-report.php') // adjust path
  const status = exitCode === 0 ? 'passed' : 'failed'
  const result = spawnSync('php', [phpScript, reportHtmlPath, `--status=${status}`], {
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.warn('[e2e-notify] failed to send report email')
  }
}

function runPlaywright(extraArgs) {
  // Delegate to run-e2e.js (not the raw Playwright binary) so --setup is translated
  // into --project="Module · Browser" the same way as test:e2e / test:e2e:ui. Unlike the
  // mobile suite, --setup translation here lives in run-e2e.js, not playwright-cli.js.
  const runE2eScript = path.join(__dirname, 'run-e2e.js')

  const result = spawnSync(process.execPath, [runE2eScript, ...extraArgs], {
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  return result.status === null ? 1 : result.status
}

function main() {
  const extraArgs = process.argv.slice(2)
  const exitCode = runPlaywright(extraArgs)

  try {
    const reportPath =
      process.env.E2E_REPORT_PATH || defaultHtmlReport
    const htmlPath = ensureHtmlReport(reportPath)
    sendTestReportEmail(htmlPath, exitCode)
  } catch (err) {
    console.warn(`[e2e-notify] skipped email stub: ${err.message}`)
  }

  process.exit(exitCode)
}

main()
