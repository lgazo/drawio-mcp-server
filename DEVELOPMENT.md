# Development

## Watching changes

The following command watches for changes.

```sh
pnpm run dev
```

It builds JavaScript output that can be then in turn ran by MCP client.

## MCP Inspector client

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
