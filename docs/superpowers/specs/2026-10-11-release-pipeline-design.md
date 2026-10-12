# Release Pipeline with Limited Human Involvement — Design

Date: 2026-10-11
Status: proposed (awaiting review)
Scope: release automation for the whole monorepo; design only, no implementation yet.

## Problem

`docs/release.md` describes a 9-step, fully manual release procedure: hand-edit
version bumps across coupled files, hand-write release notes into README
"Key Highlights", hand-run `pnpm pack` + fresh-install smoke test, hand-tag,
hand-create the GitHub Release, then hand-verify the extension zips. Every
step is a place to forget a coupled file (the `VERSION` fallback constant,
`marketplace.json` parity, the server README copy) or to release an untested
package. The repo already has the publishing half automated
(`server-publish.yml`, `extension-publish.yml` fire on `release: created`) —
what is missing is the **preparation half**: versioning, changelog, tagging,
release creation, and pre-publish validation.

Goal: reduce human involvement to **one decision point** — merging a
release PR — with everything before it (version math, coupled-file bumps,
changelog, smoke tests) and everything after it (tag, GitHub Release, npm
publish with provenance, extension zips) automated.

## Non-goals

- No change to what gets published or where (npm for the server, zips + store
  upload for the extension, marketplace served from `main` for the Claude
  plugin).
- No new versioning scheme for the server: server tags stay flat `vX.Y.Z`.
  The extension moves from version-lockstep with the server to an independent
  version line (see "Two release components" below) — it is `private`, not on
  npm, and its version only names the zips and the store submissions.
- No replacement of the existing CI workflows; the pipeline composes with them.
- The pipeline submits new extension versions to the stores; the stores' own
  review queues (CWS review, AMO automated review) are external and cannot be
  automated away — "limited human involvement" ends at submission.

## Constraints (from the current repo)

1. **Version coupling** (`docs/release.md`): server, plugin, and compat bump
   in lockstep (server build embeds their `dist/`); extension `package.json`
   version names the CI-produced zips;
   `packages/drawio-mcp-server/src/index.ts` has a literal `VERSION` fallback
   that must match; `plugin.json` and `.claude-plugin/marketplace.json` share
   a version that is independent of the server.
2. **npm publish requires a GitHub Release to exist** (provenance uses the
   release OIDC flow with `id-token: write`), so the pipeline must create the
   Release itself for the publish workflows to fire.
3. **Conventional commits are already the house style** (history:
   `feat:`, `fix(security):`, `docs:`, `chore(release):`, …).
4. **Known bug**: `server-publish.yml`'s `release: created` trigger carries a
   `paths:` filter, which release events ignore. Noted in two prior specs;
   fixed as part of this work since the pipeline leans on that trigger.
5. **Release notes are prose** (README "Key Highlights" section). Automation
   can generate a changelog from commits, but user-facing highlight prose
   stays a human edit — made **in the release PR**, not on `main` after tag.

## Approaches considered

### A. release-please (recommended)

Google's release-please bot watches `main`, collects conventional commits, and
maintains a **release PR per releaseable component** containing: version
bumps, generated changelog, and — via `extra-files` / custom updater config —
the coupled-file edits (VERSION fallback constant, server README copy). When
a PR merges, the bot tags that component and creates the GitHub Release,
which fires the matching publish workflow.

- Human involvement: review + merge the release PR (one click), optionally
  editing the Highlights prose inside it first.
- Fits an already-conventional-commit repo with zero contributor overhead —
  no per-PR ritual.
- Version math and the coupled-file bumps are configuration (per-component
  `extra-files`), not code.
- Weakness: version intent is inferred from commit types; a badly typed commit
  produces a wrong bump. Mitigated by reviewing the release PR before merge
  (the human gate) and by commit-lint discipline already in place culturally.

### B. changesets

Contributors add a changeset file per PR declaring the bump intent; the bot
aggregates them into a "Version Packages" PR.

