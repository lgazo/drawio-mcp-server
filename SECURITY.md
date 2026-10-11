# Security Policy

Draw.io MCP Server exposes a WebSocket endpoint to a browser-hosted Draw.io editor and executes MCP tool calls that manipulate diagrams. This document describes how to report vulnerabilities and the security model users should assume when deploying the server.

> **Best-effort project.** Draw.io MCP Server is a volunteer-run open-source project maintained in spare time. Everything below — response times, fixes, hardening advice — is offered on a best-effort basis with no service-level guarantee. If you need contractual security response, do not depend on this project without an internal fork or a support agreement negotiated separately.

## Supported Versions

Security fixes are attempted, on a best-effort basis, for the most recent minor release of each package on the `2.x` line. Older lines are patched only when the fix is trivial to backport.

| Package                | Best-effort support |
| ---------------------- | ------------------- |
| `drawio-mcp-server`    | `2.x`               |
| `drawio-mcp-plugin`    | `2.x`               |
| `drawio-mcp-extension` | `2.x`               |
| `drawio-mcp-compat`    | `0.x`               |

Anything below `2.0.0` for the server, plugin, and extension is unsupported.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security problems.**

Please use GitHub's private security advisory workflow:

1. Go to <https://github.com/lgazo/drawio-mcp-server/security/advisories/new>
2. Fill in the report. GitHub notifies the maintainers privately.

A GitHub account is required. If you do not have one and cannot create one, contact the maintainer through the profile page at <https://github.com/lgazo> and request a private channel — please do not include vulnerability details in that first message.

### What to include

- Affected package and version (`drawio-mcp-server@2.2.0`, etc.).
- Transport in use (`stdio`, `http`, WebSocket) and whether TLS is enabled.
- Deployment mode (built-in editor, browser extension, Docker image, `npx`).
- Minimal reproduction: MCP tool call, diagram XML, or network trace.
- Impact assessment (RCE, data exfiltration, DoS, information disclosure).

### Response expectations

Reports are handled on a best-effort basis by volunteers. There are no guaranteed SLAs. As a rough indication of what maintainers aim for:

| Stage                        | Best-effort aim    |
| ---------------------------- | ------------------ |
| Acknowledgement              | a few days         |
| Initial triage / severity    | a couple of weeks  |
| Fix or mitigation            | when time permits, prioritised by severity |
| Public disclosure (default)  | after a fix ships, typically within ~90 days of the report |

Timelines shift — often significantly — for issues that require coordination with upstream projects (Draw.io, Playwright, MCP SDK), and for anything landing during periods when maintainers are unavailable. If you need a faster turnaround, please say so in the report; it may or may not be possible.

### Disclosure

The project aims to follow coordinated disclosure. Once a fix ships, the advisory is published on the GitHub Security tab and referenced in the release notes. Reporters are credited unless they request otherwise. If a fix is not feasible within a reasonable window, maintainers may instead publish an advisory with mitigation guidance so users can protect themselves.

## Threat Model and Trust Boundaries

Users should evaluate the following surfaces before deploying:

### 1. MCP transport

- **`stdio`** — trusted by construction; the MCP client (Claude Desktop, Claude Code, Codex, etc.) owns the process. Anyone able to launch the process can send arbitrary tool calls.
- **`http`** — the HTTP MCP endpoint is unauthenticated by default and binds to the OS-chosen interface. **Do not expose the HTTP transport to untrusted networks without a reverse proxy that enforces authentication.** Bind to `127.0.0.1` (via `--host`) unless you have deliberately added an auth layer in front.

### 2. Browser extension WebSocket

- The extension connects to the server over `ws://` or `wss://` on `--extension-port` (default `3333`).
- The server accepts the first WebSocket peer that connects; there is no per-connection authentication. In shared-host scenarios any local process can connect and drive Draw.io. Use `--host 127.0.0.1` to limit exposure to the local machine, and prefer TLS with a bring-your-own certificate on multi-user systems.
- Firefox forces `wss://` from the extension. Running TLS is therefore required for Firefox users; see the TLS notes below.

### 3. Built-in editor

- `--editor` serves the bundled static Draw.io assets over the HTTP transport. The server itself does not launch a browser; the user opens the served page in whatever browser they choose. Playwright and Chromium are used only for the project's own end-to-end tests, not at runtime.
- Diagram XML supplied via MCP tool calls (`create-shape`, `import-diagram`, etc.) is delivered to the browser page and interpreted by Draw.io there. Draw.io's own XML parser and the browser's HTML/JS engine define the ultimate execution surface. Treat diagram XML from untrusted sources as untrusted input.
- The served Draw.io assets are the ones bundled with the release. Do not repoint the editor at Draw.io hosts you do not control.

### 4. TLS

- TLS is **disabled by default**.
- `--tls --tls-cert / --tls-key` uses caller-supplied certificates. This is the recommended production configuration.
- `--tls --tls-auto` generates a self-signed leaf under a persisted local CA. Intended for local development and single-user setups. Do not use `--tls-auto` for services reachable from other machines unless the local CA has been distributed and trusted out-of-band.
- Auto-generated key material is stored under the XDG data directory (`--tls-dir` to override). Restrict filesystem permissions on that directory to the running user.

### 5. Filesystem and network side effects

Some MCP tools read or write files (diagram import/export, PNG export). The server executes these with the privileges of the running process. Deploy the server as a low-privilege user; do not run it as `root` inside a container or on the host.

### 6. Supply chain

- The npm packages and Docker image are published from the GitHub repository. Verify the version against <https://github.com/lgazo/drawio-mcp-server/releases>.
- The browser extension is distributed via the Chrome Web Store, the Firefox add-on store, and the packaged repo artifacts. Verify the publisher before installing.
- Dependencies are audited on three levels. Regular CI pipelines run `pnpm audit` non-blocking (visible in logs, never fails the build). Release pipelines (server publish, extension publish) block on `pnpm audit`. A scheduled Security Scan workflow (`.github/workflows/security-scan.yml`, weekly) runs a blocking audit, checks that the security overrides in `pnpm-workspace.yaml` are still needed (`scripts/check-audit-overrides.sh`), and attempts an automated fix (`pnpm audit --fix`) that is fully built and tested before a PR is opened. Automated dependency-update bots are not currently in use; version bumps happen manually as part of maintenance passes.

## Hardening Recommendations

For any deployment beyond a single-user localhost setup:

- Bind explicitly with `--host 127.0.0.1` (or a specific interface) instead of relying on the OS default.
- Enable TLS with a real certificate (`--tls --tls-cert / --tls-key`), not `--tls-auto`.
- Terminate the MCP HTTP transport behind a reverse proxy that enforces authentication (mTLS, OIDC, a shared token — whatever fits your environment).
- Do not expose the WebSocket extension port to non-loopback interfaces on shared machines.
- Run the server in a container or as a dedicated non-root user.
- Restrict which MCP clients can invoke the server; assume any client with access can execute every registered tool.
- Treat diagram XML from external sources (LLM output, file uploads, third-party APIs) as untrusted; review before importing when the tool call originated outside your control.

## Known Non-Vulnerabilities

The following are known behaviours and are **not** treated as vulnerabilities:

- The HTTP MCP transport and WebSocket endpoint have no built-in authentication. This is by design; authentication is expected to be provided by the surrounding deployment.
- `--tls-auto` produces certificates that browsers do not trust by default. This is inherent to self-signed CAs.
- MCP tools can arbitrarily modify the current diagram. Callers are trusted; there is no per-tool authorisation model.

If you believe any of the above should be reclassified, open an advisory rather than a public issue so we can discuss it privately first.
