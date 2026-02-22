# Draw.io MCP server

Let's do some Vibe Diagramming with the most wide-spread diagramming tool called Draw.io (Diagrams.net).

[![Discord channel](https://shields.io/static/v1?logo=discord&message=draw.io%20mcp&label=chat&color=5865F2&logoColor=white)](https://discord.gg/dM4PWdf42q)
[![Build project](https://github.com/lgazo/drawio-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/lgazo/drawio-mcp-server/actions/workflows/ci.yml)
[![Verified on MseeP](https://mseep.ai/badge.svg)](https://mseep.ai/app/5fc2b7fe-8ceb-4683-97bd-6d31e07b5888)
[![Version](https://img.shields.io/npm/v/drawio-mcp-server)](https://npmjs.com/package/drawio-mcp-server)

## Key Highlights

- Built-in Draw.io editor - no browser extension required ![v1.8.0](https://img.shields.io/badge/v1.8.0-blue)
- MCP server that lets AI agents control Draw.io diagrams
- Programmatic diagram creation, inspection, and modification via MCP tools
- Layer management for complex diagrams ![v1.7.0](https://img.shields.io/badge/v1.7.0-blue)
- Works with any MCP client (Claude Desktop, Claude Code, Zed, Codex, etc.)

## Introduction

The Draw.io MCP server brings Draw.io diagramming capabilities to AI agents. It provides MCP tools that can create, read, update, and delete diagram elements - letting AI assistants build architectural diagrams, flowcharts, and visual documentation automatically.

Two ways to use:
1. **Built-in editor** - Server hosts Draw.io directly, accessible in your browser
2. **Browser extension** - Connect to Draw.io running in your browser via extension

## Requirements

- **Node.js** (v20 or higher) - Runtime environment for the MCP server
- **MCP client** - Claude Desktop, Claude Code, Zed, Codex, OpenCode, or any MCP-compatible host

### For Built-in Editor
No additional requirements - runs out of the box with `--editor` flag.

### For Browser Extension
- **Browser extension** - [drawio-mcp-extension](https://github.com/lgazo/drawio-mcp-extension)
- Draw.io open in your browser

### Optional
- **pnpm** - Preferred package manager (npm works fine too)

## Quick Start

### 1. Configure your MCP host

Add the server to your MCP client configuration:

<details>
  <summary>Claude Desktop</summary>

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

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
</details>

<details>
  <summary>Claude Code</summary>

```sh
claude mcp add-json drawio '{"type":"stdio","command":"npx","args":["-y","drawio-mcp-server","--editor"]}'
```
</details>

<details>
  <summary>Zed</summary>

Add to `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--editor"],
      "env": {}
    }
  }
}
```
</details>

<details>
  <summary>Codex</summary>

Edit `~/.codex/config.toml`:

```toml
[mcp_servers.drawio]
command = "npx"
args = ["-y", "drawio-mcp-server", "--editor"]
```
</details>

<details>
  <summary>OpenCode</summary>

Add to `opencode.json` in your project root or `~/.config/opencode/opencode.json`:

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
</details>

For other MCP clients and detailed configuration (including pnpm options), see [Configuration](./CONFIG.md).

### 2. Open the editor

After restarting your MCP host, open: **http://localhost:3000/**

### 3. Start diagramming

Example prompts you can try:

> "Create an event-driven architecture diagram showing a message queue with producers, consumers, and three backend services"

> "Draw a CRUD API diagram with a database, API gateway, and four microservices with their endpoints"

> "Add a new layer called 'Background' and move all decorative elements to it, then create a new layer for annotations"

Your AI assistant can now control the diagram using MCP tools.

## Features

The server provides MCP tools for:

- **Diagram inspection** - read shapes, layers, and cell properties
- **Diagram modification** - add/edit/delete shapes, edges, and labels
- **Layer management** - create, switch, and organize layers

See [Tools Reference](./TOOLS.md) for the complete list of available tools.

## Installation

The server runs as part of your MCP host. Detailed configuration for all supported clients (Claude Desktop, Claude Code, Zed, Codex, oterm) including npm and pnpm options is available in [Configuration](./CONFIG.md).

## Alternative: Browser Extension

Instead of the built-in editor, you can use the [browser extension](https://github.com/lgazo/drawio-mcp-extension) to connect to Draw.io running in your browser. This works with or without the `--editor` flag.

1. Open [Draw.io in your browser](https://app.diagrams.net/)
2. Install the Draw.io MCP Browser Extension:
   - [Chrome Web Store](https://chrome.google.com/webstore/detail/drawio-mcp-extension/okdbbjbbccdhhfaefmcmekalmmdjjide)
   - [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/drawio-mcp-extension/)
3. Ensure the extension is connected (green signal overlay on icon)

Configuration without `--editor`:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server"]
    }
  }
}
```

See the [extension documentation](https://github.com/lgazo/drawio-mcp-extension) for more details.

## Related Resources

[Configuration](./CONFIG.md) - CLI flags and advanced options

[Tools Reference](./TOOLS.md) - Complete MCP tools documentation

[Troubleshooting](./TROUBLESHOOTING.md)

[Prompt examples](./docs/examples/index.md)

[Contributing](./CONTRIBUTING.md)

[Architecture](./ARCHITECTURE.md)

[Development](./DEVELOPMENT.md)

## Star History

<a href="https://star-history.com/#lgazo/drawio-mcp-server&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=lgazo/drawio-mcp-server&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=lgazo/drawio-mcp-server&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=lgazo/drawio-mcp-server&type=Date" />
 </picture>
</a>

## Assessments

[![MSeeP.ai Security Assessment Badge](https://mseep.net/pr/lgazo-drawio-mcp-server-badge.png)](https://mseep.ai/app/lgazo-drawio-mcp-server)
