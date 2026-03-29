import { z } from "zod";

import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_get_shape_by_name = "get-shape-by-name";

export const registerGetShapeByNameTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_get_shape_by_name,
    "Retrieve a specific shape by its name from all available shapes in the diagram's library. It returns the shape and also the category it belongs.",
    {
      shape_name: z
        .string()
        .describe(
          "Name of the shape to retrieve from the shape library of the current diagram.",
        ),
    },
    default_tool(TOOL_get_shape_by_name, context),
  );
};
