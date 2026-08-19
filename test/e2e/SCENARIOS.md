# Desktop E2E: covered scenarios

Knockout desktop UI. Specs live in `modules/<WebclientModule>/test/e2e/*.spec.js`.

There are **35+ spec files**. Calendar has view / event / share specs; Tasks and Admin still have none.

Proposed next scenarios: [SCENARIOS-BACKLOG.md](SCENARIOS-BACKLOG.md).

Conditional `test.skip` inside a test (empty mailbox, no Team/OpenPGP tab, no SECONDARY account) are stand gates, not separate scenarios.

Run from the Aurora install root:

```bash
npm run test:e2e-desktop
npm run test:e2e-desktop -- --setup "MailWebclient Chrome"
```

Full matrix is module × Chrome / Firefox / Safari.

To jump to a topic, filter by spec file name (see the table in each module `test/e2e/README.md`) or by nested `test.describe` in Playwright UI.

---

## Login (`StandardLoginFormWebclient`)

- login form is visible
- successful sign-in
- wrong password — stay on login page
- forgot-password → return to login
- logout → login again

Specs: `login-page.spec.js`, `login.spec.js`, `auth-actions.spec.js`.

## Calendar (`CalendarWebclient`)

- open Calendar, Day / Week / Month / Today
- create event → visible in grid
- edit title and save
- edit start time and save
- all-day event
- delete event
- create calendar and open share *(SECONDARY optional)*
- PRIMARY shares calendar → SECONDARY sees it in sidebar *(requires SECONDARY)*

Specs: `calendar.spec.js`, `calendar-events.spec.js`, `calendar-share.spec.js`, `calendar-share-multiuser.spec.js`.

## Mail (`MailWebclient`)

### List / folders

- open first Inbox message
- open message and show sender chrome
- Inbox / Sent / Trash / Spam
- Unseen filter from folder badge and reset
- Starred virtual folder
- multi-select and bulk-delete in Trash
- empty Trash
- create custom folder → Move message → rename / delete
- signature: save in Settings → visible in compose
- filter by subject → message in folder
- forwarding / autoresponder: enable, save, disable
- header nav: Mail → Contacts → Calendar → Files → Settings and back
- mark read / unread in list
- open message in new window, Prev / Next
- download `.eml` from More
- empty Spam
- save attachments to Files *(plugin; skip if menu item missing)*
- Notes: create note *(skip if no Notes folder)*
- compose: change From with second sender

### Message

- details and star
- Reply (`Re:`)
- Reply all
- Forward (`Fwd:`)
- search in header
- headers from overflow menu
- Move → Trash
- move to Spam and back to Inbox
- delete from toolbar to Trash
- reply + forward to self
- advanced search by subject
- Forward as Attachment
- Resend from Sent

### Compose

- write and send
- fill CC/BCC and discard
- save draft and open from Drafts
- send draft → Sent
- minimize unsaved compose, save-and-close
- attachment in compose, open in Sent

Specs: `mail.spec.js`, `mail-folders.spec.js`, `mail-list-actions.spec.js`, `mail-actions.spec.js`, `mail-mutations.spec.js`, `mail-forward-resend.spec.js`, `compose.spec.js`, `compose-cc-bcc.spec.js`, `compose-draft.spec.js`, `compose-from.spec.js`, `mail-attachments.spec.js`, `mail-custom-folders.spec.js`, `mail-signature.spec.js`, `mail-filters.spec.js`, `mail-forward-autoresponder.spec.js`, `mail-message-window.spec.js`, `mail-notes.spec.js`, `header-nav.spec.js`.

## Files (`FilesWebclient`)

- open first file
- list + create folder + upload
- storages in sidebar
- search list
- New → folder
- New → upload and delete
- rename file / folder
- create and revoke public share link
- cut/paste into folder
- copy (original remains)
- multi-select copy into folder
- multi-select bulk delete
- download selected file
- Share with teammates dialog
- leave share (when shared item exists)
- PRIMARY shares file → SECONDARY sees it in Shared *(requires SECONDARY)*
- Personal / Corporate / Shared *(skip Shared tab if absent)*
- send file as email
- delete to Trash → Restore
- open zip as folder (`FilesZipFolder`, when enabled)
- nested folder + breadcrumbs
- preview text file (opens viewer)

Specs: `files.spec.js`, `files-actions.spec.js`, `files-extra-actions.spec.js`, `files-select-actions.spec.js`, `files-share-multiuser.spec.js`, `files-storages-send.spec.js`, `files-zip.spec.js`, `files-zip-selected.spec.js`, `files-navigation.spec.js`.

## Contacts (`ContactsWebclient`)

- open first contact
- list + create contact
- storages in sidebar and switch
- search
- create / edit name / delete contact
- create and delete group
- compose from contact email
- share → unshare from Shared
- find in mail from contact menu
- Team storage (read-only, when present)
- Send / compose with email
- multi-select bulk delete
- multi-select compose to selection
- assign to group from toolbar
- rename group
- import `.vcf` → contact in list
- export (file download)
- extra fields phone / address: save and reopen

Specs: `contacts.spec.js`, `contacts-actions.spec.js`, `contacts-extra-actions.spec.js`, `contacts-select-actions.spec.js`, `contacts-import-export.spec.js`.

## Settings (`SettingsWebclient`)

- open settings and logout
- walk all tabs
- OpenPGP tab (when present)
- Paranoid Encryption tab
- OpenPGP: generate button visible (without creating a key)
- OpenPGP: toggle mail option
- Paranoid Encryption: enable controls
- add second mailbox and switch PRIMARY/SECONDARY *(requires different accounts)*
- Common/Mail: change layout → Mail opens in it *(skip if `AllowChangeLayout` false)*
- identity display name → visible in compose
- 2FA: open setup form *(do not enable on stand)*

Specs: `settings.spec.js`, `settings-actions.spec.js`, `settings-auth.spec.js`, `settings-mail.spec.js`.
