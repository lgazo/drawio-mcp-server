# drawio-mcp-dev-proxy

Local HTTPS reverse proxy that puts Caddy in front of `drawio-mcp-server` so you can verify
`wss://` behaviour end-to-end on a dev machine. Not published.

Used two ways:

1. **Programmatically** by the `drawio-mcp-server` real-environment test suite
   (`HARNESS_HTTPS=1 pnpm --filter drawio-mcp-server test:real-environment`). Playwright
   launches with `ignoreHTTPSErrors`, so no sudo is ever required.
2. **Manually** in a browser, to reproduce issue-#48-style setups. Requires a one-time
   `caddy trust` so Chrome accepts both the page and the `wss://` handshake. The trust
   persists across reboots; you do not need to re-run it.

Caddy itself is a single static binary vendored under `bin/caddy`, downloaded by
`postinstall`. Version is pinned in `scripts/install-caddy.mjs`.

## First-time setup

Runs automatically as part of `pnpm install` at the repo root. If you skipped it or want to
re-fetch:

```sh
pnpm --filter drawio-mcp-dev-proxy setup
```

Environment overrides:
- `CADDY_SKIP_DOWNLOAD=1` — skip the downloader (useful on unsupported platforms).
- `CADDY_BINARY=/path/to/caddy` — point `spawnCaddy` at a system-installed Caddy and skip
  download.

## Automated test mode

```sh
HARNESS_HTTPS=1 pnpm --filter drawio-mcp-server test:real-environment
```

The harness allocates a random TLS port, calls `spawnCaddy({ proxyPort, httpUpstream,
wsUpstream })`, sets `config.webSocketUrl = 'wss://localhost:${proxyPort}/ws'` on the server
so `/api/config` advertises it, and navigates Playwright to `https://localhost:${proxyPort}/`
in a context with `ignoreHTTPSErrors: true`. No OS trust store mutation.

## Manual browser mode

One-time:

```sh
pnpm --filter drawio-mcp-dev-proxy trust    # sudo; installs Caddy local CA
```

Persists until you explicitly remove it with `sudo ./bin/caddy untrust`.

Then two terminals:

```sh
# Terminal 1 — MCP server with the override pointing at the proxied URL
DRAWIO_MCP_WEBSOCKET_URL=wss://localhost:8443/ws \
  pnpm --filter drawio-mcp-server start -- --transport http --editor

# Terminal 2 — Caddy
pnpm --filter drawio-mcp-dev-proxy start
```

Open `https://localhost:8443/` in a browser. Editor loads over HTTPS, `/api/config` advertises
the override, and the plugin opens a `wss://localhost:8443/ws` socket that Caddy upgrades to
`ws://localhost:3333`.

### Port overrides

`Caddyfile` uses env-var substitution with defaults. To change any port:

```sh
DRAWIO_MCP_PROXY_PORT=9443 \
DRAWIO_MCP_HTTP_UPSTREAM=4000 \
DRAWIO_MCP_WS_UPSTREAM=5555 \
  pnpm --filter drawio-mcp-dev-proxy start
```

Match the upstreams to whatever `--http-port` / `--extension-port` you pass to the server.

## Troubleshooting

- **`caddy binary not found`** — rerun `pnpm --filter drawio-mcp-dev-proxy setup` or set
  `CADDY_BINARY`.
- **`ERR_CERT_AUTHORITY_INVALID` in manual mode** — you skipped `trust`. Run it once.
- **Port already in use** — pick a different `DRAWIO_MCP_PROXY_PORT`.
- **Remove Caddy's local CA entirely** — `sudo ./bin/caddy untrust`. Rare; only do this if
  you no longer want the cert trusted.
