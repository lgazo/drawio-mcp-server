# Draw.io MCP Browser Extension

Let's do some Vibe Diagramming with the most wide-spread diagramming tool called Draw.io (Diagrams.net).

This is a necessary counterpart for [Draw.io MCP Server](https://github.com/lgazo/drawio-mcp-server)

[![Discord channel](https://shields.io/static/v1?logo=discord&message=draw.io%20mcp&label=chat&color=5865F2&logoColor=white)](https://discord.gg/dM4PWdf42q) [![Build project](https://github.com/lgazo/drawio-mcp-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/lgazo/drawio-mcp-extension/actions/workflows/ci.yml)


## Requirements

### Optional for Development
- **pnpm** - Preferred package manager

## Installation

For detailed end-to-end Draw.io MCP installation please follow the description on [Draw.io MCP Server](https://github.com/lgazo/drawio-mcp-server).

There are the following options to install the Extension itself.

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

### Release package

You can download a ZIP for one of the browsers in the [Release section](https://github.com/lgazo/drawio-mcp-extension/releases).

### GitHub CI package

You can download a ZIP with both versions of the Extension for Chrome and Firefox in the [`package` workflow](https://github.com/lgazo/drawio-mcp-extension/actions/workflows/package.yml).

Just open a job run, scroll to the **Artifact** section, download the ZIP and side load the extension for one of the supported browsers.

### Local build

You can build a version of the extension by running:

```sh
pnpm run build
```

or

```sh
pnpm run build:firefox
```

It will build expanded version in the `.output` folder.

If you need a ZIP/CRX, run one of the following:

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
2. Click the **⚙️ Settings** button (or access extension settings through your browser's extension management page)
3. Enter your desired port number (1024-65535)
4. Click **Save Settings**

The connection will automatically reconnect with the new configuration. The configured port is displayed in the popup for easy verification.

**Note:** Make sure your Draw.io MCP Server is running on the same port you configure here. Restarting the browser will not reset the configuration - it persists across sessions.

### Connection Status

The extension icon indicates the current connection state:
- 🟢 Green: Connected to the server
- 🟠 Orange: Connecting/reconnecting
- 🔴 Red: Disconnected

You can also view the current configured port and connection status in the extension popup.

## Sponsoring

If you enjoy the project or find it useful, consider supporting its continued development.


lightning invoice:

![lightning invoice](./lightning_qr.png)

```
lnbc1p5f8wvnpp5kk0qt60waplesw3sjxu7tcqwmdp6ysq570dc4ln52krd3u5nzq6sdp82pshjgr5dusyymrfde4jq4mpd3kx2apq24ek2uscqzpuxqr8pqsp5gvr72xcs883qt4hea6v3u7803stcwfnk5c9w0ykqr9a40qqwnpys9qxpqysgqfzlhm0cz5vqy7wqt7rwpmkacukrk59k89ltd5n642wzru2jn88tyd78gr4y3j6u64k2u4sd4qgavlsnccl986velrg3x0pe95sx7p4sqtatttp
```

lightning address:
```
ladislav@blink.sv
```

<div align="center">
<a href="https://liberapay.com/ladislav/donate"><img alt="Donate using Liberapay" src="https://liberapay.com/assets/widgets/donate.svg"></a>
</div>

## Related Resources

[Troubleshooting](./TROUBLESHOOTING.md)

[Contributing](./CONTRIBUTING.md)

[Development](./DEVELOPMENT.md)

## Star History

<a href="https://star-history.com/#lgazo/drawio-mcp-extension&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=lgazo/drawio-mcp-extension&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=lgazo/drawio-mcp-extension&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=lgazo/drawio-mcp-extension&type=Date" />
 </picture>
</a>
