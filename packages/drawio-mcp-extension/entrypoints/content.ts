import { bus_reply_stream, bus_request_stream } from "@/types";

const CONTENT_PORT_NAME = "drawio-mcp-frame";

// Send message to WebSocket via background
function sendToWebSocket(data: any) {
  browser.runtime.sendMessage({
    type: "SEND_WS_MESSAGE",
    data: data,
  });
}

// Content script is now registered dynamically via background.ts
// The matches are configured by users in the options page
export default defineContentScript({
  // Note: matches will be empty here since we're using dynamic registration
  registration: 'runtime',
  matches: [],
  async main() {
    console.log("Hello content " + Date.now(), { window, browser });
    await injectScript("/main_world.js", {
      keepInDom: true,
    });

    // Open a long-lived port to the background. This is the channel
    // background uses to broadcast WS messages to every frame (including
    // iframes) — browser.tabs.sendMessage would only hit the top frame.
    const port = browser.runtime.connect({ name: CONTENT_PORT_NAME });

    // Firefox content scripts run in an Xray-wrapped view of the page's window.
    // Objects passed across that boundary in CustomEvent.detail must be cloned
    // into the page compartment (CS->page) and unwrapped on the way back
    // (page->CS). cloneInto/wrappedJSObject are undefined in Chromium, so the
    // feature-detect keeps Chrome behavior unchanged.
    const cloneIntoPage = (data: unknown) => {
      const ci = (globalThis as any).cloneInto;
      return typeof ci === "function" ? ci(data, window, { cloneFunctions: false }) : data;
    };

    port.onMessage.addListener((message: any) => {
      if (message.type === "WS_MESSAGE") {
        console.log(
          "[content] Received from background from WebSocket:",
          message.data,
        );
        window.dispatchEvent(
          new CustomEvent(bus_request_stream, { detail: cloneIntoPage(message.data) }),
        );
      } else if (message.type === "WS_STATUS") {
        console.log(
          "WebSocket status:",
          message.connected ? "Connected" : "Disconnected",
        );
      }
    });

    window.addEventListener(bus_reply_stream, (message: any) => {
      console.log("[content] reply received", message);
      const raw = (message.detail as any)?.wrappedJSObject ?? message.detail;
      const reply = raw ? JSON.parse(JSON.stringify(raw)) : raw;
      if (reply === undefined || reply === null) {
        console.warn(
          `[content] suspicious empty message detail received`,
          message,
        );
      }
      sendToWebSocket(reply);
    });
  },
});
