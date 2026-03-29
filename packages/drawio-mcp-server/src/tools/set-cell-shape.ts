import { z } from "zod";

import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_set_cell_shape = "set-cell-shape";

export const registerSetCellShapeTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_set_cell_shape,
    "Updates the visual style of an existing vertex cell to match a library shape by name.",
    {
      cell_id: z
        .string()
        .describe(
          "Identifier (`id` attribute) of the cell whose shape should change.",
        ),
      shape_name: z
        .string()
        .describe(
          "Name of the library shape whose style should be applied to the existing cell.",
        ),
    },
    default_tool(TOOL_set_cell_shape, context),
  );
};
