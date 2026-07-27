# Desktop E2E (Playwright)

Playwright suite against the classic Knockout desktop UI. Selectors use `data-test-id`.

**Layout:** this package is the **runner** (config, credentials, shared helpers, browsers).
Scenarios live in modules:

```text
modules/<WebclientModule>/test/e2e/*.spec.js
modules/<WebclientModule>/test/e2e/helpers/   # domain helpers
modules/CoreWebclient/test/e2e/helpers/                         # credentials, login, ready, paths
```

`playwright.config.js` discovers every `modules/*/test/e2e` that contains `*.spec.js`
and builds projects `ModuleName · Desktop Chrome|Firefox`.

## Preconditions

1. Aurora is running (MAMP or equivalent / staging).
2. Document Root points at the project root.
3. Desktop UI opens at the install root: `http://localhost:8888/`
4. After changing Knockout templates (`data-test-id`), clear the PHP template cache:

```bash
# from installation root
rm -f data/cache/templates-*.cache
```

5. If client modules were added/removed (e.g. Turnstile plugin), rebuild desktop JS:

```bash
npm run js:build
npm run js:min   # required when UseAppMinJs is true (loads app.min.js)
```

## Setup

Use **Yarn classic (1.x)** and **Node 18 or 22**.

```bash
cd modules/CoreWebclient/test/e2e
yarn
yarn test:e2e:install-browsers
cp .env.e2e.example .env.e2e
# edit E2E_LOGIN_0 / E2E_PASSWORD_0 … (one isolated account per worker)
```

From the installation root:

```bash
yarn test:e2e-desktop:install-browsers
yarn test:e2e-desktop                 # ./modules/CoreWebclient/test/e2e/run.sh
yarn test:e2e-desktop:report
```

## Run (local)

```bash
# install root — lists found modules, then runs Playwright
./modules/CoreWebclient/test/e2e/run.sh
./modules/CoreWebclient/test/e2e/run.sh -- --project="MailWebclient · Desktop Chrome"

cd modules/CoreWebclient/test/e2e
yarn test:e2e_local
yarn test:e2e_local -- --project="*Desktop Chrome"
yarn test:e2e_local -- --project="ContactsWebclient · Desktop Chrome"
yarn test:e2e:ui
yarn test:e2e:report
```

In the console you will see steps like `→ Open desktop login page`.
In the HTML report: timeline of steps, screenshots on failure, and a **Trace** button.

Config notes:
- Default **`workers: 2`** when 2+ accounts are configured (capped by pool size). Override with `PLAYWRIGHT_WORKERS=1|2|3|4`.
- `fullyParallel: false` — tests inside one file stay serial; different files can run on different workers.
- Each worker logs in as `E2E_LOGIN_N` (`N = worker index % pool size`).
- Specs resolve `@playwright/test` via `NODE_PATH=modules/CoreWebclient/test/e2e/node_modules` (set in config + scripts).
- Env for helpers: `AURORA_E2E_ROOT` (this package), `AURORA_ROOT` (install root).

```bash
PLAYWRIGHT_WORKERS=1 yarn test:e2e_local -- --project="*Desktop Chrome"
PLAYWRIGHT_WORKERS=4 yarn test:e2e_local -- --project="*Desktop Chrome"
```

## Adding a module suite

1. Create `modules/YourWebclient/test/e2e/` with `*.spec.js` (and optional `helpers/`).
2. Import shared helpers:

```js
const path = require('path')
const { sharedHelper, moduleHelper, fixturePath } = require(
  path.join(process.env.AURORA_E2E_ROOT, 'helpers/paths')
)
const { loginAsTestUser, hasCredentials } = sharedHelper('login')
```

3. Re-run — discovery picks the folder up automatically (no config edit).

## Credentials

```bash
cp .env.e2e.example .env.e2e
# edit E2E_LOGIN_0 / E2E_PASSWORD_0, E2E_LOGIN_1 / …
```

`.env.e2e` is gitignored. Playwright loads it via `playwright.config.js`.

Single-account fallback (when no `E2E_LOGIN_N`):

```bash
# E2E_LOGIN=...
# E2E_PASSWORD=...
```

Optional compose override (default = that worker’s login):

```bash
# E2E_COMPOSE_TO=someone@example.com
```

