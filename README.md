# Draw.io MCP server

## Introduction

The Draw.io MCP server is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) tool that brings powerful diagramming capabilities to AI agentic systems. This integration enables:

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

## Features

The Draw.io MCP server provides the following tools for programmatic diagram interaction:

### Diagram Inspection Tools
- **`get-selected-cell`**
  Retrieves the currently selected cell in Draw.io with all its attributes
  *Returns*: JSON object containing cell properties (ID, geometry, style, value, etc.)

### Diagram Modification Tools
- **`add-rectangle`**
  Creates a new rectangle shape on the active Draw.io page with customizable properties:
  - Position (`x`, `y` coordinates)
  - Dimensions (`width`, `height`)
  - Text content
  - Visual style (fill color, stroke, etc. using Draw.io style syntax)

## Requirements

To use the Draw.io MCP server, you'll need:

### Core Components
- **Node.js** (v18 or higher) - Runtime environment for the MCP server
- **Draw.io MCP Browser Extension** - Enables communication between Draw.io and the MCP server

### MCP Ecosystem
- **MCP Client** (e.g., [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)) - For testing and debugging the integration
- **LLM with Tools Support** - Any language model capable of handling MCP tool calls (e.g., GPT-4, Claude 3, etc.)

### Optional for Development
- **pnpm** - Preferred package manager (npm/yarn also supported)
- **Chrome DevTools** - For debugging when using `--inspect` flag

Note: The Draw.io desktop app or web version must be accessible to the system where the MCP server runs.

## Installation

### MCP client

#### oterm

Usually in: ~/.local/share/oterm/config.json

```json
{
	"mcpServers": {
		"drawio": {
			"command": "node",
			"args": [
				"path-to/drawio-mcp-server/build/index.js"
			]
		}
	}
}
```

### Browser Setup
1. Open [Draw.io in your browser](https://app.diagrams.net/)
2. Activate the Draw.io MCP Browser Extension
3. Ensure it connects to `ws://localhost:3000`

## Development

### Watching changes

The following command watches for changes.

```sh
pnpm run dev
```

It builds JavaScript output that can be then in turn ran by MCP client.

### MCP Inspector client

You can use [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) as MCP client to debug your MCP server.

Start:

```sh
pnpm run inspect
```

Every time you rebuild the MCP server script, you need to **Restart** the Inspector tool.
Every time you change the tool definition, you should **Clear** and then **List** the tool again.

If you want to debug the MCP server code, you need to configure the MCP server with **debugging** enabled:

| key | value |
| --- | --- |
| Command | node |
| Arguments | --inspect build/index.js |

Connect Chrome Debugger by opening `chrome://inspect`.

## Architecture

### Core Capabilities
- **Bi-directional Communication**: Real-time interaction between MCP clients and Draw.io
- **WebSocket Bridge**: Built-in WebSocket server (port 3000) for browser extension connectivity
- **Standardized Protocol**: Full MCP compliance for seamless agent integration
- **Debugging Support**: Integrated with Chrome DevTools via `--inspect` flag

### Architecture Highlights
- Event-driven system using Node.js EventEmitter
- uWebSockets.js for high-performance WebSocket connections
- Zod schema validation for all tool parameters
- Plugin-ready design for additional tool development

*Note: Additional tools can be easily added by extending the server implementation.*
