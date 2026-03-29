import { z } from "zod";

import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_add_rectangle = "add-rectangle";

export const registerAddRectangleTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_add_rectangle,
    "This tool allows you to add new Rectangle vertex cell (object) on the current page of a Draw.io diagram. It accepts multiple optional input parameter.",
    {
      x: z
        .number()
        .optional()
        .describe("X-axis position of the Rectangle vertex cell")
        .default(100),
      y: z
        .number()
        .optional()
        .describe("Y-axis position of the Rectangle vertex cell")
        .default(100),
      width: z
        .number()
        .optional()
        .describe("Width of the Rectangle vertex cell")
        .default(200),
      height: z
        .number()
        .optional()
        .describe("Height of the Rectangle vertex cell")
        .default(100),
      text: z
        .string()
        .optional()
        .describe("Text content placed inside of the Rectangle vertex cell")
        .default("New Cell"),
      style: z
        .string()
        .optional()
        .describe(
          "Semi-colon separated list of Draw.io visual styles, in the form of `key=value`. Example: `whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;`",
        )
        .default(
          "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
        ),
      parent_id: z
        .string()
        .optional()
        .describe(
          "ID of the parent cell. If provided, the new rectangle will be created as a child of this cell. If omitted, the rectangle is created at the diagram root level.",
        ),
    },
    default_tool(TOOL_add_rectangle, context),
  );
};
