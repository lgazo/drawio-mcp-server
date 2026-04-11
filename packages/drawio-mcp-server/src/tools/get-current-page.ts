import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_get_current_page = "get-current-page";

export const registerGetCurrentPageTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_get_current_page,
    "Gets the currently visible page metadata, including index, id, name, and whether it is active.",
    {},
    default_tool(TOOL_get_current_page, context, { queue: true }),
  );
};
