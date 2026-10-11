# zh-CN Localization Design

Date: 2026-10-11 · Issue: DRAW-9 · Status: approved (scope confirmed on issue, 2026-10-11 — see DRAW-9 thread)

## Goal

Localize Draw.io MCP Extension user experience for Chinese (zh-CN) users:
extension UI first (Phase 1), documentation second and third (Phase 2/3),
driven by an automated translation pipeline. All decisions below were
confirmed by the workspace owner on DRAW-9.

## Confirmed decisions

| Question | Decision |
|---|---|
| Locales now | zh-CN only, but the i18n scaffold stays locale-ready (adding a locale = one new catalog) |
| Tool / schema descriptions, MCP error strings, plugin command prompts | Out of scope — stay English (agent-facing) |
| Extension UI | Translate popup, options, compat banner, content overlay |
| Docs | README + TOOLS.md + CONFIG.md + TROUBLESHOOTING.md translated |
| Translation source | Automated pipeline; no mandatory native-speaker review step |
| Store listings | Not in repo; owner updates Chrome Web Store / AMO manually |

## Phase 1 — Extension UI

### Catalogs

- `packages/drawio-mcp-extension/public/_locales/en/messages.json`
- `packages/drawio-mcp-extension/public/_locales/zh_CN/messages.json`

WXT copies `public/` verbatim into the build output, so both catalogs ship in
the bundle; Chrome's `browser.i18n` and our manual override can both load them.
Message format is the standard WebExtension `messages.json` schema (with
`$1`-style placeholders). English is the source of truth.

### Language selection

- Resolved language = manual override (stored under `drawio-mcp-language` in
  extension storage) when it is `en` or `zh-CN`; otherwise `auto`, which
  delegates to `browser.i18n.getMessage` (browser UI locale, falls back to
  the `en` catalog via `default_locale`).
- `default_locale: "en"` is added to the manifest in `wxt.config.ts`.
- Manual override selector added to the Options page (Auto / English / 中文).
  Manifest display name stays English in v1; store listing handles discovery.

### Module layout (`packages/drawio-mcp-extension/utils/`)

- `i18n.ts` — pure core (`selectLanguage`, placeholder substitution, catalog
  key parity checks) + browser-facing helpers (`loadCatalog`, `createTranslator`).
- `useI18n.ts` — React hook returning a stable `t()`; used by App,
  CompatBanner, Options. Content script (`entrypoints/content.ts`) uses the
  non-React helpers.

### Testing

The extension package gets a jest setup mirroring `drawio-mcp-plugin`
(ts-jest ESM, `src/**/*.test.ts`, jest devDeps). Tests cover: language
selection rules, placeholder substitution, en/zh-CN key parity (both files
imported directly — every message key in `en` must exist in `zh_CN`), and the
translator wrapper with a mocked catalog loader.

## Phase 2+3 — Documentation

- Translated outputs: `README.zh-CN.md`, `TOOLS.zh-CN.md`, `CONFIG.zh-CN.md`,
  `TROUBLESHOOTING.zh-CN.md` at repo root, each opening with a banner
  stating it is a machine-translated snapshot and English is canonical.
- Root README links the language switch at the top.
- English docs remain canonical; translations are regenerated artifacts.

## Translation pipeline

`scripts/translate.mjs` (repo root, Node ≥ 22, no new runtime deps — uses
global `fetch`):

- `node scripts/translate.mjs docs [files...]` — machine-translate the given
  English docs to `<name>.zh-CN.md`.
- `node scripts/translate.mjs locales` — gap-fill
  `public/_locales/zh_CN/messages.json` from `public/_locales/en/messages.json`
  (only missing keys are translated; existing keys untouched).
- `--check` — CI mode: locales key parity + every registered doc has a
  `.zh-CN.md` with the snapshot banner. Exit 1 on drift. No API key needed.
- `--model <id>` / `--dry-run` / `--lang zh-CN` flags.
- Provider: Anthropic Messages API (`ANTHROPIC_API_KEY`), request-per-chunk
  with retry; structured JSON output for `locales`, raw markdown for `docs`.
- `pnpm translate` alias. Absent API key → clear error (never silent pass).

Tool descriptions, schema descriptions, MCP error strings, and plugin command
prompts are explicitly not wired into the pipeline.

## Out of scope

- More locales beyond zh-CN (scaffold stays ready), manifest name
  localization, store listing automation, runtime tool-description i18n,
  hosted-editor overlay beyond existing plugin strings.

## Verification

- `pnpm --filter drawio-mcp-extension test` (new), `compile` (tsc), and
  `build` for chrome + firefox targets.
- `pnpm --filter drawio-mcp-server test` untouched-but-green (server code unmodified).
- `scripts/translate.mjs --check` green after generating translations with the
  real provider.