- More explicit intent, first-class pnpm monorepo support.
- But it adds human involvement on **every** feature/fix PR (the opposite of
  the issue's goal), and the coupling rules (lockstep plugin/compat, VERSION
  constant, marketplace parity) still need custom post-processing anyway.

### C. semantic-release, fully automatic

Publishes on every conventional commit landing on `main`. Zero human
involvement — but: no batching point, releases every `feat:` immediately,
gives up the release PR as the single reviewable artifact, and couples release
cadence to merge cadence in a repo where a release also produces
store-facing extension artifacts. Highest blast radius per mistake; rejected.

**Choice: A.** It keeps exactly one human gate, reuses conventional commits
the repo already writes, and the merge of the release PR is a natural place
for a human to sanity-check the version delta before it becomes immutable.

## Design

### New workflow: `release-please.yml` — two release components

```yaml
on:
  push:
    branches: [main]

permissions:
  contents: write        # maintain release PR, create tag + Release
  pull-requests: write   # release PR management
```

release-please runs in **manifest mode** with a
`release-please-config.json` defining two independently releasable
components:

| Component | Path (trigger scope) | Tag | Publishes |
|---|---|---|---|
| `drawio-mcp-server` | `packages/drawio-mcp-server/**` (+ extra-files: plugin, compat, VERSION constant) | `vX.Y.Z` (`include-component-in-tag: false`) | npm via `server-publish.yml` |
| `drawio-mcp-extension` | `packages/drawio-mcp-extension/**` | `drawio-mcp-extension-vX.Y.Z` | zips + store upload via `extension-publish.yml` |

- Only components with commits since their previous release are bumped. A
  server-only change produces a release PR that bumps the server component
  only; no extension tag, no extension publish, no store submission.
- Both components configured with `separate-pull-requests: true`, so each
  component has its own release PR and can be merged (released) on its own
  timeline.
- Action and bootstrap pinned to a commit SHA, matching the repo's existing
  supply-chain policy (`security-scan.yml` already pins all Actions).
- **Claude plugin stays decoupled**: not a release-please component. Its
  version bumps continue to be manual commits (rare, metadata-only; the
  marketplace reads from `main`).
- **plugin/compat routing** (`packages/drawio-mcp-plugin`, `-compat`): their
  code is embedded in both the server and the extension builds. Both
  components must release when they change. Exact mechanism (component path
  ownership vs `extra-files` globs, and whether release-please treats
  extra-file changes as release triggers) is an implementation detail to
  settle while writing the config; the fallback if per-component routing
  proves unreliable is a combined release for shared-code changes — which is
  the current behavior anyway.
- The `linked-versions` plugin is deliberately NOT used: decoupled version
  lines are the point (server deploys without touching the extension).

### The release branch

release-please does create a branch — one per component, maintained by the
bot, not by humans: `release-please--branches--main--components--<component>`
(e.g. `...--drawio-mcp-extension`). It is not a long-lived release branch in
the gitflow sense and its name is load-bearing (release-please parses it to
find its PRs); it is never renamed or reused for other work. It holds the
pending release commits for the component. New commits on `main` that touch
that component are folded into the same open PR; merging the PR is the
release event, and the bot then tags from the merged commit and deletes the
branch. Humans interact with it only as a normal PR in the review UI.

### Release PR as the single human gate

The release PR contains, generated:

1. `package.json` version bumps — only for components with changes: the
   server component PR bumps `drawio-mcp-server` (plus plugin/compat
   lockstep, per the coupling rules); the extension component PR bumps
   `drawio-mcp-extension`. The root package is untouched — it is `private`.
2. The `VERSION` fallback literal in
   `packages/drawio-mcp-server/src/index.ts`, updated in lockstep via a
   targeted custom updater (JSON-string literal replacement, not a regex over
   the whole file).
3. Changelog generated from conventional commits.
4. `cp README.md packages/drawio-mcp-server/README.md` — the npm README sync,
   executed as a workflow step, so the copy is never stale.

