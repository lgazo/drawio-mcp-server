import { z } from "zod";

import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_get_shapes_in_category = "get-shapes-in-category";

export const registerGetShapesInCategoryTool: ToolRegistrar = (
  server,
  context,
) => {
  server.tool(
    TOOL_get_shapes_in_category,
    "Retrieve all shapes in the provided category from the diagram's library. A shape primarily contains `style` based on which you can create new vertex cells.",
    {
      category_id: z
        .string()
        .describe(
          "Identifier (ID / key) of the category from which all the shapes should be retrieved.",
        ),
    },
    default_tool(TOOL_get_shapes_in_category, context),
  );
};
