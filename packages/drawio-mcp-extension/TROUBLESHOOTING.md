# Troubleshooting

## Supported Draw.io instances

You need to navigate to [Draw.io app](https://app.diagrams.net/).

That is the one page used for testing.

## Check working connection to MCP server

Click on the Extension icon.

Popup should open and report connection status.

## Log files for the Extension

Navigate to [chrome://extensions/](chrome://extensions/).

Make sure the **Developer mode** is active - upper right checkbox.

Click on the **Service worker** link in the drawio-mcp-extension card.

That should open DevTools of the Service Worker.

Click on the **Console** tab. You should see default log entries.

In order to see **Debug** logs, change the dropdown from **Default levels** and include also **Verbose**. The dropdown is located in the second row, more to the right, usually.

Standard initial log looks like the following:
```
[wxt] Connecting to dev server @ http://localhost:3000
Hello background! Object
[wxt] Connected to dev server
[wxt] Reloading content script: Object
[background] WebSocket connection established Event
[wxt] Existing scripts: Array(0)
[wxt] Registering new content script...
[background] broadcast to tabs Array(2)
[background] Connection state requested by popup
```

## Log files for the content script

You can get additional log files from the tab, where you navigated to Draw.io.

Open DevTools and open **Console** tab to see logs.

You should see following message:

```
Hello content 1747237705715 {window: Window, browser: {…}}
Hello from the main world
plugin loaded App {eventSource: undefined, destroyFunctions: Array(1), editor: Editor, container: body.geEditor.geSimple, selectionStateListener: ƒ, …}
[bus] registered get-selected-cell
[bus] registered add-rectangle
[bus] registered delete-cell-by-id
[bus] registered add-edge
[bus] registered get-shape-categories
[bus] registered get-shapes-in-category
[bus] registered get-shape-by-name
[bus] registered add-cell-of-shape
```

## WebSocket Port Configuration Issues

### Port Configuration Not Persisting

**Problem:** The extension continues connecting to the default port (3333) after changing settings.

**Solution:**
1. Open the extension settings page (click ⚙️ in popup or browser's extension settings)
2. Verify the port number was saved correctly
3. Check the popup displays "Status: Connected" after saving
4. If still not working, try resetting to defaults and reconfiguring

**Debug:** Check the service worker console for messages like "Configuration changed, reconnecting..."

### Connection Fails After Port Change

**Problem:** Extension shows "Status: Disconnected" after changing the port.

**Possible causes:**
1. The Draw.io MCP Server is not running on the configured port
2. Firewall blocking the configured port
3. Port is already in use by another application

**Solution:**
1. Verify your Draw.io MCP Server is running on the correct port
2. Check that no other application is using the port: `netstat -an | grep <port>`
3. Temporarily disable firewall or add an exception for the port
4. Try a different port number (e.g. 3001, 8080, etc.)

### Invalid Port Configuration

**Problem:** Can't save a port number.

**Error:** "Port must be between 1024 and 65535"

**Solution:** Choose a port number in the valid range (1024-65535). Port numbers below 1024 are typically reserved for system services.

### Reset Configuration to Defaults

To reset the port back to 3333:

1. Open extension settings
2. Click "Reset to Defaults"
3. Click "Save Settings"

The extension will reconnect using the default port 3333.

### Port Configuration Disappears

**Problem:** After browser restart, the configured port resets to default.

**Solutions:**
1. The extension uses browser storage for persistence. Clear browser data might cause this.
2. Recheck and re-save your configuration
3. Verify browser storage permissions are not blocked

**Debug:** Check service worker console for storage-related errors.
