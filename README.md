# Aurora Core webclient module
System module that provides Web application core functionality and UI framework

# Development
This repository has a pre-commit hook. To make it work you need to configure git to use the particular hooks folder.

`git config --local core.hooksPath .githooks/`

## E2E tests (Playwright)

Run desktop and mobile E2E tests from the **Aurora install root** with the interactive launcher (it lives in this module, `test/e2e/scripts/e2e-tui.js`):

```bash
npm run test:e2e:tui
```

Setup and details: [`test/e2e/README.md`](test/e2e/README.md). Mobile suite: CoreMobileWebclient [`vue-mobile/test/e2e/README.md`](../CoreMobileWebclient/vue-mobile/test/e2e/README.md).

# License
This module is licensed under AGPLv3 license if free version of the product is used or Afterlogic Software License if commercial version of the product was purchased.
