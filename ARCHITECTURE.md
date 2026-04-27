# Architecture

## Core Capabilities
- **Bi-directional Communication**: Real-time interaction between MCP clients and Draw.io
- **WebSocket Bridge**: Built-in WebSocket server (port 3333) for browser extension connectivity
- **Standardized Protocol**: Full MCP compliance for seamless agent integration
- **Debugging Support**: Integrated with Chrome DevTools via `--inspect` flag

## Architecture Highlights
- Event-driven system using Node.js EventEmitter
- `ws` WebSocket server for extension connectivity
- Zod schema validation for all tool parameters
- Plugin-ready design for additional tool development

## Page Execution
- Live tools are routed to a connected Draw.io document through `target_document`; when only one document is connected, the server can select it automatically.
- Page-scoped tools use explicit `target_page` selectors so agents can address pages by stable id or index.
- Page execution supports visible-page, background-page, and hybrid-page modes depending on whether the Draw.io operation needs UI state.
- Live operations are serialized per document with a FIFO queue, which prevents concurrent MCP clients from interleaving page switches and writes in the same tab.

*Note: Additional tools can be easily added by extending the server implementation.*
