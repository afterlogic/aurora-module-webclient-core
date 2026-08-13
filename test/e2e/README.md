# Desktop E2E (Playwright)

Automated tests for the classic **desktop** UI (Knockout). Selectors use `data-test-id`.

## Layout

```text
package.json (install root)                  ← @playwright/test + npm run test:e2e-desktop*
modules/CoreWebclient/test/e2e/               ← config, helpers, .env, reports, run.sh
modules/CoreWebclient/package.json            ← convenience scripts test:e2e* (use root Playwright)
modules/<WebclientModule>/test/e2e/*.spec.js  ← scenarios for that module
```

The config **auto-discovers** every `modules/*/test/e2e` that contains `*.spec.js` (skips `*Mobile*` and `CoreWebclient` itself). Add specs under a module — no config edit required.

---

## Setup (first time)

1. Aurora is running (MAMP / staging / any HTTP stand) and the desktop UI opens in a browser (locally usually `http://localhost:8888/`).
2. Install dependencies from the install root — this pulls `@playwright/test` into `node_modules/`:

   ```bash
   npm install
   ```

3. Download the Playwright browsers (Chromium, Firefox, WebKit):

   ```bash
   npm run test:e2e-desktop:install-browsers
   ```

   Do **not** rely on a bare `npx playwright install` from another directory — that can install browsers for a different Playwright version than the one under `test:e2e-desktop:install-browsers`.

4. Create `.env.e2e` and fill in all the fields (URL, test accounts):

   ```bash
   cp modules/CoreWebclient/test/e2e/.env.e2e.example modules/CoreWebclient/test/e2e/.env.e2e
   ```

   `.env.e2e` is **gitignored** — do not commit it.

5. Run:

   ```bash
   npm run test:e2e-desktop
   ```

If Knockout templates (`data-test-id`) changed, clear the PHP template cache before testing:

```bash
# from install root
rm -f data/cache/templates-*.cache
```

---

## Environment variables (`.env.e2e`)

| Variable | Required | Meaning |
|----------|----------|---------|
| `PLAYWRIGHT_BASE_URL` | yes* | Desktop UI base URL. *Config default: `http://localhost:8888/` |
| `PLAYWRIGHT_WORKERS` | no | Playwright parallel workers. **Default = 1**. Values > 1 on one PRIMARY mailbox cause races (delete/move/compose). |
| `E2E_LOGIN_PRIMARY` | yes | Main test user (default login for almost all tests) |
| `E2E_PASSWORD_PRIMARY` | yes | Primary password |
| `E2E_LOGIN_SECONDARY` | for share scenarios | Second user (sharing / multi-user flows) |
| `E2E_PASSWORD_SECONDARY` | for share scenarios | |
| `E2E_LOGIN_RESERVE` | for ACL scenarios | User with different permissions |
| `E2E_PASSWORD_RESERVE` | for ACL scenarios | |
| `E2E_COMPOSE_TO` | no | Compose recipient (default = PRIMARY login) |
| `SKIP_DEPS_INSTALL` | no | For `run.sh`: `1` = skip `npm install` (CI already installed root deps). Alias: `SKIP_NPM_INSTALL`. |

For a subdirectory install, use a **trailing slash** (HTTPS preferred):

```bash
PLAYWRIGHT_BASE_URL=https://example.com/aurora/
```

### Account roles

| Role | Env | When to use |
|------|-----|-------------|
| **PRIMARY** | `E2E_LOGIN_PRIMARY` | Almost everything: mail, contacts, files, login |
| **SECONDARY** | `E2E_LOGIN_SECONDARY` | Sharing: share with X, accept share, etc. |
| **RESERVE** | `E2E_LOGIN_RESERVE` | Permission / limited-access scenarios |

Helpers in `helpers/credentials.js`: `getPrimaryCredentials()` / `getTestCredentials()`, `getSecondaryCredentials()`, `getReserveCredentials()`.

---

## Run

Use **Node 18 or 22**. Playwright lives in the **install-root** `node_modules`.

```bash
npm run test:e2e-desktop                 # run.sh: scan modules + run
npm run test:e2e-desktop:ui
npm run test:e2e-desktop:report
npm run test:e2e-desktop:install-browsers
```

Equivalent commands from `modules/CoreWebclient` (thin wrappers around the same install-root Playwright):

```bash
cd modules/CoreWebclient
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:report
```

