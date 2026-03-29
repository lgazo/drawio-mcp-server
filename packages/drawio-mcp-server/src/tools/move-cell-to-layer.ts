import { z } from "zod";

import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_move_cell_to_layer = "move-cell-to-layer";

export const registerMoveCellToLayerTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_move_cell_to_layer,
    "Moves a cell from its current layer to a target layer.",
    {
      cell_id: z.string().describe("ID of the cell to move"),
      target_layer_id: z
        .string()
        .describe("ID of the target layer where the cell will be moved"),
    },
    default_tool(TOOL_move_cell_to_layer, context),
  );
};
