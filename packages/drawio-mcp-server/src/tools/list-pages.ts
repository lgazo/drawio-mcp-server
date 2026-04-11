import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_list_pages = "list-pages";

export const registerListPagesTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_list_pages,
    "Lists all pages in the current Draw.io document with their index, id, name, and current-page flag.",
    {},
    default_tool(TOOL_list_pages, context, { queue: true }),
  );
};
