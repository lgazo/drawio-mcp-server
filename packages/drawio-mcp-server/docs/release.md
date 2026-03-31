# Release

## Release preparation

### Update the MCP version

In `/packages/drawio-mcp-server/src/index.ts`.

`const VERSION`.

### Update Key Highlights

In `/README.md`.

Maintain 2 versions of highlight chips - version to be released and one before.

### Overwrite server's README

Overwrite server's README with the one in root of the project. That is displayed in the npm registry.

### Check the final package works

1. Create tarball (what npm would publish)
```
cd packages/drawio-mcp-server
pnpm pack
```
2. Simulate a fresh install in a temp dir
```
cd /tmp && mkdir test-install && cd test-install
npm install /path/to/drawio-mcp-server-2.0.2.tgz
```
3. Run it
```
npx drawio-mcp-server --editor
```

### Unpack built Extension

Unpack, import and test it loads.