### UI Mode (`npm run test:e2e:ui`)

Opens Playwright's interactive runner (pick tests, watch steps / DOM / network). **It does not start tests by itself** — select a test (or use filters) and click ▶.

Prefer a narrow `--setup` so the list is not the full matrix (~200+ tests):

```bash
cd modules/CoreWebclient
npm run test:e2e:ui -- --setup "StandardLoginFormWebclient Chrome" login-page.spec.js
```

If the UI opens but a run fails immediately with "Executable doesn't exist" / "Please run … playwright install", the browsers are missing for this Playwright version — run `npm run test:e2e-desktop:install-browsers` from the install root.

### One module / one browser / one file

Use **`--setup`** (not raw Playwright `--project`):

- `"<browser>"` — all modules × that browser (e.g. `"Chrome"`).
- `"* <browser>"` or `"*Chrome"` — same as above.
- `"<modules> <browsers>"` — explicit filter (module names comma-separated, then browsers).

Expands to Playwright projects `Module · Browser` (e.g. `MailWebclient · Chrome`).

Anything **after** `--setup "…"` is passed straight to Playwright (file name, `--grep`, `--list`, etc.). Without `--setup`, the full module × browser matrix runs.

```bash
cd modules/CoreWebclient

# All modules × Chrome only
npm run test:e2e -- --setup "Chrome"

# All specs for that module × browser
npm run test:e2e -- --setup "StandardLoginFormWebclient Chrome"

# Several modules × several browsers
npm run test:e2e -- --setup "MailWebclient,ContactsWebclient Chrome,Firefox"

# Only one file: mail.spec.js under MailWebclient, Safari only
npm run test:e2e -- --setup "MailWebclient Safari" mail.spec.js
```

`mail.spec.js` is a **Playwright file filter**: run matching `*.spec.js` paths (substring / regex), not part of `--setup`.

From the install root via `run.sh`:

```bash
./modules/CoreWebclient/test/e2e/run.sh -- --setup "MailWebclient Chrome"
# or:
npm run test:e2e-desktop -- --setup "MailWebclient Chrome"
```

Console steps look like `→ Open desktop login page`. HTML report: timeline, failure screenshots, **Trace**.

---

## Browsers (projects)

Each module with specs × each browser = one Playwright project:

| Name in report | Engine |
|----------------|--------|
| `… · Chrome` | Chromium |
| `… · Firefox` | Firefox |
| `… · Safari` | **Playwright WebKit** (not iOS Safari on a device) |

A full run without a project filter executes **all** combinations — that is slow. For a quick check, use one project (Chrome).

---

## Workers

- Default **`workers: 1`** (no races on a single PRIMARY mailbox).
- Speed up only explicitly: `PLAYWRIGHT_WORKERS=2` in `.env.e2e` — only if you accept shared-data races.
- `fullyParallel: false` — tests inside one file stay serial.

---

## Adding tests for a new module

1. Create `modules/YourWebclient/test/e2e/` with `*.spec.js` (and optional `helpers/`).
2. Import shared helpers:

   ```js
   const path = require('path')
   const { sharedHelper } = require(
     path.join(process.env.AURORA_E2E_ROOT, 'helpers/paths')
   )
   const { loginAsTestUser, hasCredentials, step } = sharedHelper('login')
   ```

3. Re-run `npm run test:e2e` — discovery picks the folder up automatically.

`AURORA_E2E_ROOT` and `AURORA_ROOT` are set by `playwright.config.js`.

---

## Report

Report files live in `modules/CoreWebclient/test/e2e/playwright-report/`.

```bash
npm run test:e2e-desktop:report
```

---

## Staging / remote stand

1. Deploy templates with `data-test-id` and clear `data/cache/templates-*.cache`.
2. Provide three mailboxes (PRIMARY / SECONDARY / RESERVE) with Mail / Contacts / Files as needed.
3. Follow **Setup (first time)** above on the runner machine, filling in `.env.e2e` with the staging URL and credentials:

   ```bash
   PLAYWRIGHT_BASE_URL=https://your-staging.example/subdir/
   E2E_LOGIN_PRIMARY=...
   E2E_PASSWORD_PRIMARY=...
   E2E_LOGIN_SECONDARY=...
   E2E_PASSWORD_SECONDARY=...
   E2E_LOGIN_RESERVE=...
   E2E_PASSWORD_RESERVE=...
   ```
