import { z } from "zod";

import { default_tool } from "../tool.js";
import { Attributes } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_list_paged_model = "list-paged-model";

export const registerListPagedModelTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_list_paged_model,
    "Retrieves a paginated view of all cells (vertices and edges) in the current Draw.io diagram. This tool provides access to the complete model data with essential fields only, sanitized to remove circular dependencies and excessive data. It allows to filter based on multiple criteria and attribute boolean logic. Useful for programmatic inspection of diagram structure without overwhelming response sizes.",
    {
      page: z
        .number()
        .optional()
        .describe(
          "Zero-based page number for pagination. Page 0 returns the first batch of cells, page 1 returns the next batch, etc. Default is 0.",
        )
        .default(0),
      page_size: z
        .number()
        .optional()
        .describe(
          "Maximum number of cells to return in a single page. Controls response size and performance. Must be between 1 and 1000. Default is 50.",
        )
        .default(50),
      filter: z
        .object({
          cell_type: z
            .enum(["edge", "vertex", "object", "layer", "group"])
            .optional()
            .describe(
              "Filter by cell type: 'edge' for connection lines, 'vertex' for vertices/shapes, 'object' for any cell type, 'layer' for layer cells, 'group' for grouped cells",
            ),
          parent_ids: z
            .array(z.string())
            .optional()
            .describe(
              "Filter cells to only those whose parent is one of the specified parent IDs.",
            ),
          layer_ids: z
            .array(z.string())
            .optional()
            .describe(
              "Filter cells to only those whose parent is one of the specified layer IDs. Alias for parent_ids.",
            ),
          ids: z
            .array(z.string())
            .optional()
            .describe(
              "Filter cells to only those whose ID is one of the specified IDs.",
            ),
          attributes: Attributes.optional().describe(
            'Boolean logic array expressions for filtering cell attributes. Format: ["and" | "or", ...expressions] or ["equal", key, value]. Matches against cell attributes and parsed style properties.',
          ),
        })
        .optional()
        .describe(
          "Optional filter criteria to apply to cells before pagination",
        )
        .default({}),
    },
    default_tool(TOOL_list_paged_model, context),
  );
};
