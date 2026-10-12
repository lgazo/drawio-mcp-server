# Releasing

How to cut a release of the Draw.io MCP monorepo. Versions are bumped, tested, committed, tagged, and published by the `Release` workflow; a human fills in one form and a short list of things that remain manual by design.

## How to release

Open **GitHub → Actions → Release → Run workflow** and fill the form:

- **Scope** — what to release: `server` (npm), `extension` (Chrome Web Store / AMO zips), or `both` (one version on both).
- **Version** — optional. Leave it empty and the version is auto-computed from conventional commits since the component's last tag: `feat` bumps the minor digit, `fix` the patch digit, and `feat!:` / `!` the major digit. Type an explicit `X.Y.Z` to override.

One click starts the pipeline, which runs end to end on `main`:

1. **Resolve and validate the version.** The resolved number must be valid semver, strictly greater than every in-scope component's current version, and must not collide with an existing tag. For scope `both`, the same version is applied to the server and the extension.
2. **Bump the coupled files** via `scripts/release.mjs bump`: server and plugin `package.json` in lockstep, the `VERSION` fallback constant in `packages/drawio-mcp-server/src/index.ts`, the server README (synced from the root README), and the extension `package.json`. The compat package gets a patch bump of its own line only when its files actually changed since the last server tag.
3. **Generate the changelog** from the conventional commits since the component's last tag.
4. **Run the gates.** Release-script unit tests, a blocking `pnpm audit --audit-level=moderate`, a full build, lint and format checks, and the package tests — server tests (including Playwright and asset prefetch), extension tests, and plugin tests, each run only for the components in scope.
5. **Commit and tag.** The version bumps are committed to `main` as `chore(release): <version> <scope>` by `github-actions[bot]`, `main` is pushed, and tags are created: `vX.Y.Z` for server/both and `drawio-mcp-extension-vX.Y.Z` for extension/both. A GitHub Release with the changelog as notes is created for each tag.
6. **Publish.** The workflow calls the publish jobs directly (a release created with the `GITHUB_TOKEN` does not fire a release event, so the workflow must invoke them itself):
   - `server-publish.yml` runs the parity gate, installs, audits again, builds, smoke-tests the packed tarball, then runs `pnpm publish --provenance --access public` to npm using the `NPM_TOKEN` secret.
   - `extension-publish.yml` builds and zips the extension for Chrome and Firefox, uploads the zips as assets of the extension's GitHub Release, and — when the `CWS_*` secrets are configured — uploads a draft to the Chrome Web Store. Any CWS failure surfaces as a workflow warning; the release itself is not blocked.

## Release scenarios

| Scope       | Version applies to                 | Tags created                               | Published to                          |
| ----------- | ---------------------------------- | ------------------------------------------ | ------------------------------------- |
| `server`    | Server (`drawio-mcp-server`)       | `vX.Y.Z`                                   | npm                                   |
| `extension` | Extension (`drawio-mcp-extension`) | `drawio-mcp-extension-vX.Y.Z`              | GitHub Release zips + CWS draft       |
| `both`      | Server and extension, same version | `vX.Y.Z` and `drawio-mcp-extension-vX.Y.Z` | npm + GitHub Release zips + CWS draft |

## What stays manual

The pipeline automates everything mechanical and deliberately keeps a few judgment calls with a human:

- **README "Key Highlights" prose.** New user-facing features get a short bullet in the root README's "Key Highlights" section, pushed to `main` _before_ running the form — the bump step copies the root README over the server package README, so the section must already read the way the release should be announced. Keep exactly two version chips in the section: the one being released and the one before.
- **Chrome Web Store submission.** A draft is uploaded automatically when the `CWS_*` secrets exist, but a human clicks "Submit for review" in the CWS dashboard; the store review itself is external to this repo.
- **Firefox Add-ons (AMO) submission.** Not automated: the AMO signing API has no draft state (`web-ext sign --channel listed` publishes immediately), so the signed submission is done manually from the zips attached to the extension's GitHub Release.
- **Claude plugin version bumps.** The plugin (`drawio-mcp-claude-plugin`) is versioned independently of the server and is never bumped by the pipeline. Bump `packages/drawio-mcp-claude-plugin/.claude-plugin/plugin.json` and the matching entry in `.claude-plugin/marketplace.json` together in the same commit by hand. The pipeline enforces the parity between them — the parity gate blocks an npm publish if the two manifests drift — but the bump itself is yours.

## Packages and version coupling

| Package                    | Current version | Published where                                      |
| -------------------------- | --------------- | ---------------------------------------------------- |
| `drawio-mcp-server`        | `2.3.0`         | npm                                                  |
| `drawio-mcp-extension`     | `2.3.0`         | Chrome Web Store / AMO (zips built by CI)            |
| `drawio-mcp-plugin`        | `2.3.0`         | not published; consumed by server + extension builds |
| `drawio-mcp-compat`        | `0.1.0`         | not published; vendored into server builds           |
| `drawio-mcp-dev-proxy`     | `1.0.0`         | not published; dev-only                              |
| `drawio-mcp-claude-plugin` | `0.2.0`         | Claude Code marketplace (this repo)                  |

