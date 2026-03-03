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


# Publishing

Badge inspiration from https://github.com/timbru31/amazon-tag-remover

## Chrome Web Store

https://chrome.google.com/u/2/webstore/devconsole

[Branding guidelines](https://developer.chrome.com/docs/webstore/branding)

## Mozilla Firefox Add-ons

https://addons.mozilla.org/en-US/developers/addons
