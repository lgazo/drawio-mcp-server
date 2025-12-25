# Draw.io MCP server

Let's do some Vibe Diagramming with the most wide-spread diagramming tool called Draw.io (Diagrams.net).

[![Discord channel](https://shields.io/static/v1?logo=discord&message=draw.io%20mcp&label=chat&color=5865F2&logoColor=white)](https://discord.gg/dM4PWdf42q) [![Build project](https://github.com/lgazo/drawio-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/lgazo/drawio-mcp-server/actions/workflows/ci.yml)

## Introduction

The Draw.io MCP server is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) implementation that brings powerful diagramming capabilities to AI agentic systems. This integration enables:

- **Seamless Draw.io Integration**: Connect your MCP-powered applications with Draw.io's rich diagramming functionality
- **Programmatic Diagram Control**: Create, modify, and manage diagram content through MCP commands
- **Intelligent Diagram Analysis**: Retrieve detailed information about diagrams and their components for processing by AI agents
- **Agentic System Development**: Build sophisticated AI workflows that incorporate visual modeling and diagram automation

As an MCP-compliant tool, it follows the standard protocol for tool integration, making it compatible with any MCP client. This implementation is particularly valuable for creating AI systems that need to:
- Generate architectural diagrams
- Visualize complex relationships
- Annotate technical documentation
- Create flowcharts and process maps programmatically

The tool supports bidirectional communication, allowing both control of Draw.io instances and extraction of diagram information for further processing by AI agents in your MCP ecosystem.

## Requirements

To use the Draw.io MCP server, you'll need:

### Core Components
- **Node.js** (v20 or higher) - Runtime environment for the MCP server
- **Draw.io MCP Browser Extension** - Enables communication between Draw.io and the MCP server

### MCP Ecosystem
- **MCP Client** (e.g., [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)) - For testing and debugging the integration
- **LLM with Tools Support** - Any language model capable of handling MCP tool calls (e.g., GPT-4, Claude 3, etc.)

### Optional for Development
- **pnpm** - Preferred package manager
- **Chrome DevTools** - For debugging when using `--inspect` flag

Note: The Draw.io desktop app or web version must be accessible to the system where the MCP server runs.

## Configuration

### WebSocket Port

The server listens on port 3333 by default for WebSocket connections from the browser extension. You can customize this port using the `--extension-port` or `-p` flag.

**Default behavior** (port 3333):
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

**Custom port** (e.g., port 8080):
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

**Note**: When using a custom port, ensure the browser extension is configured to connect to the same port.

### HTTP Transport Port

The server can expose a streamable HTTP MCP transport on port 3000. Change this using the `--http-port` flag:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "drawio-mcp-server", "--transport", "http", "--http-port", "4000"]
    }
  }
}
```

### Transport Selection

By default only the stdio transport starts. Limit or combine transports with the `--transport` flag:

- `--transport stdio` – start only stdio (CLI-friendly)
- `--transport http` – start only the HTTP transport (for remote clients)
- `--transport stdio,http` – start both transports

### Running the streamable HTTP transport

Use the streamable HTTP transport when you need to reach the MCP server over the network (for example from a remote agent runtime). The Draw.io browser extension is still required, and you must opt in to the HTTP transport.

1. Start the server with HTTP enabled (optionally alongside stdio):

```sh
npx -y drawio-mcp-server --transport http --http-port 3000
# or both: npx -y drawio-mcp-server --transport stdio,http --http-port 4000
```

2. Verify the health endpoint:

```sh
curl http://localhost:3000/health
# { "status": "ok" }
```

3. Point your MCP client to the `/mcp` endpoint (`http://localhost:3000/mcp` by default). CORS is enabled for all origins so you can call it from a browser-based client as well.

## Installation

### Connecting with Claude Desktop