The human's job in the PR (all optional except the merge):

- Update README "Key Highlights" prose + version chips (release notes stay
  human prose, per constraint 5) — only in a server-component release PR.
- Sanity-check the proposed version delta.
- Merge. That is the entire ceremony.

CI runs on the release PR branch like any other PR, so the exact tree that
will be tagged is what CI validated.

### Release scenarios

The two components support the three release situations natively —
release-please's default behavior is to bump only components with commits
since their previous release, so the situation is decided by what changed
since the last release, not by a mode switch:

| Situation | Trigger | What happens on merge |
|---|---|---|
| Server only | Changes only in `packages/drawio-mcp-server/**` (plus plugin/compat, which ride the server component) | Release PR bumps server only → tag `vX.Y.Z` → GitHub Release → `server-publish.yml` → npm. No extension tag, so nothing on the extension side runs — the extension's version line and store listings stay untouched. |
| Extension only | Changes only in `packages/drawio-mcp-extension/**` | Extension tag → `extension-publish.yml` → zips + store upload. No npm publish. |
| Both together | Both components have pending changes | Both tags/releases fire, each publish workflow runs for its own tag. |

**Aligned versions in the "both together" case** (owner preference: keep the
two version lines equal when co-releasing):

- The `linked-versions` plugin is deliberately **not** used: per the
  release-please docs, when any component in a linked group is updated, the
  whole group is bumped to the same version — which would force an extension
  release (zip build + store submission of an unchanged extension) on every
  server-only release, defeating the server-only scenario.
- Instead: with `separate-pull-requests: true`, each component's release PR
  is open at the same time. Each version is computed independently from that
  component's own conventional commits. If both moved the same bump level
  from an aligned base (e.g. a feature touching both), the proposed versions
  already align — merge both PRs as-is.
- When the computed versions differ, **align by hand in the extension's
  release PR before merging**: set the extension version (in
  `packages/drawio-mcp-extension/package.json`, the
  `.release-please-manifest.json` entry, and the changelog heading) to the
  server's proposed `X.Y.Z`, then merge. Caveats: release-please regenerates
  an open release PR on the next push to `main`, overwriting un-merged
  manual edits — so align and merge in one sitting; and whether the created
  tag takes its version from the merged manifest or the PR title must be
  verified during implementation (the parity gate would catch a mismatch at
  publish time either way).
- The extension is `private` and off npm; its version only names zips and
  store submissions, so a drifted version in a combined release is a
  cosmetic concern, not a correctness one.

### Post-merge: tag → Release → existing publish workflows

release-please tags and creates the GitHub Release with the generated
changelog, per component. Existing workflows then fire, with these edits:

- **`server-publish.yml`**: trigger on release of tag `vX.Y.Z` (release event;
  the invalid `paths:` filter from constraint 4 is dropped). Insert two steps
  between build and publish:
  1. **Version-parity gate** — fail if `packages/drawio-mcp-server` version ≠
     release tag, `plugin.json` vs `marketplace.json` parity, `VERSION`
     fallback constant matches `package.json`. A plain `set -euo pipefail`
     shell script under `scripts/`, same home as
     `check-audit-overrides.sh`.
  2. **Pack smoke test** — `pnpm pack` in a clean job, `npm install` the
     tarball into a temp dir, run `npx drawio-mcp-server --editor`
     expecting the new version string. Automates manual procedure steps
     6a–6c so the release PR's tree is proven installable *before* the npm
     publish step in the same job (blocking audit already runs there).
