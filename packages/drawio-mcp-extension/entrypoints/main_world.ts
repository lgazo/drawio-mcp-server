import { toolDefinitions } from "drawio-mcp-plugin";
import { on_standard_tool_request_from_server } from "../bus";
import type { DrawioUI } from "../types";

export default defineUnlistedScript(() => {
  console.log("Hello from the main world");
  const checkInterval = setInterval(() => {
    if (window.Draw) {
      clearInterval(checkInterval);
      window.Draw.loadPlugin((ui: DrawioUI) => {
        console.log("plugin loaded", ui);

        //TODO: just for testing / exploring Draw.io
        // window.ui = ui;
        // window.editor = editor;
        // window.graph = graph;

        toolDefinitions.forEach((definition) => {
          on_standard_tool_request_from_server(
            definition.name,
            ui,
            definition.params,
            definition.handler,
          );
        });
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
