import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
// Note: WXT 0.20 derives every background output name from its entrypoint
// file (background.ts -> background.js, background-plugin.ts ->
// background-plugin.js), so both ship in every build and no `background`
// config key exists in UserConfig.
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: ({ browser }) => ({
    name: "Draw.io MCP Extension",
    default_locale: "en",
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
          id: "{e07de650-85aa-4302-9709-d3292c66b674}",
          strict_min_version: "109.0",
        },
      },
    }),
  }),
});
