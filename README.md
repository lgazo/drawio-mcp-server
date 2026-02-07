# Draw.io MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for programmatic diagram generation using [Draw.io](https://www.drawio.com/) (Diagrams.net). This server generates Draw.io XML directly — no browser extension or Draw.io instance required.

<!--[![Build project](https://github.com/simonkurtz-MSFT/drawio-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/simonkurtz-MSFT/drawio-mcp-server/actions/workflows/ci.yml)-->

## Features

- **700+ Azure Architecture Icons** — Official Microsoft icons with embedded SVG data, organized into ~20 categories (Compute, Networking, Storage, Databases, AI + ML, Security, and more)
- **Basic Shapes** — Rectangles, ellipses, diamonds, parallelograms, and other flowchart primitives
- **Fuzzy Search** — Find shapes by partial name across the entire icon library
- **Batch Operations** — Create and update multiple cells in a single call for better performance
- **Layer Management** — Create, list, and organize cells across layers
- **Style Presets** — Built-in Azure, flowchart, and general color presets
- **Multiple Transports** — stdio (default) and streamable HTTP
- **XML Export** — Standard Draw.io XML format compatible with Draw.io desktop and web

## Requirements

- **[Deno](https://deno.com/)** v2.3 or higher

## Quick Start

### From Source

```sh
deno run --allow-net --allow-read --allow-env src/index.ts
```

### MCP Client Configuration

Configure your MCP client (Claude Desktop, VS Code, Codex, etc.) to use the server:

<details>
<summary><b>Claude Desktop</b></summary>

Edit `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "drawio": {
      "command": "deno",
      "args": ["run", "--allow-net", "--allow-read", "--allow-env", "/path/to/drawio-mcp-server/src/index.ts"]
    }
  }
}
```
</details>

<details>
<summary><b>VS Code</b></summary>

Add to your VS Code settings or `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "deno",
      "args": ["run", "--allow-net", "--allow-read", "--allow-env", "/path/to/drawio-mcp-server/src/index.ts"]
    }
  }
}
```
</details>

<details>
<summary><b>Zed</b></summary>

In the Assistant settings, add a Context Server:

```json
{
  "drawio": {
    "command": "deno",
    "args": ["run", "--allow-net", "--allow-read", "--allow-env", "/path/to/drawio-mcp-server/src/index.ts"],
    "env": {}
  }
}
```
</details>

<details>
<summary><b>Codex</b></summary>

Edit `~/.codex/config.toml`:

```toml
[mcp_servers.drawio]
command = "deno"
args = ["run", "--allow-net", "--allow-read", "--allow-env", "/path/to/drawio-mcp-server/src/index.ts"]
```

For a locally running HTTP transport:

```toml
[mcp_servers.drawio]
url = "http://localhost:8080/mcp"
```
</details>

<details>
<summary><b>oterm (Ollama)</b></summary>

Edit `~/.local/share/oterm/config.json`:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "deno",
      "args": ["run", "--allow-net", "--allow-read", "--allow-env", "/path/to/drawio-mcp-server/src/index.ts"]
    }
  }
}
```
</details>

## Configuration

### Transport Selection

The `--transport` flag controls which transports to start. Default is `stdio`.

| Flag | Description |
|---|---|
| `--transport stdio` | stdio only (default) |
| `--transport http` | HTTP only |
| `--transport stdio,http` | Both transports |

### HTTP Transport

The HTTP transport exposes a streamable HTTP endpoint at `/mcp` (default port 8080).

```sh
deno task start:http
# or with a custom port:
deno run --allow-net --allow-read --allow-env src/index.ts --transport http --http-port 4000
```

MCP client configuration for HTTP:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "deno",
      "args": ["run", "--allow-net", "--allow-read", "--allow-env", "/path/to/drawio-mcp-server/src/index.ts", "--transport", "http", "--http-port", "4000"]
    }
  }
}
```

Health check: `curl http://localhost:8080/health`

### Docker

