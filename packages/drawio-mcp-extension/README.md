# Draw.io MCP Browser Extension

Browser extension for connecting [Draw.io MCP Server](../../README.md) to Draw.io running in your browser.

## Installation

### Web Store

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

### Release Package

Download a ZIP for your browser from the [Release section](https://github.com/lgazo/drawio-mcp-server/releases).

### CI Package

Download a ZIP with both Chrome and Firefox versions from the [`Extension Package` workflow](https://github.com/lgazo/drawio-mcp-server/actions/workflows/extension-package.yml).

Open a job run, scroll to the **Artifact** section, download the ZIP and side load the extension.

### Local Build

```sh
pnpm run build
```

or

```sh
pnpm run build:firefox
```

For a ZIP/CRX:

```sh
pnpm run zip
```

or

```sh
pnpm run zip:firefox
```

## Configuration

### WebSocket Server Port

By default, the extension connects to the Draw.io MCP Server on port `3333`. You can configure a different port through the extension options:

1. Click on the extension icon to open the popup
2. Click the **Settings** button
3. Enter your desired port number (1024-65535)
4. Click **Save Settings**

The connection will automatically reconnect with the new configuration. The configured port is displayed in the popup for easy verification.

**Note:** Make sure your Draw.io MCP Server is running on the same port you configure here. Restarting the browser will not reset the configuration - it persists across sessions.

### Connection Status

The extension icon indicates the current connection state:
- Green: Connected to the server
- Orange: Connecting/reconnecting
- Red: Disconnected

You can also view the current configured port and connection status in the extension popup.

## Documentation

- [Troubleshooting](./TROUBLESHOOTING.md)
- [Development](./DEVELOPMENT.md)
- [Main project documentation](../../README.md)
