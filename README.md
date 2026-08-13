# Aurora Core webclient module
System module that provides Web application core functionality and UI framework

# Development
This repository has a pre-commit hook. To make it work you need to configure git to use the particular hooks folder.

`git config --local core.hooksPath .githooks/`

## E2E tests (Playwright)

Desktop Knockout UI. Prefer launching from the **Aurora install root**:

```bash
yarn test:e2e-desktop
yarn test:e2e-desktop:ui
yarn test:e2e-desktop -- --setup "MailWebclient Chrome"
```

Or from this module:

```bash
yarn test:e2e:ui --setup "StandardLoginFormWebclient Chrome"
```

Full docs:

- Install root: [`README-e2e-desktop.md`](../../README-e2e-desktop.md)
- Runner: [`test/e2e/README.md`](test/e2e/README.md)

Mobile suite: [`README-e2e-mobile.md`](../../README-e2e-mobile.md).

# License
This module is licensed under AGPLv3 license if free version of the product is used or Afterlogic Software License if commercial version of the product was purchased.
