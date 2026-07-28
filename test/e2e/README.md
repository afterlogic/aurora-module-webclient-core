# Desktop E2E (Playwright)

Automated tests for the classic **desktop** UI (Knockout). Selectors use `data-test-id`.

This document covers layout, setup, how to run, and every relevant environment variable.

---

## Layout

```text
modules/CoreWebclient/package.json          ← @playwright/test + npm scripts test:e2e*
modules/CoreWebclient/test/e2e/             ← config, helpers, .env, reports, run.sh
modules/<WebclientModule>/test/e2e/*.spec.js ← scenarios for that module
```

| Piece | Responsibility |
|-------|----------------|
| `CoreWebclient/package.json` | Playwright dependency and `yarn test:e2e*` scripts |
| `test/e2e/playwright.config.js` | Spec discovery, browsers, baseURL, workers, retries |
| `test/e2e/helpers/` | Login, credentials, ready waits, shared helper paths |
| `test/e2e/.env.e2e` | Stand URL and test accounts (gitignored) |
| `modules/*/test/e2e/*.spec.js` | Mail / Contacts / Login / … scenarios |
| Install-root `package.json` | Wrappers `yarn test:e2e-desktop*` |

The config **auto-discovers** every `modules/*/test/e2e` that contains `*.spec.js` (skips `*Mobile*` and `CoreWebclient` itself). Add specs under a module — no config edit required.

---

## Preconditions

1. Aurora is running (MAMP / staging / any HTTP stand).
2. Document Root points at the **Aurora install root**.
3. Desktop UI opens in a browser (locally usually `http://localhost:8888/`).
4. After changing Knockout templates (`data-test-id`), clear the PHP template cache:

```bash
# from install root
rm -f data/cache/templates-*.cache
```

5. If client modules were added/removed, rebuild desktop JS:

```bash
# from install root
npm run js:build
npm run js:min   # required when UseAppMinJs is true (loads app.min.js)
```

---

## Setup (first time)

### 1. Install module dependencies (do this first)

```bash
cd modules/CoreWebclient
yarn
```

This installs CoreWebclient deps, including `@playwright/test` from `devDependencies`.

### 2. Download Playwright browsers

```bash
# from modules/CoreWebclient
yarn test:e2e:install-browsers
```

Installs **Chromium**, **Firefox**, and **WebKit** (Safari engine).

Or from the install root:

```bash
yarn test:e2e-desktop:install-browsers
```

### 3. Create `.env.e2e`

```bash
cd modules/CoreWebclient/test/e2e
cp .env.e2e.example .env.e2e
# edit logins/passwords and URL if needed
```

`.env.e2e` is **gitignored** — do not commit it.

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
| `SKIP_YARN_INSTALL` | no | For `run.sh`: `1` = skip `yarn` (CI already installed deps) |

### URL and subdirectories

For a subdirectory install, use a **trailing slash** (HTTPS preferred):

```bash
PLAYWRIGHT_BASE_URL=https://aurora-mta.afterlogic.com/aurora-mta-dev/
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

Use **Yarn classic 1.x** and **Node 18 or 22**.

### From `modules/CoreWebclient`

```bash
cd modules/CoreWebclient
yarn test:e2e
yarn test:e2e:ui
yarn test:e2e:report
```

### UI Mode (`yarn test:e2e:ui`)

Opens Playwright’s interactive runner (pick tests, watch steps / DOM / network). **It does not start tests by itself** — select a test (or use filters) and click ▶.

Prefer a narrow `--setup` so the list is not the full matrix (~200+ tests):

```bash
cd modules/CoreWebclient
yarn test:e2e:ui --setup "StandardLoginFormWebclient Chrome" login-page.spec.js
```

If the UI opens but a run fails immediately with “Executable doesn't exist” / “Please run … playwright install”, browsers for **this** `@playwright/test` version are missing. From `modules/CoreWebclient` only:

```bash
yarn test:e2e:install-browsers
```

Do **not** rely on a bare `npx playwright install` from another directory — that can install browsers for a different Playwright version.

### From the install root

```bash
yarn test:e2e-desktop                 # run.sh: scan modules + yarn test:e2e
yarn test:e2e-desktop:ui
yarn test:e2e-desktop:report
yarn test:e2e-desktop:install-browsers
```

### One module / one browser / one file

Use **`--setup "<modules> <browsers>"`** (not `--project`).

- First token (no spaces): module name(s), comma-separated.
- Rest of the string: browser name(s), comma-separated: `Chrome`, `Firefox`, `Safari`.
- Expands to Playwright projects `Module · Browser` (e.g. `MailWebclient · Chrome`).

Anything **after** `--setup "…"` is passed straight to Playwright (file name, `--grep`, `--list`, etc.).

```bash
cd modules/CoreWebclient

# All specs for that module × browser
yarn test:e2e --setup "StandardLoginFormWebclient Chrome"

# Several modules × several browsers
yarn test:e2e --setup "MailWebclient,ContactsWebclient Chrome,Firefox"

# Only one file: mail.spec.js under MailWebclient, Safari only
yarn test:e2e --setup "MailWebclient Safari" mail.spec.js
```

`mail.spec.js` is a **Playwright file filter**: run matching `*.spec.js` paths (substring / regex), not part of `--setup`.

From the install root via `run.sh`:

```bash
./modules/CoreWebclient/test/e2e/run.sh -- --setup "MailWebclient Chrome"
# or:
yarn test:e2e-desktop -- --setup "MailWebclient Chrome"
```

Without `--setup`, the full module × browser matrix runs.

Console steps look like `→ Open desktop login page`.  
HTML report: timeline, failure screenshots, **Trace**.

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

3. Re-run `yarn test:e2e` — discovery picks the folder up automatically.

`AURORA_E2E_ROOT` and `AURORA_ROOT` are set by `playwright.config.js`.

---

## Report

After a run:

```bash
cd modules/CoreWebclient
yarn test:e2e:report
# or from install root:
yarn test:e2e-desktop:report
```

Report files live in `modules/CoreWebclient/test/e2e/playwright-report/`.

---

## Staging / remote stand

1. Deploy templates with `data-test-id` and clear `data/cache/templates-*.cache`.
2. Provide three mailboxes (PRIMARY / SECONDARY / RESERVE) with Mail / Contacts / Files as needed.
3. On the runner machine:

```bash
cd modules/CoreWebclient
yarn
yarn test:e2e:install-browsers
cp test/e2e/.env.e2e.example test/e2e/.env.e2e
```

4. In `.env.e2e`:

```bash
PLAYWRIGHT_BASE_URL=https://your-staging.example/subdir/
E2E_LOGIN_PRIMARY=...
E2E_PASSWORD_PRIMARY=...
E2E_LOGIN_SECONDARY=...
E2E_PASSWORD_SECONDARY=...
E2E_LOGIN_RESERVE=...
E2E_PASSWORD_RESERVE=...
```

5. `yarn test:e2e` / `yarn test:e2e:report`.

---

## Command cheat sheet

| Where | Command | What it does |
|-------|---------|--------------|
| `CoreWebclient` | `yarn` | Install deps (including Playwright) |
| `CoreWebclient` | `yarn test:e2e:install-browsers` | Chromium + Firefox + WebKit |
| `CoreWebclient` | `yarn test:e2e` | Full run |
| `CoreWebclient` | `yarn test:e2e:ui` | UI Mode |
| `CoreWebclient` | `yarn test:e2e:report` | Open HTML report |
| Install root | `yarn test:e2e-desktop` | Scan + run via `run.sh` |
| Install root | `yarn test:e2e-desktop:*` | Same ui / report / install-browsers |

---

