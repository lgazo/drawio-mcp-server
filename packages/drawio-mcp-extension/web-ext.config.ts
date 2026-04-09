import { defineWebExtConfig } from "wxt";

export default defineWebExtConfig({
  // disabled: true,
  startUrls: ["https://app.diagrams.net"],
  openConsole: true,
  openDevtools: true,
  chromiumArgs: ["--remote-debugging-port=9226"],
});
