/**
 * Centralized tool definitions — name, description, hasArgs, and input schema
 * for every MCP tool, in a single iterable list.
 *
 * tool_registrations.ts loops over TOOL_DEFINITIONS to call server.registerTool().
 */

import { z } from "zod";

// ─── Tool Definition Types ───────────────────────────────────

interface ToolDefinitionBase {
  /** UPPER_SNAKE_CASE key for the TOOL_NAMES lookup object */
  key: string;
  /** kebab-case name exposed to MCP clients */
  name: string;
  /** Human-readable description shown to MCP clients */
  description: string;
}

export interface ToolDefinitionWithArgs extends ToolDefinitionBase {
  hasArgs: true;
  inputSchema: { [key: string]: z.ZodTypeAny };
}

export interface ToolDefinitionWithoutArgs extends ToolDefinitionBase {
  hasArgs: false;
}

export type ToolDefinition = ToolDefinitionWithArgs | ToolDefinitionWithoutArgs;

// ─── Tool Definitions ────────────────────────────────────────

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [

  // ─── Cell Tools ──────────────────────────────────────────────

  {
    key: "DELETE_CELL_BY_ID",
    name: "delete-cell-by-id",
    description: "Delete a cell (vertex or edge) by its ID. When a vertex is deleted, all connected edges are automatically cascade-deleted and reported in the response.",
    hasArgs: true,
    inputSchema: {
      cell_id: z
        .string()
        .describe(
          "The ID of a cell to delete. The cell can be either vertex or edge. The ID is located in `id` attribute.",
        ),
    },
  },
  {
    key: "DELETE_EDGE",
    name: "delete-edge",
    description: "Delete an edge by its ID. Validates that the target cell is an edge. Use delete-cell-by-id to delete vertices (which also cascade-deletes connected edges).",
    hasArgs: true,
    inputSchema: {
      cell_id: z
        .string()
        .describe(
          "The ID of the edge to delete.",
        ),
    },
  },
  {
    key: "EDIT_EDGE",
    name: "edit-edge",
    description: "Update an edge's properties (text, source, target, style). Only specified fields change.",
    hasArgs: true,
    inputSchema: {
      cell_id: z
        .string()
        .describe(
          "Identifier (`id` attribute) of the edge cell to update. The ID must reference an edge.",
        ),
      text: z.string().optional().describe("Replace the edge's label text."),
      source_id: z
        .string()
        .optional()
        .describe("Reassign the edge's source terminal to a different cell ID."),
      target_id: z
        .string()
        .optional()
        .describe("Reassign the edge's target terminal to a different cell ID."),
      style: z
        .string()
        .optional()
        .describe(
          "Replace the edge's style string (semi-colon separated `key=value` pairs).",
        ),
    },
  },

  // ─── Add / Edit Cells ─────────────────────────────────────────

  {
    key: "ADD_CELLS",
    name: "add-cells",
    description: "Add vertices and/or edges to the diagram. Always pass ALL cells you need in a single call — never call this tool repeatedly. Use temp_id to reference cells within the same batch (e.g., an edge referencing a vertex created in the same call). For shape-library cells (Azure icons, basic shapes), use add-cells-of-shape instead.",
    hasArgs: true,
    inputSchema: {
      cells: z.array(z.object({
        type: z.enum(["vertex", "edge"]).describe("Cell type: 'vertex' for shapes, 'edge' for connections"),
        x: z.number().optional().describe("X position (vertices only)"),
        y: z.number().optional().describe("Y position (vertices only)"),
        width: z.number().optional().describe("Width (vertices only)"),
        height: z.number().optional().describe("Height (vertices only)"),
        text: z.string().optional().describe("Text label"),
        style: z.string().optional().describe("Draw.io style string"),
        source_id: z.string().optional().describe("Source cell ID for edges (can use temp_id from same batch)"),
        target_id: z.string().optional().describe("Target cell ID for edges (can use temp_id from same batch)"),
        temp_id: z.string().optional().describe("Temporary ID to reference this cell within the batch"),
      })).describe("Array of cells to create. Gather ALL cells you need and submit them in ONE call. Example: [{type:'vertex', x:100, y:100, temp_id:'node1'}, {type:'edge', source_id:'node1', target_id:'node2'}]"),
      dry_run: z.boolean().optional().describe("If true, validates the batch without persisting changes. Use to check for errors before committing."),
    },
  },
  {
    key: "EDIT_CELLS",
    name: "edit-cells",
    description: "Edit one or more vertex cells. Always pass ALL updates in a single call — never call this tool repeatedly. Only updates specified properties on each cell.",
    hasArgs: true,
    inputSchema: {
      cells: z.array(z.object({
        cell_id: z.string().describe("ID of the cell to update"),
        text: z.string().optional().describe("New text label"),
        x: z.number().optional().describe("New X position"),
        y: z.number().optional().describe("New Y position"),
        width: z.number().optional().describe("New width"),
        height: z.number().optional().describe("New height"),
        style: z.string().optional().describe("New style string"),
      })).describe("Array of cell updates. Example: [{cell_id: 'cell-1', x: 200, y: 150}, {cell_id: 'cell-2', text: 'Updated'}]"),
    },
  },

  // ─── Shape Tools ───────────────────────────────────────────────

  {
    key: "GET_SHAPE_CATEGORIES",
    name: "get-shape-categories",
    description: "Get available shape categories (General, Flowchart, Azure icons). For discovering specific shapes, prefer search-shapes.",
    hasArgs: false,
  },
  {
    key: "GET_SHAPES_IN_CATEGORY",
    name: "get-shapes-in-category",
    description: "List all shapes in a category. Returns shape names and styles for use with add-cells-of-shape.",
    hasArgs: true,
    inputSchema: {
      category_id: z
        .string()
        .describe(
          "Identifier (ID / key) of the category from which all the shapes should be retrieved.",
        ),
    },
  },
  {
    key: "GET_SHAPE_BY_NAME",
    name: "get-shape-by-name",
    description: "Get a shape by exact name from any library (basic shapes or Azure icons). For discovery or fuzzy matching, use search-shapes instead.",
    hasArgs: true,
    inputSchema: {
      shape_name: z
        .string()
        .describe(
          "Name of the shape to retrieve from the shape library of the current diagram.",
        ),
    },
  },
  {
    key: "ADD_CELLS_OF_SHAPE",
    name: "add-cells-of-shape",
    description: "Add one or more shape-based cells (Azure icons, basic shapes) to the diagram. Always pass ALL shapes in a single call — never call this tool repeatedly. Use search-shapes first to discover shape names.",
    hasArgs: true,
    inputSchema: {
      cells: z.array(z.object({
        shape_name: z.string().describe("Name of the shape from the library (e.g., Azure icon name or basic shape like 'rectangle')"),
        x: z.number().optional().describe("X-axis position of the vertex cell"),
        y: z.number().optional().describe("Y-axis position of the vertex cell"),
        width: z.number().optional().describe("Width (defaults to shape's native width)"),
        height: z.number().optional().describe("Height (defaults to shape's native height)"),
        text: z.string().optional().describe("Text label (defaults to shape title)"),
        style: z.string().optional().describe("Override the shape's default style"),
        temp_id: z.string().optional().describe("Temporary ID for referencing this cell later"),
      })).describe("Array of shape cells to create. Gather ALL shapes and submit ONE call."),
    },
  },
  {
    key: "SET_CELL_SHAPE",
    name: "set-cell-shape",
    description: "Update one or more cells' visual styles to match library shapes. Always pass ALL updates in a single call. Use search-shapes to find shape names first.",
    hasArgs: true,
    inputSchema: {
      cells: z
        .array(
          z.object({
            cell_id: z.string().describe("Cell ID to update"),
            shape_name: z.string().describe("Shape name to apply"),
          }),
        )
        .describe(
          "Array of cell-shape pairs. Example: [{cell_id: 'cell-1', shape_name: 'App Services'}, {cell_id: 'cell-2', shape_name: 'SQL Database'}]",
        ),
    },
  },
  {
    key: "SEARCH_SHAPES",
    name: "search-shapes",
    description: "Search for any shape — basic shapes (rectangle, circle, diamond, start, end, process, cylinder, etc.) and 700+ Azure icons. This is the primary way to discover shapes for use with add-cells-of-shape. Call this tool exactly ONCE with ALL shape names in the queries array — never call it multiple times.",
    hasArgs: true,
    inputSchema: {
      queries: z.array(z.string()).describe("Array of ALL search terms. Gather every shape name you need and pass them all here. Example: ['rectangle', 'diamond', 'front door', 'container apps', 'app service', 'key vault', 'cylinder', 'start', 'end']"),
      limit: z.number().min(1).max(50).optional().default(10).describe("Maximum results to return per query (1-50)"),
    },
  },
  {
    key: "GET_STYLE_PRESETS",
    name: "get-style-presets",
    description: "Get style presets (Azure colors, flowchart shapes, edges) for consistent styling.",
    hasArgs: false,
  },

  // ─── Model / Query Tools ───────────────────────────────────────

  {
    key: "LIST_PAGED_MODEL",
    name: "list-paged-model",
    description: "Get a paginated list of cells on the active page. Returns active page and layer context alongside results. Use this to inspect diagram structure or find cells by type.",
    hasArgs: true,
    inputSchema: {
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
            .enum(["edge", "vertex"])
            .optional()
            .describe(
              "Filter by cell type: 'edge' for connection lines, 'vertex' for vertices/shapes",
            ),
        })
        .optional()
        .describe("Optional filter criteria to apply to cells before pagination")
        .default({}),
    },
  },
  {
    key: "GET_DIAGRAM_STATS",
    name: "get-diagram-stats",
    description: "Get comprehensive statistics about the current diagram including cell counts, bounds, layer distribution, and more. Useful for understanding diagram state before making changes.",
    hasArgs: false,
  },

  // ─── Layer Tools ───────────────────────────────────────────────

  {
    key: "LIST_LAYERS",
    name: "list-layers",
    description: "List all layers on the active page with IDs, names, and which layer is currently active.",
    hasArgs: false,
  },
  {
    key: "GET_ACTIVE_LAYER",
    name: "get-active-layer",
    description: "Get the currently active layer.",
    hasArgs: false,
  },
  {
    key: "SET_ACTIVE_LAYER",
    name: "set-active-layer",
    description: "Set the active layer for new elements.",
    hasArgs: true,
    inputSchema: {
      layer_id: z.string().describe("ID of the layer to set as active"),
    },
  },
  {
    key: "CREATE_LAYER",
    name: "create-layer",
    description: "Create a new layer on the active page. Layers organize cells into separate visual planes that can be shown or hidden.",
    hasArgs: true,
    inputSchema: {
      name: z.string().describe("Name for the new layer"),
    },
  },
  {
    key: "MOVE_CELL_TO_LAYER",
    name: "move-cell-to-layer",
    description: "Move a cell to a different layer. Updates the cell's parent reference and returns the updated cell.",
    hasArgs: true,
    inputSchema: {
      cell_id: z.string().describe("ID of the cell to move"),
      target_layer_id: z
        .string()
        .describe("ID of the target layer where the cell will be moved"),
    },
  },

  // ─── Page Tools ────────────────────────────────────────────────

  {
    key: "CREATE_PAGE",
    name: "create-page",
    description: "Create a new page (tab) in the diagram. Each page has its own cells, layers, and canvas. Does not switch the active page.",
    hasArgs: true,
    inputSchema: {
      name: z.string().describe("Name for the new page"),
    },
  },
  {
    key: "LIST_PAGES",
    name: "list-pages",
    description: "List all pages in the diagram with IDs and names.",
    hasArgs: false,
  },
  {
    key: "GET_ACTIVE_PAGE",
    name: "get-active-page",
    description: "Get the currently active page.",
    hasArgs: false,
  },
  {
    key: "SET_ACTIVE_PAGE",
    name: "set-active-page",
    description: "Switch to a different page. All subsequent cell and layer operations apply to the active page. Returns the page's cell and layer counts.",
    hasArgs: true,
    inputSchema: {
      page_id: z.string().describe("ID of the page to switch to"),
    },
  },
  {
    key: "RENAME_PAGE",
    name: "rename-page",
    description: "Rename an existing page.",
    hasArgs: true,
    inputSchema: {
      page_id: z.string().describe("ID of the page to rename"),
      name: z.string().describe("New name for the page"),
    },
  },
  {
    key: "DELETE_PAGE",
    name: "delete-page",
    description: "Delete a page and all its cells, layers, and groups. Cannot delete the last remaining page.",
    hasArgs: true,
    inputSchema: {
      page_id: z.string().describe("ID of the page to delete"),
    },
  },

  // ─── Group / Container Tools ───────────────────────────────────

  {
    key: "CREATE_GROUPS",
    name: "create-groups",
    description: "Create one or more group/container cells. Always pass ALL groups in a single call — never call this tool repeatedly. Each group gets a unique ID for use with add-cells-to-group. Children are positioned relative to the group.",
    hasArgs: true,
    inputSchema: {
      groups: z.array(z.object({
        x: z.number().optional().describe("X-axis position of the group").default(0),
        y: z.number().optional().describe("Y-axis position of the group").default(0),
        width: z.number().optional().describe("Width of the group container").default(400),
        height: z.number().optional().describe("Height of the group container").default(300),
        text: z.string().optional().describe("Label text for the group").default(""),
        style: z.string().optional().describe("Draw.io style string for the group container"),
        temp_id: z.string().optional().describe("Temporary ID for referencing this group later (e.g., in add-cells-to-group)"),
      })).describe("Array of groups to create. Example: [{text: 'VNet', width: 600, height: 400, temp_id: 'vnet'}, {text: 'Subnet', width: 300, height: 200, temp_id: 'subnet'}]"),
    },
  },
  {
    key: "ADD_CELLS_TO_GROUP",
    name: "add-cells-to-group",
    description: "Assign one or more cells to groups. Always pass ALL assignments in a single call — never call this tool repeatedly. Supports assigning cells to different groups in a single call.",
    hasArgs: true,
    inputSchema: {
      assignments: z.array(z.object({
        cell_id: z.string().describe("ID of the cell to add to a group"),
        group_id: z.string().describe("ID of the group/container cell"),
      })).describe("Array of cell-to-group assignments. Example: [{cell_id: 'cell-5', group_id: 'cell-2'}, {cell_id: 'cell-6', group_id: 'cell-3'}]"),
    },
  },
  {
    key: "REMOVE_CELL_FROM_GROUP",
    name: "remove-cell-from-group",
    description: "Remove a cell from its group, returning it to the active layer.",
    hasArgs: true,
    inputSchema: {
      cell_id: z.string().describe("ID of the cell to remove from its group"),
    },
  },
  {
    key: "LIST_GROUP_CHILDREN",
    name: "list-group-children",
    description: "List all cells that are children of a group/container.",
    hasArgs: true,
    inputSchema: {
      group_id: z.string().describe("ID of the group/container cell"),
    },
  },

  // ─── Import / Export Tools ─────────────────────────────────────

  {
    key: "IMPORT_DIAGRAM",
    name: "import-diagram",
    description: "Import a Draw.io XML string, replacing the current diagram. Supports single-page and multi-page documents. Use this to load and modify existing .drawio files.",
    hasArgs: true,
    inputSchema: {
      xml: z.string().describe("The Draw.io XML string to import"),
    },
  },
  {
    key: "EXPORT_DIAGRAM",
    name: "export-diagram",
    description: "Export the diagram as Draw.io XML with diagram statistics. The XML is in the response payload's `xml` property. Save the output to a .drawio file. When `compress` is true, the mxGraphModel content inside each <diagram> element is deflate-compressed and base64-encoded (the format used by the Draw.io desktop app), typically achieving 60-80% size reduction. Compressed output is fully compatible with Draw.io and can be re-imported.",
    hasArgs: true,
    inputSchema: {
      compress: z.boolean().optional().default(false).describe("When true, deflate-compress and base64-encode the diagram content inside each <diagram> element (Draw.io native format). Reduces output size by 60-80%. Defaults to false (plain XML)."),
    },
  },
  {
    key: "CLEAR_DIAGRAM",
    name: "clear-diagram",
    description: "Clear all cells, layers, and pages, resetting the diagram to a single empty page.",
    hasArgs: false,
  },
];

// ─── Derived Constants ───────────────────────────────────────

/** Tool name constants derived from TOOL_DEFINITIONS (UPPER_SNAKE_CASE key → kebab-case value) */
export const TOOL_NAMES: { readonly [key: string]: string } = Object.freeze(
  Object.fromEntries(TOOL_DEFINITIONS.map(t => [t.key, t.name])),
);