- **`extension-publish.yml`**: trigger on release of tag
  `drawio-mcp-extension-vX.Y.Z`. After zipping:
  1. **Upload zips as Release assets** — `gh release upload "$TAG" <zips>`
     step (needs `contents: write`), so the Release page is the single
     artifact download point. This is standard and already part of the
     design; it just needs the workflow to have write permission.
  2. **Store upload** — submit the new version to both stores automatically:
     - **Chrome Web Store**: Chrome Web Store Publish API (via
       `chrome-webstore-upload` or the BPP action). Requires repo secrets
       `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, and the
       extension's app ID. Uploads the chrome zip and submits it to the
       review queue; the store's own review (hours to days) follows and is
       outside the pipeline.
     - **Mozilla Add-ons**: `web-ext sign --channel listed --source-dir …`
       with `WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET` from AMO. Automated
       review; the signed `.xpi` is the published artifact. The firefox zip
       can also be attached to the Release.
  3. The store-upload steps are **hard-gated on the extension tag** — they
     only run for `drawio-mcp-extension-vX.Y.Z` releases, never on a
     server-only release. Failing store upload does not fail the zip build;
     the zips on the Release page are the fallback for a manual submission.

The blocking `pnpm audit --audit-level=moderate` stays in both publish
workflows — a release with a new advisory fails there rather than on `main`
(deliberate: regular CI keeps its non-blocking audit).

### Failure and retry behavior

- Publishing is tag-driven and idempotent-shaped: if a publish job fails
  (transient network, audit gate), re-run the failed workflow from the
  Release page; npm rejects duplicate versions, so a half-completed publish
  is safe to retry.
- If the release PR merges but a publish is found broken, the fix is a new
  `fix:` commit + a fresh patch release through the same pipeline — no
  special hotfix lane. `main` is expected releasable at all times
  (trunk-based, already the current practice).
- Failed release-please bootstrap or config errors surface as check failures
  on the release PR — the human sees them at the gate, not after tagging.

## Testing

- Config-as-code review: the release-please manifest lives in-repo; a
  `workflow_dispatch`-triggered **dry-run check** (plan mode — bot computes
  the would-be release PR contents and writes them to the job summary without
  opening it) can be run manually before first real use.
- Version-parity gate script is plain shell; test it in CI against fixture
  trees (matching versions pass, drifted versions fail).
- First real release under the pipeline should be a patch release, executed
  as a supervised run, with `docs/release.md` updated in the same PR to
  describe the new procedure.

## Migration

1. **Secrets (owner setup, one-time)**: `CWS_CLIENT_ID`,
   `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN` (Google Cloud OAuth for the
   Chrome Web Store API) and `WEB_EXT_API_KEY`, `WEB_EXT_API_SECRET` (AMO
   developer API keys). `NPM_TOKEN` already exists. Until the store secrets
   exist, the store-upload steps run behind a "skip if secrets absent"
   guard and the zips on the Release page serve as the manual path.
2. Add `release-please.yml` + manifest config; fix `server-publish.yml`
   trigger; add parity script + smoke-test steps; retrigger
   `extension-publish.yml` on the extension tag, attach zips to the
   Release, add store-upload steps.
3. Update `docs/release.md` to the new procedure (human steps: keep writing
  Highlights, merge the release PR, re-run failed publish workflows).
4. Supervised patch release validates the server path end-to-end; a
   supervised extension release validates zips + store submission.
5. (Optional, later) A second component for the Claude plugin if its
   version bumps get frequent.

## Open questions for review

1. Release **cadence**: does release-please open a PR per `feat`/`fix` batch
   (immediate) or should it be throttled (e.g. weekly) so one release PR
   accumulates? Default proposal: immediate, merge when you want to ship.
2. **Store submission mode**: auto-submit the uploaded CWS version to the
   review queue immediately, or upload as a draft for a one-click human
   publish in the store dashboard? Default proposal: auto-submit — the merge
   of the release PR is the human approval of the release itself.
3. The extension version line now drifts from the server's (both are
   `2.3.0` today by convention). "Release scenarios" defines the alignment
   mechanism for combined releases: versions align automatically when both
   components move one bump level, and a manual edit in the extension's
   release PR aligns the rest. Confirm that level of convenience is enough,
   or whether the rare combined release should instead be forced through a
   single combined release PR (`separate-pull-requests: false` for those
   merges) with both versions edited by hand.