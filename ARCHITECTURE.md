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

For multi-agent usage inside a single Draw.io document, page-scoped tools now require a `target_page` selector (`{ index }` or `{ id }`). The server serializes live operations in FIFO order per connected document, so concurrent agents can safely work on different pages and different files without interleaving page switches and writes inside the same tab.

Most page model tools now execute against off-page models without switching the visible browser page. UI-bound tools such as selection, active-layer inspection/changes, selection-only exports, and embedded-XML PNG exports may still switch the visible page to preserve Draw.io semantics.

For multi-tab usage across different Draw.io files, call `list-documents` first. If the server sees exactly one connected document, live tools auto-target it. If it sees multiple connected documents, every live tool must receive `target_document: { id }` from `list-documents`. The server only talks to already-open Draw.io tabs; it does not open files, open browser tabs, or switch tabs on your behalf.

*Note: Additional tools can be easily added by extending the server implementation.*
