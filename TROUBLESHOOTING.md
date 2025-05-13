# Troubleshooting

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
Listening to port 3333 undefined
Draw.io MCP Server running on stdio undefined
```