1. Install [Claude Desktop](https://claude.ai/download)
2. Open or create the configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

3. Update it to include this server:

<details>
  <summary>Using <code>npm</code></summary>

```json
{
   "mcpServers":{
      "drawio":{
         "command":"npx",
         "args":[
            "-y",
            "drawio-mcp-server"
         ]
      }
   }
}
```
</details>

<details>
  <summary>Using <code>pnpm</code></summary>

```json
{
   "mcpServers":{
      "drawio":{
         "command":"pnpm",
         "args":[
            "dlx",
            "drawio-mcp-server"
         ]
      }
   }
}
```
</details>

To use a custom extension port (e.g., 8080), add `"--extension-port", "8080"` to the args array:

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

4. Restart Claude Desktop

### Connecting with oterm

This is an alternative MCP client in case you like terminal and you plan to connect to your own Ollama instance.

The configuration is usually in: ~/.local/share/oterm/config.json

<details>
  <summary>Using <code>npm</code></summary>

```json
{
	"mcpServers": {
		"drawio": {
			"command": "npx",
			"args": [
			  "-y",
        "drawio-mcp-server"
			]
		}
	}
}
```
</details>

<details>
  <summary>Using <code>pnpm</code></summary>

```json
{
	"mcpServers": {
		"drawio": {
			"command": "pnpm",
			"args": [
			  "dlx",
        "drawio-mcp-server"
			]
		}
	}
}
```
</details>

To use a custom extension port (e.g., 8080), add `"--extension-port", "8080"` to the args array:

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

### Connect with Zed

1. Open the Zed Preview application.
1. Click the Assistant (✨) icon in the bottom right corner.
1. Click Settings in the top right panel of the Assistant.
1. In the Context Servers section, click + Add Context Server.
1. Configure with the following:

<details>
  <summary>Using <code>npm</code></summary>

```json
{
  /// The name of your MCP server
  "drawio": {
	/// The path to the executable
	"command": "npx",
	/// The arguments to pass to the executable
	"args": [
	  "-y",
	  "drawio-mcp-server"
	],
	/// The environment variables to set for the executable
    "env": {}
  }
}
```
</details>

<details>
  <summary>Using <code>pnpm</code></summary>

```json
{
  /// The name of your MCP server
  "drawio": {
	/// The path to the executable
	"command": "pnpm",
	/// The arguments to pass to the executable
	"args": [
	  "dlx",
	  "drawio-mcp-server"
	],
	/// The environment variables to set for the executable
    "env": {}
  }
}
```
</details>

To use a custom extension port (e.g., 8080), add `"--extension-port", "8080"` to the args array:

```json
{
  "drawio": {
    "command": "npx",
    "args": [
      "-y",
      "drawio-mcp-server",
      "--extension-port",
      "8080"
    ],
    "env": {}
  }
}
```

### Connecting with Codex

Edit the configuration usually located in: ~/.codex/config.toml

<details>
  <summary>Using <code>npm</code></summary>

```toml
[mcp_servers.drawio]
command = "npx"
args = [
    "-y",
    "drawio-mcp-server"
]
```
</details>

<details>
  <summary>Using <code>pnpm</code></summary>

```toml
[mcp_servers.drawio]
command = "pnpm"
args = [
    "dlx",
    "drawio-mcp-server"
]
```
</details>

To use a custom extension port (e.g., 8080), add `"--extension-port", "8080"` to the args array:

<details>
  <summary>Using <code>npm</code></summary>

```toml
[mcp_servers.drawio]
command = "npx"
args = [
    "-y",
    "drawio-mcp-server",
    "--extension-port",
    "8080"
]
```
</details>

To connect to a locally running MCP with Streamable HTTP transport:

```toml
[mcp_servers.drawio]
url = "http://localhost:3000/mcp"
```


### Browser Extension Setup

In order to control the Draw.io diagram, you need to install dedicated Browser Extension.

1. Open [Draw.io in your browser](https://app.diagrams.net/)
2. Install the Draw.io MCP Browser Extension from a web store or [use other means](https://github.com/lgazo/drawio-mcp-extension)
<p>
  <a href="https://chrome.google.com/webstore/detail/drawio-mcp-extension/okdbbjbbccdhhfaefmcmekalmmdjjide">
    <picture>
      <source srcset="https://i.imgur.com/XBIE9pk.png" media="(prefers-color-scheme: dark)" />
      <img height="58" src="https://i.imgur.com/oGxig2F.png" alt="Chrome Web Store" /></picture
  ></a>
  <a href="https://addons.mozilla.org/en-US/firefox/addon/drawio-mcp-extension/">
    <picture>
      <source srcset="https://i.imgur.com/ZluoP7T.png" media="(prefers-color-scheme: dark)" />
      <img height="58" src="https://i.imgur.com/4PobQqE.png" alt="Firefox add-ons" /></picture
  ></a>
</p>
3. Ensure it is connected, the Extension icon should indicate green signal overlay <img alt="Extension connected" src="https://raw.githubusercontent.com/lgazo/drawio-mcp-extension/refs/heads/main/public/icon/logo_connected_32.png" />

**Important**: If you configured the MCP server to use a custom port (not 3333), you must configure the browser extension to use the same port. See the extension documentation for port configuration instructions.


## Sponsoring

If you enjoy the project or find it useful, consider supporting its continued development.


lightning invoice:

![lightning invoice](./lightning_qr.png)

```
lnbc1p5f8wvnpp5kk0qt60waplesw3sjxu7tcqwmdp6ysq570dc4ln52krd3u5nzq6sdp82pshjgr5dusyymrfde4jq4mpd3kx2apq24ek2uscqzpuxqr8pqsp5gvr72xcs883qt4hea6v3u7803stcwfnk5c9w0ykqr9a40qqwnpys9qxpqysgqfzlhm0cz5vqy7wqt7rwpmkacukrk59k89ltd5n642wzru2jn88tyd78gr4y3j6u64k2u4sd4qgavlsnccl986velrg3x0pe95sx7p4sqtatttp
```

lightning address:
```
ladislav@blink.sv
```

<div align="center">
<a href="https://liberapay.com/ladislav/donate"><img alt="Donate using Liberapay" src="https://liberapay.com/assets/widgets/donate.svg"></a>
</div>

## Features

The Draw.io MCP server provides the following tools for programmatic diagram interaction:

### Diagram Inspection Tools
- **`get-selected-cell`**
  Retrieves the currently selected cell in Draw.io with all its attributes
  *Returns*: JSON object containing cell properties (ID, geometry, style, value, etc.)

- **`get-shape-categories`**
  Retrieves available shape categories from the diagram's library
  *Returns*: Array of category objects with their IDs and names

- **`get-shapes-in-category`**
  Retrieves all shapes in a specified category from the diagram's library
  *Parameters*:
    - `category_id`: Identifier of the category to retrieve shapes from
  *Returns*: Array of shape objects with their properties and styles

- **`get-shape-by-name`**
  Retrieves a specific shape by its name from all available shapes
  *Parameters*:
    - `shape_name`: Name of the shape to retrieve
  *Returns*: Shape object including its category and style information

- **`list-paged-model`**
  Retrieves a paginated view of all cells (vertices and edges) in the current Draw.io diagram. This tool provides access to the complete model data with essential fields only, sanitized to remove circular dependencies and excessive data. It allows to filter based on multiple criteria and attribute boolean logic. Useful for programmatic inspection of diagram structure without overwhelming response sizes.

### Diagram Modification Tools
- **`add-rectangle`**
  Creates a new rectangle shape on the active Draw.io page with customizable properties:
  - Position (`x`, `y` coordinates)
  - Dimensions (`width`, `height`)
  - Text content
  - Visual style (fill color, stroke, etc. using Draw.io style syntax)

- **`add-edge`**
  Creates a connection between two cells (vertexes)
  *Parameters*:
    - `source_id`: ID of the source cell
    - `target_id`: ID of the target cell
    - `text`: Optional text label for the edge
    - `style`: Optional style properties for the edge

- **`delete-cell-by-id`**
  Removes a specified cell from the diagram
  *Parameters*:
    - `cell_id`: ID of the cell to delete

- **`add-cell-of-shape`**
  Adds a new cell of a specific shape type from the diagram's library
  *Parameters*:
    - `shape_name`: Name of the shape to create
    - `x`, `y`: Position coordinates (optional)
    - `width`, `height`: Dimensions (optional)
    - `text`: Optional text content
    - `style`: Optional additional style properties

- **`set-cell-shape`**
  Applies a library shape's style to an existing cell
  *Parameters*:
    - `cell_id`: ID of the cell whose appearance should change
    - `shape_name`: Name of the library shape whose style should be applied

- **`set-cell-data`**
  Stores or updates a custom attribute on a cell
  *Parameters*:
    - `cell_id`: ID of the cell to update
    - `key`: Attribute name to set
    - `value`: Attribute value (stored as a string internally)

- **`edit-cell`**
  Updates an existing vertex/shape cell in place by ID
  *Parameters*:
    - `cell_id`: ID of the cell whose properties should change (required)
    - `text`, `x`, `y`, `width`, `height`, `style`: Optional fields to update on the cell; omitted properties stay as-is

- **`edit-edge`**
  Updates an existing edge connection between cells by ID
  *Parameters*:
    - `cell_id`: ID of the edge cell to update (required)
    - `text`: Optional edge label text
    - `source_id`, `target_id`: Optional IDs of new source/target cells
    - `style`: Optional replacement style string

## Related Resources

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
