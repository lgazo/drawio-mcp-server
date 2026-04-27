# Draw.io MCP server

Let's do some Vibe Diagramming with the most wide-spread diagramming tool called Draw.io (Diagrams.net).

[![Discord channel](https://shields.io/static/v1?logo=discord&message=draw.io%20mcp&label=chat&color=5865F2&logoColor=white)](https://discord.gg/dM4PWdf42q)
[![Build project](https://github.com/lgazo/drawio-mcp-server/actions/workflows/server-ci.yml/badge.svg)](https://github.com/lgazo/drawio-mcp-server/actions/workflows/server-ci.yml)
[![Verified on MseeP](https://mseep.ai/badge.svg)](https://mseep.ai/app/5fc2b7fe-8ceb-4683-97bd-6d31e07b5888)
[![Version](https://img.shields.io/npm/v/drawio-mcp-server)](https://npmjs.com/package/drawio-mcp-server)

## Key Highlights

- Enable Draw.io MCP in IFrames ![v2.1.0](https://img.shields.io/badge/v2.1.0-blue)
- AWS, GCP, Azure, Cisco19, and CiscoSafe stencils auto-discovered at runtime from drawio's sidebar ![v2.1.0](https://img.shields.io/badge/v2.1.0-blue)
- Multi-document targeting with `list-documents` and `target_document` selectors for multi-tab workflows
- Multi-page targeting with required `target_page` selectors for page-scoped tools
- Per-document FIFO serialization for live operations, so multiple agents can work on different files safely
- Page management tools: `list-pages`, `get-current-page`, `create-page`, `copy-page`, `rename-page`
- Import and export diagrams from/to XML, SVG (with embedded XML), or PNG (with embedded XML) ![v2.0.0](https://img.shields.io/badge/v2.0.0-blue)
- Import, embed, or expand [Mermaid](https://mermaid.js.org/) diagrams ![v2.1.0](https://img.shields.io/badge/v2.1.0-blue)
- Edge geometry control with waypoints and automatic self-connector routing ![v2.0.0](https://img.shields.io/badge/v2.0.0-blue)
- Parent-child relationships for nested shapes and grouping ![v2.0.0](https://img.shields.io/badge/v2.0.0-blue)
- Unified Server and Extension in the same mono-repo ![v2.0.0](https://img.shields.io/badge/v2.0.0-blue)
- Built-in Draw.io editor - no browser extension required
- MCP server that lets AI agents control Draw.io diagrams
- Programmatic diagram creation, inspection, and modification via MCP tools
- Layer management for complex diagrams
- Works with any MCP client (Claude Desktop, Claude Code, Zed, Codex, etc.)

## Introduction

The Draw.io MCP server brings Draw.io diagramming capabilities to AI agents. It provides MCP tools that can create, read, update, and delete diagram elements - letting AI assistants build architectural diagrams, flowcharts, and visual documentation automatically.

For multi-agent usage inside a single Draw.io document, page-scoped tools now require a `target_page` selector (`{ index }` or `{ id }`). The server serializes live operations in FIFO order per connected document, so concurrent agents can safely work on different pages and different files without interleaving page switches and writes inside the same tab.

Most page model tools now execute against off-page models without switching the visible browser page. UI-bound tools such as selection, active-layer inspection/changes, selection-only exports, and embedded-XML PNG exports may still switch the visible page to preserve Draw.io semantics.

For multi-tab usage across different Draw.io files, call `list-documents` first. If the server sees exactly one connected document, live tools auto-target it. If it sees multiple connected documents, every live tool must receive `target_document: { id }` from `list-documents`. The server only talks to already-open Draw.io tabs; it does not open files, open browser tabs, or switch tabs on your behalf.

Two ways to use:
1. **Built-in editor** - Server hosts Draw.io directly, accessible in your browser
2. **Browser extension** - Connect to Draw.io running in your browser via extension

## Requirements

- **Node.js** (v20 or higher) - Runtime environment for the MCP server
- **MCP client** - Claude Desktop, Claude Code, Zed, Codex, OpenCode, or any MCP-compatible host

### For Built-in Editor
No additional requirements - runs out of the box with `--editor` flag.

### For Browser Extension
- **Browser extension** - [drawio-mcp-extension](./packages/drawio-mcp-extension/README.md)
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

> "Create a three-page event-driven architecture diagram. Use three agents in parallel for service topology, message flow, and retry/failure handling, with each agent assigned to a separate target page."

> "Draw a CRUD API diagram with a database, API gateway, and four microservices with their endpoints"

> "Add a new layer called 'Background' and move all decorative elements to it, then create a new layer for annotations"

Your AI assistant can now control the diagram using MCP tools.

## Features

The server provides MCP tools for:

- **Document discovery** - list connected Draw.io document instances and route later calls to a specific tab/file instance
- **Diagram inspection** - read shapes, pages, layers, and cell properties
- **Diagram modification** - add/edit/delete shapes, edges, and labels on a target page
- **Page management** - list pages, inspect the current page, create pages, copy pages, and rename pages without forcing a visible page switch on supported runtimes
- **Layer management** - create, switch, and organize layers
- **Vendor shape coverage** - AWS, GCP, Azure, Cisco19, and CiscoSafe stencils auto-discovered at runtime from drawio's sidebar, so agents can place icons like `mxgraph.gcp2.cloud_run` or `mxgraph.cisco19.router` without hand-curated catalogs

See [Tools Reference](./TOOLS.md) for the complete list of available tools.

## Installation

The server runs as part of your MCP host. Detailed configuration for all supported clients (Claude Desktop, Claude Code, Zed, Codex, oterm) including npm and pnpm options is available in [Configuration](./CONFIG.md).

## Alternative: Browser Extension

Instead of the built-in editor, you can use the [browser extension](./packages/drawio-mcp-extension/README.md) to connect to Draw.io running in your browser. This works with or without the `--editor` flag.

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

See the [extension documentation](./packages/drawio-mcp-extension/README.md) for more details.

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
