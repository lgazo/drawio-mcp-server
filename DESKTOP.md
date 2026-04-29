# Draw.io Desktop Support (Experimental)

> **Experimental.** Full integration with draw.io desktop is **not working end-to-end yet** because draw.io desktop ships with a hard-coded Content Security Policy (`connect-src 'self'`) that blocks the plugin's WebSocket connection to the local MCP server. There is no built-in flag or configuration to relax that CSP. Until upstream fixes this or we find a non-invasive workaround, the plugin will fail to connect inside draw.io desktop with a CSP error in the console.
>
> Tracking: [jgraph/drawio-desktop CSP behavior](https://github.com/jgraph/drawio-desktop/blob/dev/src/main/electron.js), local issues [#19](https://github.com/lgazo/drawio-mcp-server/issues/19) and [#11](https://github.com/lgazo/drawio-mcp-server/issues/11).
>
> The steps below describe the *intended* setup. The plugin itself loads correctly inside draw.io desktop; only the WebSocket back to the MCP server is currently blocked. If you only need a fully-local experience, prefer the simpler `--editor` mode (the server self-hosts Draw.io) instead.

## When this is for you

Use draw.io desktop with the MCP server when:

- `app.diagrams.net` is blocked by a corporate firewall (issue [#11](https://github.com/lgazo/drawio-mcp-server/issues/11)) and you cannot use a browser, **and**
- you specifically want the native draw.io desktop UI (issue [#19](https://github.com/lgazo/drawio-mcp-server/issues/19)).

If neither applies, the simpler `--editor` mode (server self-hosts Draw.io) is fully local and recommended.

## Requirements

- **draw.io desktop** v19.0.3 or newer ([jgraph/drawio-desktop](https://github.com/jgraph/drawio-desktop)).
- Ability to launch draw.io with the `--enable-plugins` flag (external plugins are disabled by default since v19.0.3).

## 1. Install the plugin

```sh
npx drawio-mcp-server --install-desktop-plugin
```

This copies `mcp-plugin.js` into draw.io desktop's plugins directory **and then continues into the normal server startup**, so you can keep `--install-desktop-plugin` in your MCP host config and the install will happen on every launch (always overwriting, harmless on subsequent runs). The plugin lands at:

| OS | Path |
|---|---|
| Linux | `${XDG_CONFIG_HOME:-~/.config}/draw.io/plugins/mcp-plugin.js` |
| macOS | `~/Library/Application Support/draw.io/plugins/mcp-plugin.js` |
| Windows | `%APPDATA%\draw.io\plugins\mcp-plugin.js` |

## 2. Enable plugins in draw.io desktop

External plugins are disabled by default since draw.io desktop v19.0.3. Launch draw.io with `--enable-plugins`, e.g.:

```sh
drawio --enable-plugins
```

(On Windows/macOS, edit your application shortcut to append the flag.)

## 3. Register the plugin via Configuration

> **Why not the `Extras → Plugins → Add` dialog?**
> A draw.io desktop bug ([jgraph/drawio-desktop#1993](https://github.com/jgraph/drawio-desktop/issues/1993)) silently disables plugins added via that dialog after the first reload, even though they remain listed. Registering through the Configuration JSON below survives restarts reliably.

In draw.io desktop:

1. Open **Extras → Configuration** (the Configuration JSON dialog).
2. Add the `plugins` entry (merge with any existing keys):
   ```json
   {
     "plugins": ["mcp-plugin.js"]
   }
   ```
3. Click **Save** and restart draw.io.
4. Verify via **Help → Developer Tools → Console**: you should see `[plugin] MCP Plugin fully initialized`.

## 4. Run the MCP server

Start the server from your MCP host as usual (no special flag needed). The plugin connects to `ws://localhost:3333` by default; override it from the plugin's settings dialog (added by this plugin to draw.io's Extras menu) if you run the server on a different port or host.

## Known limitation: CSP blocks the WebSocket

Once the plugin is loaded, opening draw.io's DevTools console will show a CSP violation similar to:

```
Refused to connect to 'ws://localhost:3333/' because it violates the following Content Security Policy directive: "connect-src 'self'".
```

draw.io desktop's main process injects this CSP via `webRequest.onHeadersReceived` and there is no flag, env var, or configuration to override it. The plugin cannot relax CSP from inside the renderer (CSP is set on response headers before the plugin runs).

A non-invasive workaround does not exist today. If/when one becomes available, this document will be updated.
