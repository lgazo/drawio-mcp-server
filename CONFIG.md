# Configuration

## CLI Flags & Environment Variables

Every CLI flag has a matching environment variable. CLI flags take precedence over environment variables.

| Flag | Environment Variable | Description | Default |
|------|----------------------|-------------|---------|
| `--editor`, `-e` | `DRAWIO_MCP_EDITOR` | Enable built-in Draw.io editor (`true`/`false`) | disabled |
| `--extension-port`, `-p` | `DRAWIO_MCP_EXTENSION_PORT` | WebSocket port for browser extension | 3333 |
| `--http-port` | `DRAWIO_MCP_HTTP_PORT` | HTTP transport port | 3000 |
| `--transport` | `DRAWIO_MCP_TRANSPORT` | Transport type: `stdio`, `http`, or `stdio,http` | `stdio` |
| `--asset-path` | `DRAWIO_MCP_ASSET_PATH` | Custom path for downloaded assets | - |
| `--host` | `DRAWIO_MCP_HOST` | Explicit IPv4 or IPv6 bind address for all server endpoints (HTTP, WebSocket) | unset (OS chooses) |
| `--websocket-url` | `DRAWIO_MCP_WEBSOCKET_URL` | Override WebSocket URL advertised to the editor (must be `ws://` or `wss://`) | derived from page |
| `--logger` | `DRAWIO_MCP_LOGGER` | Logger mode: `console` (writes to stderr) or `mcp-server` (sends MCP `notifications/message`). The legacy underscore form `mcp_server` is also accepted as a value alias. | `console` |
| `--tls` | `DRAWIO_MCP_TLS` | Enable TLS on HTTP and WebSocket endpoints (off by default) | disabled |
| `--tls-cert <path>` | `DRAWIO_MCP_TLS_CERT` | Manual TLS leaf cert PEM (requires `--tls`, mutually exclusive with `--tls-auto`) | - |
| `--tls-key <path>` | `DRAWIO_MCP_TLS_KEY` | Manual TLS leaf key PEM (requires `--tls`, mutually exclusive with `--tls-auto`) | - |
| `--tls-auto` | `DRAWIO_MCP_TLS_AUTO` | Auto-generate self-signed leaf cert via a persisted local CA (requires `--tls`) | disabled |
| `--tls-dir <path>` | `DRAWIO_MCP_TLS_DIR` | Override XDG data directory for auto-generated TLS material | per-OS XDG path |

## Custom WebSocket URL (reverse proxies, HTTPS)

By default, the built-in editor builds the WebSocket URL from the page it loads on: `wss://` if the page is HTTPS, otherwise `ws://`, with the page hostname and the `--extension-port` value. Behind a reverse proxy that terminates TLS and exposes the WebSocket on a different host, port, or path, set an explicit URL:

```sh
DRAWIO_MCP_WEBSOCKET_URL=wss://drawio.example.com/ws \
  npx -y drawio-mcp-server --editor --transport http
```

Or with the equivalent CLI flag:

```sh
npx -y drawio-mcp-server --editor --transport http \
  --websocket-url wss://drawio.example.com/ws
```

The browser extension has the same override under **Custom WebSocket URL** on its options page; use it when connecting through an HTTPS proxy.

## Host Binding

By default, the server binds to an OS-assigned address (typically `127.0.0.1` on Linux and Windows, or `::1` on macOS). On macOS and systems with `IPV6_V6ONLY=1`, the OS may bind to IPv6-only, causing connections from browsers attempting `ws://localhost:XXXX` (IPv4) to fail.

Use `--host` to explicitly set the bind address:

```sh
drawio-mcp-server --host 127.0.0.1
```

Or with the environment variable:

```sh
DRAWIO_MCP_HOST=127.0.0.1 drawio-mcp-server
```

Example values:
- `127.0.0.1` — IPv4 loopback (localhost IPv4 only)
- `0.0.0.0` — All IPv4 interfaces
- `::1` — IPv6 loopback (localhost IPv6 only)

## Built-in Editor

Enable the built-in editor to run Draw.io without a browser extension:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--editor"]
    }
  }
}
```

The editor runs on the same port as the HTTP transport and is available at:

```
http://localhost:3000/
```

If you use a custom HTTP port with `--http-port`, the editor will be at that port instead.

### Editor + HTTP Transport

The `--editor` flag automatically enables the HTTP transport. If you need a custom port:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--editor", "--http-port", "4000"]
    }
  }
}
```

Editor will be at: `http://localhost:4000/`

## HTTP Transport

For remote MCP clients or network access, enable the HTTP transport:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--transport", "http"]
    }
  }
}
```

Available endpoints:
- MCP: `http://localhost:3000/mcp`
- Health: `http://localhost:3000/health`
- Editor: `http://localhost:3000/` (if `--editor` enabled)

## Browser Extension

The browser extension connects to the MCP server via WebSocket. It works alongside the built-in editor or independently.

Default WebSocket port is 3333. To customize:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--extension-port", "8080"]
    }
  }
}
```

When using a custom port, ensure the browser extension is configured to connect to the same port. See the [extension documentation](./packages/drawio-mcp-extension/README.md) for port configuration instructions.

## MCP Client Configuration Examples

### Claude Desktop

Using npm:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--editor"]
    }
  }
}
```