## Custom URL

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8888/ yarn test:e2e_local
```

## Run on staging

1. Deploy Aurora with `data-test-id` templates and cleared `data/cache/templates-*.cache`.
2. Test accounts need Mail (IMAP), Contacts, and Files.
3. On the runner:

```bash
cd modules/CoreWebclient/test/e2e
yarn
yarn test:e2e:install-browsers
cp .env.e2e.example .env.e2e
```

4. Set in `.env.e2e`:

```bash
PLAYWRIGHT_BASE_URL=https://your-staging.example/
E2E_LOGIN_0=staging-user-0@example.com
E2E_PASSWORD_0=...
E2E_LOGIN_1=staging-user-1@example.com
E2E_PASSWORD_1=...
```

5. Run `yarn test:e2e_local` / `yarn test:e2e:report`.

## Tests by module

| Module | Specs |
|--------|--------|
| `StandardLoginFormWebclient` | `login-page`, `login`, `auth-actions` |
| `MailWebclient` | `mail*`, `compose*` |
| `ContactsWebclient` | `contacts*` |
| `FilesWebclient` | `files*` |
| `SettingsWebclient` | `settings*` |

| Spec | What it checks |
|------|----------------|
| `login-page.spec.js` | Login form is visible |
| `login.spec.js` | Full login (Turnstile + credentials) |
| `auth-actions.spec.js` | Invalid password; forgot-password → back; logout→re-login; password visibility toggle |
| `mail.spec.js` | Inbox → open first message; sender/reply chrome |
| `mail-actions.spec.js` | Message UI: details, star, reply / reply-all / forward open, search |
| `mail-folders.spec.js` | Sidebar → Inbox / Sent / Trash / Spam |
| `mail-mutations.spec.js` | Headers, move, spam / not spam, delete, send reply/forward, advanced search |
| `mail-list-actions.spec.js` | Unseen filter + clear; Starred; checkbox bulk delete; empty Trash |
| `mail-attachments.spec.js` | Compose + attach file → send → open in Sent → attachment list |
| `compose.spec.js` | Compose + send to `E2E_COMPOSE_TO` (or self) → Sent |
| `compose-draft.spec.js` | Save draft → reopen; send opened draft → Sent; unsaved close minimizes then save-and-close |
| `compose-cc-bcc.spec.js` | Show CC/BCC, fill recipients, discard without sending |
| `mail-forward-resend.spec.js` | Forward as Attachment → compose; Resend → compose (when available) |
| `contacts.spec.js` | Contacts → open card; create contact |
| `contacts-actions.spec.js` | Storages switch, search, create/edit/delete, group CRUD, compose from email, share/unshare, find in mail |
| `contacts-select-actions.spec.js` | Checkbox bulk delete; multi-select compose; assign to group; rename group |
| `contacts-extra-actions.spec.js` | Team storage browse; compose from contact email |
| `files.spec.js` | Files → select item; create folder + upload |
| `files-actions.spec.js` | Storages, search, upload+delete, rename, public link, move (cut/paste), create folder |
| `files-select-actions.spec.js` | Copy into folder (original remains); multi-select bulk delete; share with teammates; leave share |
| `files-extra-actions.spec.js` | Copy into folder; file download; rename folder |
| `settings.spec.js` | Settings (+ first tab) → logout → login form |
| `settings-actions.spec.js` | Every settings tab; OpenPGP; Paranoid Encryption; Add account (if visible) |
| `settings-auth.spec.js` | OpenPGP generate control; OpenPGP toggle; Paranoid controls visible |

## Desktop UX notes (tests / helpers)

- Compose close with unsaved changes **minimizes** the popup; leave via `mail-compose-save-and-close`.
- Drafts open compose on **double-click** (single click only previews).
- Recipients (To / CC / BCC) use inputosaurus: fill + Enter.
- Folder sidebar: `[data-test-id="mail-folder"][data-folder-type="inbox|sent|…"]`.
- Multi-select: checkboxes (mail/contacts); files often Ctrl/Meta+click.
- Confirm popup (`confirm-ok`) is optional on some delete paths; helpers use soft confirm.
- Toolbar actions with duplicate IDs: prefer visible, non-disabled control.

## Intentional skips

- Empty inbox / contacts / files storage
- `login-password-toggle` absent
- Forgot-password / OpenPGP / Paranoid / Add account / Share / Resend / Forward-as-attachment when missing
- Multi-select email toolbar when `contacts-select-email` is missing
- Headers when the popup window does not open
- Cut/Copy/Paste when the FilesCutCopyPaste plugin is off

## Known product bugs

None recorded yet. If a scenario fails on a real product bug, keep the
assertion red and document it here (do not work around in the test).
