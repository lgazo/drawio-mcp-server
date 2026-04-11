import { z } from "zod";

import { default_tool } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_set_cell_data = "set-cell-data";

export const registerSetCellDataTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_set_cell_data,
    "Sets or updates a custom attribute on an existing cell.",
    {
      target_page: target_page_field(),
      cell_id: z
        .string()
        .describe(
          "Identifier (`id` attribute) of the cell to update with custom data.",
        ),
      key: z.string().describe("Name of the attribute to set on the cell."),
      value: z
        .union([z.string(), z.number(), z.boolean()])
        .describe(
          "Value to store for the attribute. Non-string values are stringified before storage.",
        ),
    },
    default_tool(TOOL_set_cell_data, context, { queue: true }),
  );
};
