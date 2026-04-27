import { z } from "zod";

import { default_tool } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_set_cell_parent = "set-cell-parent";

export const registerSetCellParentTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_set_cell_parent,
    "Sets the parent of a cell, making it a child of the specified parent cell. This allows creating hierarchical relationships where moving the parent also moves its children.",
    {
      target_page: target_page_field(),
      cell_id: z.string().describe("ID of the cell to reparent"),
      parent_id: z.string().describe("ID of the new parent cell"),
    },
    default_tool(TOOL_set_cell_parent, context, { queue: true }),
  );
};
