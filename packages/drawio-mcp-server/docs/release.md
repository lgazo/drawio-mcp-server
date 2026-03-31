# Release

## Release preparation

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
