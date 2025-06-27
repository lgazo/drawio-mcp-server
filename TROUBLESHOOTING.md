# Troubleshooting

## Debug logs

MCP server uses stdio (standard console output) for the communication between MCP Client and MCP server. In order to provide essential debug information at this stage of the development, detailed logs are reported as console **error** output, until better logging system is implemented.

## What if the server goes down?

Extension has exponential re-connection mechanism. Robust connection management is not in place yet.

When server is disconnected, you should see attempts to reconnect in the Extension:

```
[background] WebSocket connection closed CloseEvent {isTrusted: true, wasClean: false, code: 1006, reason: '', type: 'close', …}

Attempting to reconnect in 4.5 seconds... (attempt 1)

[background] broadcast to tabs (2) [{…}, {…}]
[background] WebSocket connection established Event {isTrusted: true, type: 'open', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}
[background] broadcast to tabs (2) [{…}, {…}]
```

There are currently **5** reconnection attempts with initial delay of **3 seconds** growing exponentially.

You can force the reconnection by re-enabling / refreshing the Extension in [chrome://extensions](chrome://extensions).

## Does the MCP server run by itself?

Running `pnpm` version should output the following.

```sh
pnpm dlx drawio-mcp-server
```

Terminal output:

```
Packages: +109
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved 109, reused 107, downloaded 2, added 109, done
Listening to port 3333 undefined
Draw.io MCP Server running on stdio undefined
```

Running `npx` version should output the following.

```sh
npx -y drawio-mcp-server
```

Terminal output:
``` 
DEBUG: Draw.io MCP Server starting
DEBUG: [start_websocket_server] Listening to port 3333
DEBUG: Draw.io MCP Server WebSocket started
DEBUG: Draw.io MCP Server running on stdio
```

When Extension connects, you should see:

```
DEBUG: [ws_handler] A WebSocket client #0 connected, presumably MCP Extension!
```
