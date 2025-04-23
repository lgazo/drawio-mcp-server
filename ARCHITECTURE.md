# Architecture

## Core Capabilities
- **Bi-directional Communication**: Real-time interaction between MCP clients and Draw.io
- **WebSocket Bridge**: Built-in WebSocket server (port 3000) for browser extension connectivity
- **Standardized Protocol**: Full MCP compliance for seamless agent integration
- **Debugging Support**: Integrated with Chrome DevTools via `--inspect` flag

## Architecture Highlights
- Event-driven system using Node.js EventEmitter
- uWebSockets.js for high-performance WebSocket connections
- Zod schema validation for all tool parameters
- Plugin-ready design for additional tool development

*Note: Additional tools can be easily added by extending the server implementation.*
