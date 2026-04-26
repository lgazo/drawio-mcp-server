# Development

## Local browser configuration

web-ext.config.ts
```
import { defineWebExtConfig } from "wxt";

export default defineWebExtConfig({
  // disabled: true,
  startUrls: ["https://app.diagrams.net"],
  openConsole: true,
  openDevtools: true,
});
```
## Popup

chrome-extension://kaojkbhgfapmlcpdfiacogniedjfbifg/popup.html

## Testing

Alternative page to https://app.diagrams.net to test different URL pattern match is: https://jgraph.github.io/drawio/src/main/webapp/index.html

### Iframe injection

Local harness for verifying the `injectIntoIframes` option (added on the `feat/iframe-support` branch).

```bash
pnpm --filter drawio-mcp-extension test:iframe-host
# serves http://127.0.0.1:5174/  (override with PORT= / HOST=)
```

The fixture (`fixtures/iframe-host.html`) embeds one iframe pointing at `embed.diagrams.net` (the `app.diagrams.net` host blocks framing via `X-Frame-Options`).

Verification steps:

1. In the extension Options page, add `http://localhost:*/*` and `*://*.diagrams.net/*` to URL patterns.
2. Toggle **Inject into iframes** ON. Reload `http://127.0.0.1:5174/`.
3. Open the background service worker DevTools console. Each frame whose content script connects logs `content port connected (total=N)`. With the iframe loaded and matching, `total` should reach 2 (host page + drawio frame).
4. Toggle **Inject into iframes** OFF, reload. Only the top-frame port should connect (`total=1`).


# Publishing

Badge inspiration from https://github.com/timbru31/amazon-tag-remover

## Chrome Web Store

https://chrome.google.com/u/2/webstore/devconsole

[Branding guidelines](https://developer.chrome.com/docs/webstore/branding)

## Mozilla Firefox Add-ons

https://addons.mozilla.org/en-US/developers/addons
