# Desktop E2E: proposed scenarios

Backlog to close the largest gaps against current coverage in [SCENARIOS.md](SCENARIOS.md).

Already strong: Login, Mail (message / compose / folders), Files (CRUD / share / navigation), Contacts (CRUD / groups / import), Settings tabs, Calendar views / events / share.

Holes: Tasks, Admin, crypto plugins.

~30 scenarios, not a dump of every button. Skip Print, OAuth, Admin, and extra Firefox/Safari copies — the matrix already exists; write new specs for Chrome first.

---

## P0 — done

Covered in [SCENARIOS.md](SCENARIOS.md). Specs:

- Calendar: `calendar.spec.js`, `calendar-events.spec.js`, `calendar-share.spec.js`, `calendar-share-multiuser.spec.js`
- Mail: `mail-custom-folders.spec.js`, `mail-signature.spec.js`, `mail-filters.spec.js`, `mail-forward-autoresponder.spec.js`, `header-nav.spec.js`
- Files: `files-storages-send.spec.js`, `files-zip.spec.js` (`FilesZipFolder` = open zip as a folder)

---

## P1 — specs written

Covered in [SCENARIOS.md](SCENARIOS.md). Specs:

- Mail: `mail-list-actions.spec.js` (mark read/unread, empty Spam), `mail-message-window.spec.js`, `mail-attachments.spec.js` (`.eml`, save to Files), `mail-notes.spec.js`, `compose-from.spec.js` (17–24)
- Contacts: `contacts-import-export.spec.js`, extra fields in `contacts-actions.spec.js` (25–27)
- Settings: `settings-mail.spec.js` (layout, identity), 2FA in `settings-auth.spec.js` (28–30)
- Files: `files-navigation.spec.js` (31–33)

Stand gates (`test.skip`): Notes folder missing, Save-to-Files plugin off, single From sender, `AllowChangeLayout` / `FilesSortBy.Allow` false, no 2FA tab, no Import/Export formats.

---

## P2 — specs written

- OpenPGP: `mail-openpgp.spec.js` (requires `E2E_OPENPGP_PASSWORD`)
- Paranoid Encryption: `files-paranoid.spec.js`
- Calendar iCal: `calendar-ical-invite.spec.js`
- Tasks: `tasks.spec.js`
- Files public link: `files-public-link.spec.js`
- Contacts share with SECONDARY: `contacts-share-multiuser.spec.js`
- Files table view, Dropbox / Google Drive — only if the stand enables them (not automated yet)

Stand gates (`test.skip`): OpenPGP / Paranoid tabs missing, Tasks tab missing, public link action off, SharedContacts share control missing, calendar invite delivery/sync lag.

---

## Out of scope for the first waves

- Print (system dialog)
- OAuth / social login
- Admin / Tenant admin
- Rocket.Chat, Helpdesk, Mobile apps QR
- Re-running the same new scenario on Firefox/Safari

---

## Rollout

| Wave | Scenarios | Why |
|------|-----------|-----|
| 1–2 | P0 | Done — Calendar, custom folders, signature/filters, Files storages |
| 3 | 17–24, 25–27, 28–33 | P1 specs written — Mail / Contacts / Files / Settings |
| 4 | P2 | Crypto, invites, Tasks, public link — specs written |
