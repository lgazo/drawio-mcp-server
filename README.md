# Draw.io MCP server

Let's do some Vibe Diagramming with the most wide-spread diagramming tool called Draw.io (Diagrams.net).

[![Build project](https://github.com/lgazo/drawio-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/lgazo/drawio-mcp-server/actions/workflows/ci.yml)

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
- **Node.js** (v18 or higher) - Runtime environment for the MCP server
- **Draw.io MCP Browser Extension** - Enables communication between Draw.io and the MCP server

### MCP Ecosystem
- **MCP Client** (e.g., [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)) - For testing and debugging the integration
- **LLM with Tools Support** - Any language model capable of handling MCP tool calls (e.g., GPT-4, Claude 3, etc.)

### Optional for Development
- **pnpm** - Preferred package manager
- **Chrome DevTools** - For debugging when using `--inspect` flag

Note: The Draw.io desktop app or web version must be accessible to the system where the MCP server runs.

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
    "command": {
      /// The path to the executable
      "path": "npx",
      /// The arguments to pass to the executable
      "args": ["-y","drawio-mcp-server"],
      /// The environment variables to set for the executable
      "env": {}
    }
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
    "command": {
      /// The path to the executable
      "path": "pnpm",
      /// The arguments to pass to the executable
      "args": ["dlx","drawio-mcp-server"],
      /// The environment variables to set for the executable
      "env": {}
    }
  }
}
```
</details>

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

## Related Resources

[Troubleshooting](./TROUBLESHOOTING.md)

[Prompt examples](./docs/examples/index.md)

[Contributing](./CONTRIBUTING.md)

[Architecture](./ARCHITECTURE.md)

[Development](./DEVELOPMENT.md)
