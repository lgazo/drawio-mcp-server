# Configuration

## CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--editor`, `-e` | Enable built-in Draw.io editor (use `--editor=false` to disable) | disabled |
| `--extension-port`, `-p` | WebSocket port for browser extension | 3333 |
| `--http-port` | HTTP transport port | 3000 |
| `--transport` | Transport type: `stdio`, `http`, or `stdio,http` | `stdio` |
| `--asset-source` | Asset source mode: `cdn` or `download` | `download` |
| `--asset-path` | Custom path for downloaded assets (forces download mode) | - |

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

When using a custom port, ensure the browser extension is configured to connect to the same port. See the [extension documentation](https://github.com/lgazo/drawio-mcp-extension) for port configuration instructions.

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
