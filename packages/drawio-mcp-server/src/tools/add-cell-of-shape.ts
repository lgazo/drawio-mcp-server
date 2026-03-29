import { z } from "zod";

import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_add_cell_of_shape = "add-cell-of-shape";

export const registerAddCellOfShapeTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_add_cell_of_shape,
    "This tool allows you to add new vertex cell (object) on the current page of a Draw.io diagram by its shape name. It accepts multiple optional input parameter.",
    {
      shape_name: z
        .string()
        .describe(
          "Name of the shape to retrieved from the shape library of the current diagram.",
        ),
      x: z
        .number()
        .optional()
        .describe("X-axis position of the vertex cell of the shape")
        .default(100),
      y: z
        .number()
        .optional()
        .describe("Y-axis position of the vertex cell of the shape")
        .default(100),
      width: z
        .number()
        .optional()
        .describe("Width of the vertex cell of the shape")
        .default(200),
      height: z
        .number()
        .optional()
        .describe("Height of the vertex cell of the shape")
        .default(100),
      text: z
        .string()
        .optional()
        .describe("Text content placed inside of the vertex cell of the shape"),
      style: z
        .string()
        .optional()
        .describe(
          "Semi-colon separated list of Draw.io visual styles, in the form of `key=value`. Example: `whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;`",
        ),
      parent_id: z
        .string()
        .optional()
        .describe(
          "ID of the parent cell. If provided, the new cell will be created as a child of this cell. If omitted, the cell is created at the diagram root level.",
        ),
    },
    default_tool(TOOL_add_cell_of_shape, context),
  );
};
