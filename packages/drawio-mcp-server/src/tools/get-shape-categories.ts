import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_get_shape_categories = "get-shape-categories";

export const registerGetShapeCategoriesTool: ToolRegistrar = (
  server,
  context,
) => {
  server.tool(
    TOOL_get_shape_categories,
    "Retrieves available shape categories from the diagram's library. Library is split into multiple categories.",
    {},
    default_tool(TOOL_get_shape_categories, context),
  );
};