The Docker image uses `deno compile` to produce a self-contained native binary, then runs it on a minimal [distroless](https://github.com/GoogleContainerTools/distroless) base image (~20MB) with no shell, no package manager, and a non-root user.

```sh
# Build
docker build -t drawio-mcp-server .

# Run (exposes HTTP on port 8080)
docker run -d --name drawio-mcp-server -p 8080:8080 drawio-mcp-server
```

#### Docker Compose

```sh
cp .env.example .env   # Configure REGISTRY and IMAGE_VERSION
docker compose up -d
```

The `.env` file supports:
- `REGISTRY` — Docker registry URL (e.g., `docker.io/myusername`)
- `IMAGE_VERSION` — Semantic version for image tags (e.g., `1.0.0`)

> **Note**: The distroless image has no shell, so in-container health checks (wget, curl) are not available. Use external health checks (e.g., Kubernetes liveness probes, load balancer health checks) to monitor the `/health` endpoint.

## Tools

> **Performance tip**: All cell-manipulation tools accept arrays — pass ALL items in a single call rather than calling a tool repeatedly.

### Shape Discovery

| Tool | Description |
|---|---|
| `search-shapes` | Fuzzy search for shapes including 700+ Azure icons. Pass all queries in the `queries` array. |
| `get-shape-categories` | List all shape categories (General, Flowchart, Azure categories). |
| `get-shapes-in-category` | List all shapes in a category by `category_id`. |
| `get-shape-by-name` | Get a specific shape by exact name. |
| `get-style-presets` | Get built-in style presets (Azure colors, flowchart shapes, edge styles). |

### Diagram Modification

| Tool | Description |
|---|---|
| `add-cells` | Add vertices and/or edges. Supports `temp_id` for within-batch references and `dry_run` validation. |
| `add-cells-of-shape` | Add shape-library cells (Azure icons, basic shapes). |
| `edit-cells` | Update vertex cell properties (position, size, text, style). |
| `edit-edge` | Update an edge's properties (text, source, target, style). |
| `set-cell-shape` | Apply library shape styles to existing cells. |
| `delete-cell-by-id` | Remove a cell (vertex or edge) by ID. Cascade-deletes connected edges for vertices. |
| `delete-edge` | Remove an edge by ID (validates that the target is an edge). |

### Diagram Inspection

| Tool | Description |
|---|---|
| `list-paged-model` | Paginated view of all cells with filtering by type. |
| `get-diagram-stats` | Statistics about cell counts, bounds, and layer distribution. |
| `export-diagram` | Export the diagram as Draw.io XML. |
| `import-diagram` | Import a Draw.io XML string, replacing the current diagram. |
| `clear-diagram` | Clear all cells and reset the diagram. |

### Layer Management

| Tool | Description |
|---|---|
| `list-layers` | List all layers with IDs and names. |
| `get-active-layer` | Get the currently active layer. |
| `set-active-layer` | Set the active layer for new elements. |
| `create-layer` | Create a new layer. |
| `move-cell-to-layer` | Move a cell to a different layer. |

### Page Management

| Tool | Description |
|---|---|
| `create-page` | Create a new page (tab) in the diagram. |
| `list-pages` | List all pages with IDs and names. |
| `get-active-page` | Get the currently active page. |
| `set-active-page` | Switch to a different page. |
| `rename-page` | Rename an existing page. |
| `delete-page` | Delete a page and all its contents. Cannot delete the last page. |

### Group / Container Management

| Tool | Description |
|---|---|
| `create-groups` | Create group/container cells for VNets, subnets, resource groups, etc. |
| `add-cells-to-group` | Assign cells to groups. |
| `remove-cell-from-group` | Remove a cell from its group, returning it to the active layer. |
| `list-group-children` | List all cells contained in a group. |

### Add Cells Example

Use `add-cells` with `temp_id` references to create vertices and edges in a single call:

```json
{
  "cells": [
    { "type": "vertex", "temp_id": "web", "x": 100, "y": 100, "width": 60, "height": 60, "text": "Web", "style": "aspect=fixed;html=1;image;image=img/lib/azure2/compute/Container_Instances.svg;" },
    { "type": "vertex", "temp_id": "api", "x": 220, "y": 100, "width": 60, "height": 60, "text": "API", "style": "aspect=fixed;html=1;image;image=img/lib/azure2/compute/Container_Instances.svg;" },
    { "type": "edge", "source_id": "web", "target_id": "api", "text": "HTTPS" }
  ]
}
```

## Azure Icon Library

The server includes **700+ official Azure architecture icons** from [dwarfered/azure-architecture-icons-for-drawio](https://github.com/dwarfered/azure-architecture-icons-for-drawio), organized into categories:

| Category | Examples |
|---|---|
| AI + Machine Learning | Cognitive Services, Azure OpenAI, Bot Service, Machine Learning |
| Analytics | Synapse Analytics, Databricks, Data Factory, Event Hubs |
| App Services | App Service, Static Web Apps |
| Compute | Virtual Machines, Functions, AKS, Container Instances, Batch |
| Containers | Container Registry, Container Instances, AKS |
| Databases | SQL Database, Cosmos DB, Cache for Redis, PostgreSQL |
| DevOps | Azure DevOps, Pipelines, Repos |
| Identity | Azure AD, Key Vault |
| Integration | Service Bus, Logic Apps, API Management, Event Grid |
| Management + Governance | Monitor, Automation, Policy, Log Analytics |
| Networking | Front Door, Load Balancer, Application Gateway, VPN Gateway, Firewall |
| Security | Sentinel, Security Center |
| Storage | Storage Account, Blob Storage, File Storage, Disk Storage |

Icons use **embedded base64 SVG data** — no external dependencies, works fully offline with correct Azure branding and colors.

The library loads lazily on first access (singleton pattern). Search operations are <5ms after initial load.

## Development

### Setup

```sh
git clone https://github.com/simonkurtz-MSFT/drawio-mcp-server.git
cd drawio-mcp-server
```

No install step needed — Deno resolves dependencies on first run.

### Common Commands

| Command | Description |
|---|---|
| `deno task start` | Start with stdio transport |
| `deno task start:http` | Start with HTTP transport |
| `deno task start:both` | Start with both transports |
| `deno task dev` | Watch mode — auto-restart on changes |
| `deno task test` | Run tests |
| `deno task test:watch` | Run tests in watch mode |
| `deno task test:coverage` | Run tests with coverage |
| `deno task lint` | Lint and type-check |
| `deno task fmt` | Format code |
| `deno task fmt:check` | Check formatting without writing |
| `deno task compile` | Compile to a self-contained binary |

### MCP Inspector

Use the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) to debug the server:

```sh
deno task inspect
```

After making changes, **Restart** the Inspector. After changing tool definitions, **Clear** and **List** the tools again.

## License

[MIT](LICENSE.md)
