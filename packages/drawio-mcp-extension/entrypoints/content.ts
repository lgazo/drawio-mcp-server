import { bus_reply_stream, bus_request_stream } from "@/types";

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

    // Listen for messages from background
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === "WS_MESSAGE") {
        console.log(
          "[content] Received from background from WebSocket:",
          message.data,
        );
        window.dispatchEvent(
          new CustomEvent(bus_request_stream, { detail: message.data }),
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
      const reply = message.detail;
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
