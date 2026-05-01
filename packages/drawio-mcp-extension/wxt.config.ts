import { defineConfig } from "wxt";

const bg =
  process.env.MODE === "plugin" ? "background-plugin.js" : "background.js";
console.log("BACKGROUND:", bg);

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  background: {
    service_worker: bg,
  },
  manifest: ({ browser }) => ({
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
    ...(browser === "firefox" && {
      browser_specific_settings: {
        gecko: {
          id: "{829ae72d-49d6-4ffd-a810-b245e2e494a6}",
          strict_min_version: "109.0",
        },
      },
    }),
  }),
});
