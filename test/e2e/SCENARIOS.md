# Desktop E2E: covered scenarios

Knockout desktop UI. Specs live in `modules/<WebclientModule>/test/e2e/*.spec.js`.

There are **35+ spec files**. Calendar, Tasks, and Admin: Calendar now has P0 specs; Tasks and Admin still have none.

Proposed next scenarios: [SCENARIOS-BACKLOG.md](SCENARIOS-BACKLOG.md).

Conditional `test.skip` inside a test (empty mailbox, no Team/OpenPGP tab, no SECONDARY account) are stand gates, not separate scenarios.

Run from the Aurora install root:

```bash
npm run test:e2e-desktop
npm run test:e2e-desktop -- --setup "MailWebclient Chrome"
```

Full matrix is module × Chrome / Firefox / Safari.

---

## Login (`StandardLoginFormWebclient`)

- форма логина видна
- успешный вход
- неверный пароль — остаёмся на логине
- forgot-password → возврат на логин
- logout → login снова

Specs: `login-page.spec.js`, `login.spec.js`, `auth-actions.spec.js`.

## Calendar (`CalendarWebclient`)

- открыть Calendar, Day / Week / Month / Today
- создать событие → видно в сетке
- править название и сохранить
- править время начала и сохранить
- all-day событие
- удалить событие
- создать календарь и открыть share *(SECONDARY опционально)*
- PRIMARY шарит календарь → SECONDARY видит в сайдбаре *(нужен SECONDARY)*

Specs: `calendar.spec.js`, `calendar-events.spec.js`, `calendar-share.spec.js`, `calendar-share-multiuser.spec.js`.

## Mail (`MailWebclient`)

### Список / папки

- открыть первое письмо Inbox
- открыть письмо и показать sender chrome
- Inbox / Sent / Trash / Spam
- Unseen-фильтр с бейджа папки и сброс
- виртуальная папка Starred
- мультивыбор и bulk-delete в Trash
- очистить Trash
- создать пользовательскую папку → Move письма → переименовать / удалить *(падает: после rename delete disabled, IMAP Mailbox doesn't exist)*
- signature: сохранить в Settings → видно в композе
- filter по теме → письмо в папку
- forwarding / autoresponder: включить, сохранить, выключить
- шапка: Mail → Contacts → Calendar → Files → Settings и обратно
- пометить прочитанным / непрочитанным в списке
- открыть письмо в новом окне, Prev / Next
- скачать `.eml` из More
- очистить Spam
- сохранить вложения в Files *(плагин; skip если пункта нет)*
- Notes: создать заметку *(skip если нет папки Notes)*
- композ: сменить From при втором отправителе

### Письмо

- details и звезда
- Reply (`Re:`)
- Reply all
- Forward (`Fwd:`)
- поиск в шапке
- заголовки из overflow-меню
- Move → Trash
- в Spam и обратно в Inbox
- удаление с тулбара в Trash
- reply + forward себе
- advanced search по теме
- Forward as Attachment
- Resend из Sent

### Композ

- написать и отправить
- CC/BCC заполнить и discard
- сохранить черновик и открыть из Drafts
- отправить черновик → Sent
- свернуть несохранённый композ, save-and-close
- вложение в композе, открыть в Sent

Specs: `mail.spec.js`, `mail-folders.spec.js`, `mail-list-actions.spec.js`, `mail-actions.spec.js`, `mail-mutations.spec.js`, `mail-forward-resend.spec.js`, `compose.spec.js`, `compose-cc-bcc.spec.js`, `compose-draft.spec.js`, `mail-attachments.spec.js`, `mail-custom-folders.spec.js`, `mail-signature.spec.js`, `mail-filters.spec.js`, `mail-forward-autoresponder.spec.js`, `header-nav.spec.js`, `mail-p1.spec.js`.

## Files (`FilesWebclient`)

- открыть первый файл
- список + создать папку + загрузить
- стораджи в сайдбаре
- поиск по списку
- New → папка
- New → загрузка и удаление
- переименовать файл / папку
- public share link создать и снять
- cut/paste в папку
- copy (оригинал остаётся)
- multi-select copy в папку
- multi-select bulk delete
- download выбранного файла
- диалог Share with teammates
- leave share (если есть shared)
- PRIMARY шарит файл → SECONDARY видит в Shared *(нужен SECONDARY)*
- Personal / Corporate / Shared *(Shared skip если вкладки нет)*
- send file as email
- удалить в Trash → Restore
- открыть zip как папку (`FilesZipFolder`, если включён)
- вложенная папка + breadcrumbs
- сортировка списка *(skip если `FilesSortBy.Allow` false)*
- превью текстового файла (откроется viewer)

Specs: `files.spec.js`, `files-actions.spec.js`, `files-extra-actions.spec.js`, `files-select-actions.spec.js`, `files-share-multiuser.spec.js`, `files-storages-send.spec.js`, `files-zip.spec.js`, `files-zip-selected.spec.js`, `files-p1.spec.js`.

## Contacts (`ContactsWebclient`)

- открыть первый контакт
- список + создать контакт
- стораджи в сайдбаре и переключение
- поиск
- создать / править имя / удалить контакт
- создать и удалить группу
- compose с email контакта
- share → unshare из Shared
- find in mail из меню контакта
- Team storage (read-only, если есть)
- Send / compose с email
- multi-select bulk delete
- multi-select compose выбранным
- назначить в группу с тулбара
- переименовать группу
- импорт `.vcf` → контакт в списке
- экспорт (скачивание файла)
- доп. поля телефон / адрес: сохранить и открыть снова

Specs: `contacts.spec.js`, `contacts-actions.spec.js`, `contacts-extra-actions.spec.js`, `contacts-select-actions.spec.js`, `contacts-p1.spec.js`.

## Settings (`SettingsWebclient`)

- открыть настройки и logout
- пройти все вкладки
- вкладка OpenPGP (если есть)
- вкладка Paranoid Encryption
- OpenPGP: видна кнопка generate (без создания ключа)
- OpenPGP: тоггл mail-опции
- Paranoid Encryption: контролы enable
- добавить второй ящик и переключаться PRIMARY/SECONDARY *(нужны разные аккаунты)*
- Common/Mail: сменить layout → Mail открывается в нём *(skip если `AllowChangeLayout` false)*
- identity display name → видно в композе
- 2FA: открыть форму настройки *(без включения на стенде)*

Specs: `settings.spec.js`, `settings-actions.spec.js`, `settings-auth.spec.js`, `settings-p1.spec.js`.
