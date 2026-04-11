import { z } from "zod";

import { default_tool } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_get_selected_cell = "get-selected-cell";

export const registerGetSelectedCellTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_get_selected_cell,
    "This tool retrieves the selected cell on the target page of the current Draw.io document.",
    {
      target_page: target_page_field(),
    },
    default_tool(TOOL_get_selected_cell, context, { queue: true }),
  );
};
