# Draw.io MCP Server

## Logging discipline (drawio-mcp-server)

When the `stdio` transport is active, **stdout must contain only JSON-RPC frames produced by the MCP SDK**. A single stray `console.log` will cause spec-strict clients (e.g. codex-cli) to reject the server. The rules below codify this.

1. **Stdout discipline.** `console.log`, `console.info`, `console.dir`, and `process.stdout.write` are banned in `packages/drawio-mcp-server/src/**` outside the allowlist below. The MCP SDK transport is the only legitimate writer to stdout.
2. **Logger usage.** Every production function that needs to emit a diagnostic MUST receive an `AppLogger` (`index.ts`) or `Logger` (`types.ts`) — as a parameter or via `Context.log`. Constructing a logger inside a function is forbidden except in the entry-point files listed in rule 3.
3. **Allowlist (the only files permitted to call `console.*`):**
   - `src/mcp_console_logger.ts` — the stderr bridge implementation.
   - `src/mcp_server_logger.ts` — internal `console.error` for unrecoverable invalid-level guard.
   - `src/standard_console_logger.ts` — **test-only** logger (writes to stdout). Do not import from production code.
   - `src/index.ts` — only via the module-scope `fatalLog` constant. No other site in `index.ts` may use `console.*`.
   - `src/prefetch-assets.ts` — separate CLI entrypoint; instantiates `mcp_console_logger` and uses it.
   - `src/**/*.test.ts` — tests may use `console` and `standard_console_logger` freely.
4. **Pre-boot phase.** Code that runs before `createDrawioMcpApp({ config })` returns (CLI help, config-parse failure) uses `fatalLog`. After the app exists, use `app.log` or a logger provided by dependency injection.
5. **Two logger modes.** `--logger console` (default) writes to stderr; `--logger mcp-server` sends MCP `notifications/message` to the connected client. No other logging output channels exist; do not add raw `process.stderr.write` either — go through the logger.
6. **Transport-mode awareness.** `src/stdio-transport-purity.test.ts` spawns the binary with `--transport stdio` and asserts every non-empty stdout line parses as JSON. This catches stdout contamination introduced by future commits.
7. **Browser packages exempt.** `packages/drawio-mcp-extension/**` and `packages/drawio-mcp-plugin/**` execute in a browser context and may use `console.*` freely; they share no streams with the MCP server.
8. **Lint enforcement (Biome).** `biome check src/` runs as part of `pnpm --filter drawio-mcp-server lint` and enforces `noConsole` for `src/**` with the per-file overrides matching rule 3. Biome is a devDep of `drawio-mcp-server` and pinned via the pnpm catalog.

## Codebase navigation

This project uses `roam` for codebase comprehension. Always prefer roam over Glob/Grep/Read exploration.

Before modifying any code:
1. First time in the repo: `roam understand` then `roam tour`
2. Find a symbol: `roam search <pattern>`
3. Before changing a symbol: `roam preflight <name>` (blast radius + tests + fitness)
4. Need files to read: `roam context <name>` (files + line ranges, prioritized)
5. Debugging a failure: `roam diagnose <name>` (root cause ranking)
6. After making changes: `roam diff` (blast radius of uncommitted changes)

Additional: `roam health` (0-100 score), `roam impact <name>` (what breaks),
`roam pr-risk` (PR risk), `roam file <path>` (file skeleton).

Run `roam --help` for all commands. Use `roam --json <cmd>` for structured output.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->