Using pnpm:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "pnpm",
      "args": ["dlx", "drawio-mcp-server", "--editor"]
    }
  }
}
```

### Claude Code

Using npm:

```sh
claude mcp add-json drawio '{"type":"stdio","command":"npx","args":["-y","drawio-mcp-server","--editor"]}'
```

Using pnpm:

```sh
claude mcp add-json drawio '{"type":"stdio","command":"pnpm","args":["dlx","drawio-mcp-server","--editor"]}'
```

### Claude Code (HTTP transport)

```sh
npx -y drawio-mcp-server --transport http --editor --http-port 4000
claude mcp add-json drawio '{"type":"http","url":"http://localhost:4000/mcp"}'
```

### oterm

The configuration is usually in: `~/.local/share/oterm/config.json`

Using npm:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--editor"]
    }
  }
}
```

Using pnpm:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "pnpm",
      "args": ["dlx", "drawio-mcp-server", "--editor"]
    }
  }
}
```

### Zed

Using npm:

```json
{
  "drawio": {
    "command": "npx",
    "args": ["-y", "drawio-mcp-server", "--editor"],
    "env": {}
  }
}
```

Using pnpm:

```json
{
  "drawio": {
    "command": "pnpm",
    "args": ["dlx", "drawio-mcp-server", "--editor"],
    "env": {}
  }
}
```

### Codex

Using npm:

```toml
[mcp_servers.drawio]
command = "npx"
args = ["-y", "drawio-mcp-server", "--editor"]
```

Using pnpm:

```toml
[mcp_servers.drawio]
command = "pnpm"
args = ["dlx", "drawio-mcp-server", "--editor"]
```

### Codex (HTTP transport)

```toml
[mcp_servers.drawio]
url = "http://localhost:3000/mcp"
```

### OpenCode

Add to `opencode.json` in your project root or `~/.config/opencode/opencode.json`:

Using npm:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "drawio": {
      "type": "local",
      "command": ["npx", "-y", "drawio-mcp-server", "--editor"],
      "enabled": true
    }
  }
}
```

Using pnpm:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "drawio": {
      "type": "local",
      "command": ["pnpm", "dlx", "drawio-mcp-server", "--editor"],
      "enabled": true
    }
  }
}
```

### OpenCode (HTTP transport)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "drawio": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "enabled": true
    }
  }
}
```

## Transport Options

The `--transport` flag controls which transports are enabled:

- `--transport stdio` - Only stdio transport (default, CLI-friendly)
- `--transport http` - Only HTTP transport (for remote clients)
- `--transport stdio,http` - Both transports

When using the built-in editor (`--editor`), HTTP transport is enabled automatically.

## TLS (HTTPS + WSS)

The server can terminate TLS on both endpoints (HTTP transport / built-in editor and WebSocket extension port). Two modes:

### Manual mode

Bring your own cert + key (e.g. via mkcert, Let's Encrypt, or a corporate CA):

```sh
drawio-mcp-server --transport http --editor \
  --tls --tls-cert ./server.crt --tls-key ./server.key
```

Both files must be PEM-encoded. The server does not chain or modify them; supply a complete chain in the cert file if needed.

### Auto mode (self-signed via local CA)

The server generates a per-user CA on first run and a leaf cert signed by it. Material is persisted so subsequent runs reuse it:

```sh
drawio-mcp-server --transport http --editor --tls --tls-auto
```

Default storage location (XDG-compliant):

| OS | Path |
|----|------|
| Linux | `${XDG_DATA_HOME:-~/.local/share}/drawio-mcp-server/tls/` |
| macOS | `~/Library/Application Support/drawio-mcp-server/tls/` |
| Windows | `%LOCALAPPDATA%\drawio-mcp-server\tls\` |

Files:

- `ca.crt` — local CA, install once into your OS / browser trust store
- `ca.key` — CA private key (mode `0600` on POSIX, never share)
- `server.crt` — leaf cert (1y validity, regenerated when SAN list changes)
- `server.key` — leaf private key (mode `0600` on POSIX)
- `meta.json` — generation timestamps + SAN hash for drift detection

Override the directory with `--tls-dir` or `DRAWIO_MCP_TLS_DIR` (e.g. for Docker volumes).

### Trust store install

On the first auto-mode run the server prints the OS-specific command to install `ca.crt` into your trust store. Without this, browsers will refuse the WSS connection (the browser extension will appear silently disconnected). Quick reference:

- **Linux (Debian/Ubuntu):** `sudo cp <ca.crt> /usr/local/share/ca-certificates/drawio-mcp-ca.crt && sudo update-ca-certificates`
- **macOS:** `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <ca.crt>`
- **Windows (admin):** `certutil -addstore -f ROOT <ca.crt>`
- **Firefox:** uses its own NSS store — import via Settings → Privacy & Security → Certificates → Authorities → Import

Restart the browser after installing.

### Renewal

- Leaf cert is renewed automatically when within 30 days of expiry, or when the SAN list changes (e.g. you added `--host`).
- CA is renewed when within 30 days of its 10-year expiry. After CA renewal you must re-install `ca.crt` into the trust store.
- To force regeneration, delete the TLS directory.

## Logging

The server keeps stdout reserved for MCP JSON-RPC frames whenever the `stdio` transport is active. Diagnostic output is routed via one of two loggers, selected with `--logger`:

- `--logger console` (default) writes to **stderr**. Safe for stdio MCP clients (e.g. Claude Desktop, Codex CLI) that strictly enforce the spec.
- `--logger mcp-server` sends logs to the connected MCP client as `notifications/message`. This advertises the `logging` capability and lets the client adjust per-logger levels at runtime via `logging/setLevel`. Use this only when your client supports MCP logging notifications.

Examples:

```sh
drawio-mcp-server --editor --logger mcp-server
DRAWIO_MCP_LOGGER=mcp-server drawio-mcp-server --editor
```

> **Note (breaking change):** the previous `LOGGER_TYPE` environment variable has been removed. Use `--logger` or `DRAWIO_MCP_LOGGER` instead.
