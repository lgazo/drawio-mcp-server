import { defineConfig } from "wxt";

const bg = process.env.MODE === "plugin" ? "background-plugin.js" : "background.js";
console.log("BACKGROUND:", bg);

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  background: {
    service_worker: bg,
  },
  manifest: {
    name: "Draw.io MCP Extension",
    permissions: ["storage", "scripting"],
    host_permissions: ["<all_urls>"],
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
    web_accessible_resources: [
      {
        resources: ["main_world.js"],
        matches: ["<all_urls>"],
      },
    ],
    browser_specific_settings: {
      gecko: {
        id: "drawio-mcp@gazo.dev",
      },
    },
  },
});
