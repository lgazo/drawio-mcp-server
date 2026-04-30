import { bootstrapPlugin, type Transport } from "drawio-mcp-plugin";
import { bus_reply_stream, bus_request_stream } from "../types";
import type { DrawioUI } from "../types";

const transport: Transport = {
  send: (message) => {
    window.dispatchEvent(
      new CustomEvent(bus_reply_stream, { detail: message }),
    );
  },
  onMessage: (listener) => {
    window.addEventListener(bus_request_stream, (event: any) => {
      listener(event?.detail);
    });
  },
};

export default defineUnlistedScript(() => {
  console.log("Hello from the main world");
  const checkInterval = setInterval(() => {
    if (window.Draw) {
      clearInterval(checkInterval);
      window.Draw.loadPlugin((ui: DrawioUI) => {
        console.log("plugin loaded", ui);
        bootstrapPlugin({ ui, transport });
      });
    } else {
      const el = document.querySelector(
        "body > div.geMenubarContainer > div.geMenubar > div > button",
      );
      if (el) {
        el.innerHTML = Date.now().toString();
      }
    }
  }, 1000);
});
