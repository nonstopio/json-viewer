# [1.3.0](https://github.com/nonstopio/json-viewer/compare/v1.2.0...v1.3.0) (2026-07-21)


### Bug Fixes

* cap graph nodes so large documents don't freeze the tab ([9714a8f](https://github.com/nonstopio/json-viewer/commit/9714a8f109e716b644f33e1ca76e3d414b74a718))
* count each search occurrence and highlight matched text ([588c72d](https://github.com/nonstopio/json-viewer/commit/588c72d17b3cb0923f4bfd56c409211e59e01eb7))
* make graph edges visible and fix pan/zoom UX ([b958bce](https://github.com/nonstopio/json-viewer/commit/b958bcebd6b6d377db391b676d60c4a96854f5bc))
* zoom-to-fit matched node on graph search ([48f2c05](https://github.com/nonstopio/json-viewer/commit/48f2c0530a1434ae3883c589f5ef9bea12877ed6))


### Features

* add interactive graph view ([2dd547d](https://github.com/nonstopio/json-viewer/commit/2dd547db78711686535321725751a1a2c7819b53))
* add JSON Crack-style graph toolbar ([5a7b760](https://github.com/nonstopio/json-viewer/commit/5a7b760e0590e6c1d1a4ed266fe4874202857867))

# [1.2.0](https://github.com/nonstopio/json-viewer/compare/v1.1.0...v1.2.0) (2026-07-19)


### Features

* replace native title tooltips with a styled custom tooltip ([d653370](https://github.com/nonstopio/json-viewer/commit/d65337089e674407e6473e8650d2e2999d801013))

# [1.1.0](https://github.com/nonstopio/json-viewer/compare/v1.0.0...v1.1.0) (2026-07-19)


### Bug Fixes

* constrain editor height so long input scrolls inside the editor ([010fb90](https://github.com/nonstopio/json-viewer/commit/010fb90c4d508cb37cfd56592dd109bd1f583c5b))
* expand large nodes without hitting the JS argument limit ([ffb7bcc](https://github.com/nonstopio/json-viewer/commit/ffb7bcc818d2374f6f702e236d7ea4c1bff250a6))


### Features

* virtualized code editor, faster parsing, and an about dialog ([cccc5cb](https://github.com/nonstopio/json-viewer/commit/cccc5cbc9b50be7fabb5b3e1119605b30c1dc313))


### Performance Improvements

* virtualize tree to fix large-file freeze and high memory use ([00b2aad](https://github.com/nonstopio/json-viewer/commit/00b2aadc8c5ce2fcc906efd6073c977343950d2e))

# 1.0.0 (2026-07-19)


### Bug Fixes

* **ci:** remove pull request triggers from deployment workflow ([991398a](https://github.com/nonstopio/json-viewer/commit/991398a52ce8ceda5caecac20e03e3cc4d123552))
* enable Copy/Format/Remove-whitespace when input has content ([5f7ca9e](https://github.com/nonstopio/json-viewer/commit/5f7ca9efd7a8af770f1ee7d7619af8d7f3e40948))
* stop Copy/Format/Remove-whitespace from firing parse analytics ([325edd6](https://github.com/nonstopio/json-viewer/commit/325edd6884b3a3ec6be1ffaf7524c9ed7917ddf5))
* **ui:** improve json viewer usability and property display ([e461bf5](https://github.com/nonstopio/json-viewer/commit/e461bf508f684db42cfee9e13854a9f4f340e994))
* **upload:** increase file size limit and add error feedback ([fdd1421](https://github.com/nonstopio/json-viewer/commit/fdd14218aa5603e3946f27004e6355f884695820))


### Features

* add husky with commitlint and update UI/SEO content ([0c2df94](https://github.com/nonstopio/json-viewer/commit/0c2df940ba8b5058e4c3c22cd0617bb58ddbb9c3))
* add prettier formatting and enhance code quality ([8d20d14](https://github.com/nonstopio/json-viewer/commit/8d20d143a509a1737fe6ccbd5ae932b125037a27))
* **branding:** update company info and add footer ([613c0eb](https://github.com/nonstopio/json-viewer/commit/613c0eb579a1a1105d0c9466b7c962abdc69e65a))
* **fullscreen:** add native browser fullscreen mode for JSON tree viewer ([fe8124b](https://github.com/nonstopio/json-viewer/commit/fe8124b67e9b90a5454134d398a00554ccdcafa6))
* improve SEO with crawlable static content and metadata ([2e7686d](https://github.com/nonstopio/json-viewer/commit/2e7686db71e7a2ffdeca8413ae6346ca17fb0509)), closes [#root](https://github.com/nonstopio/json-viewer/issues/root) [#root](https://github.com/nonstopio/json-viewer/issues/root)
* **json-parser:** integrate professional error handling with auto-jump functionality ([afa0de6](https://github.com/nonstopio/json-viewer/commit/afa0de626a63c17c1c4fde9dfb4b13a008f23bca))
* remove auto-format on paste in JSON editor ([a1c16bf](https://github.com/nonstopio/json-viewer/commit/a1c16bff8d2fb471830bb04aed477e914ceae9a8))
* show app version in footer ([f9be202](https://github.com/nonstopio/json-viewer/commit/f9be2021ce75c6b835d2bbae38ecc7477a449a75))
* **ui:** add dotted connecting lines to JSON tree structure ([43b78e6](https://github.com/nonstopio/json-viewer/commit/43b78e6c13075c4942bb9a4d742c43ebd18969e4))
* **ui:** add search clear icon and update button shapes ([b547dd9](https://github.com/nonstopio/json-viewer/commit/b547dd94dd609af806cd8fc2718699ee38f3711b))
* **ui:** enhance SEO and add comprehensive copy functionality ([27bccf3](https://github.com/nonstopio/json-viewer/commit/27bccf35927184b7b2f59d1872564029fee75cc4))
* **ui:** implement JSON error cursor positioning with manual jump button ([f3ac338](https://github.com/nonstopio/json-viewer/commit/f3ac33864453e83bac615906ad389a849902b4db))
* **ui:** update sample data structure for company and user information ([5570552](https://github.com/nonstopio/json-viewer/commit/5570552c9a049c44a733e8359413f01b88cd221e))
