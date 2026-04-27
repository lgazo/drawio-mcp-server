import { z } from "zod";

import { default_tool } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_delete_cell_by_id = "delete-cell-by-id";

export const registerDeleteCellByIdTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_delete_cell_by_id,
    "Deletes a cell from the target page, whether it is a vertex or edge.",
    {
      target_page: target_page_field(),
      cell_id: z
        .string()
        .describe(
          "The ID of a cell to delete. The cell can be either vertex or edge. The ID is located in `id` attribute.",
        ),
    },
    default_tool(TOOL_delete_cell_by_id, context, { queue: true }),
  );
};
