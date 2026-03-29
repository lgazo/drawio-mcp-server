import { z } from "zod";

import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_edit_cell = "edit-cell";

export const registerEditCellTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_edit_cell,
    "Update properties of an existing vertex/shape cell by its ID. Only provided fields are modified; unspecified properties remain unchanged.",
    {
      cell_id: z
        .string()
        .describe(
          "Identifier (`id` attribute) of the cell to update. Applies to vertex/shape cells.",
        ),
      text: z
        .string()
        .optional()
        .describe("Replace the cell's text/label content."),
      x: z
        .number()
        .optional()
        .describe("Set a new X-axis position for the cell."),
      y: z
        .number()
        .optional()
        .describe("Set a new Y-axis position for the cell."),
      width: z.number().optional().describe("Set a new width for the cell."),
      height: z.number().optional().describe("Set a new height for the cell."),
      style: z
        .string()
        .optional()
        .describe(
          "Replace the cell's style string (semi-colon separated `key=value` pairs).",
        ),
    },
    default_tool(TOOL_edit_cell, context),
  );
};
