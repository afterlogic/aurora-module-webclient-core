# Aurora Core webclient module
System module that provides Web application core functionality and UI framework

# Development
This repository has a pre-commit hook. To make it work you need to configure git to use the particular hooks folder.

`git config --local core.hooksPath .githooks/`

## E2E tests (Playwright)

Desktop Knockout UI. Prefer launching from the **Aurora install root**:

```bash
npm run test:e2e-desktop
npm run test:e2e-desktop:ui
npm run test:e2e-desktop -- --setup "MailWebclient Chrome"
```

Or from this module:

```bash
npm run test:e2e:ui --setup "StandardLoginFormWebclient Chrome"
```

Full docs: [`test/e2e/README.md`](test/e2e/README.md).

Mobile suite: CoreMobileWebclient [`vue-mobile/test/e2e/README.md`](../CoreMobileWebclient/vue-mobile/test/e2e/README.md).

# License
This module is licensed under AGPLv3 license if free version of the product is used or Afterlogic Software License if commercial version of the product was purchased.
