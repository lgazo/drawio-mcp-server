import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_get_selected_cell = "get-selected-cell";

export const registerGetSelectedCellTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_get_selected_cell,
    "This tool allows you to retrieve selected cell (whether vertex or edge) on the current page of a Draw.io diagram. The response is a JSON containing attributes of the cell.",
    {},
    default_tool(TOOL_get_selected_cell, context),
  );
};