The monorepo root (`drawio-mcp`, `2.1.0`) is `private: true` and never published.

### Version coupling rules

- **Server and plugin release in lockstep.** `drawio-mcp-plugin`'s `dist/` output is embedded into the server build, so the pipeline bumps both `package.json` files to the same version on every server release (plugin tests run before anything ships).
- **The `VERSION` fallback constant.** `packages/drawio-mcp-server/src/index.ts` carries a `const VERSION = process.env.npm_package_version ?? "…"` fallback; the pipeline bumps the literal to the new server version in the same release commit — it is what the server prints and reports when `npm_package_version` is absent.
- **Compat bumps only on change.** `drawio-mcp-compat` gets a patch bump of its own version line when its files changed since the last server tag; the server build embeds its `dist/` output.
- **Plugin/marketplace parity.** `packages/drawio-mcp-claude-plugin/.claude-plugin/plugin.json` and the `plugins[0].version` entry in `.claude-plugin/marketplace.json` must share a version — they describe the same plugin and Claude Code reads the marketplace manifest as the source users pin against. The pipeline does not bump them (see "What stays manual"), but the `server-publish.yml` parity gate fails the publish if they drift. The plugin version is independent of the server version.
- **The `install` subcommand ships with `drawio-mcp-server` itself.** There is no separate install release; bumping the server version publishes the current install code alongside it.

All of these rules are enforced by the pipeline — it computes which files must move for a given scope, applies them, and fails the release if the result would violate a rule (for example on a version collision or a parity drift).

## Failure and retry

- **A gate or step fails mid-run:** re-run the failed job from the Actions tab. The release job is idempotent up to the commit step (a failed validation or gate run has touched nothing outside the runner); a failure after the commit+tag step leaves the tag in place and only the publish pending.
- **A publish job failed after tag/Release creation:** safe to retry as-is. npm rejects duplicate versions, so the server publish cannot double-ship; the parity gate re-verifies the checked-out tree against the tag before publishing again. Re-running the publish job (or dispatching `server-publish.yml` / `extension-publish.yml` manually with the version and ref) picks up exactly where it stopped.
- **A bad release shipped:** do not try to retract it — publish a new `fix:` commit to `main` and cut a new patch release through the same form. npm cannot replace a published version, and users who pinned the tag should be able to find a corrected one above it.
- **`main` must stay releasable.** The pipeline is trunk-based and releases are cut from `main`; keep every merge green so a release form run starts from a publishable tree.

> The `concurrency` group `release` serializes runs: a second dispatch while a release is in flight queues behind it rather than racing it.

## Workflow inventory

| Workflow                | Trigger                                                                                                 | What it does                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `release.yml`           | `workflow_dispatch` form (scope + optional version)                                                     | The entry point: validates, bumps coupled files, runs the gates, commits `chore(release): <version> <scope>` to `main`, tags, creates GitHub Releases, and calls the two publish jobs below. |
| `server-publish.yml`    | Reusable (`workflow_call`) — called by `release.yml`; also manually dispatchable with `version` + `ref` | Parity gate → install → blocking audit → build → pack smoke test → `pnpm publish --provenance --access public` to npm.                                                                       |
| `extension-publish.yml` | Reusable (`workflow_call`) — called by `release.yml`; also manually dispatchable with `version` + `ref` | Builds and zips the extension for Chrome and Firefox, uploads the zips as GitHub Release assets, and uploads a CWS draft when the `CWS_*` secrets exist.                                     |
| `extension-package.yml` | Manual only (unchanged)                                                                                 | Builds + zips the extension and uploads the artifacts, reading the extension's own `package.json` version for naming. Useful for ad-hoc zips that are not releases.                          |
| `claude-plugin-ci.yml`  | Push/PR touching `packages/drawio-mcp-claude-plugin/**` or `.claude-plugin/**` (unchanged)              | Audit, lint, and test the plugin package. Not a publish workflow — the marketplace serves the plugin straight from the repo.                                                                 |

Two conventions changed with this pipeline:

- **Tagging:** extension releases are tagged `drawio-mcp-extension-vX.Y.Z`; the flat `vX.Y.Z` is server-only. There are no package-scoped `drawio-mcp-server-vX.Y.Z` tags.
- **The old "a GitHub Release triggers the publishes" behavior is gone.** Releases created by the workflow's `GITHUB_TOKEN` do not fire `release` events, so `release.yml` calls the publish jobs directly via `workflow_call`. A manually created Release therefore publishes nothing — the form is the only way to publish.

Server publishes need `NPM_TOKEN` configured; provenance is produced through the release flow's `id-token: write` OIDC permissions.
