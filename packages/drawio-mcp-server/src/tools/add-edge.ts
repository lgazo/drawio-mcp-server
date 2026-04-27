import { z } from "zod";

import { default_tool } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_add_edge = "add-edge";

export const registerAddEdgeTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_add_edge,
    "This tool creates an edge, sometimes called also a relation, between two vertexes (cells). When source and target are the same shape (self-connector), a loop edge style is automatically applied if no custom style is provided.",
    {
      target_page: target_page_field(),
      source_id: z
        .string()
        .describe("Source ID of a cell. It is represented by `id` attribute."),
      target_id: z
        .string()
        .describe("Target ID of a cell. It is represented by `id` attribute."),
      text: z
        .string()
        .optional()
        .describe("Text content placed over the edge cell"),
      style: z
        .string()
        .optional()
        .describe(
          "Semi-colon separated list of Draw.io visual styles, in the form of `key=value`. Example: `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;`",
        )
        .default(
          "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;",
        ),
      points: z
        .array(
          z.object({
            x: z.number().describe("X coordinate of the waypoint"),
            y: z.number().describe("Y coordinate of the waypoint"),
          }),
        )
        .optional()
        .describe(
          "Array of {x, y} waypoints to control edge routing. Useful for custom paths or self-connectors where straight lines are barely visible.",
        ),
      parent_id: z
        .string()
        .optional()
        .describe(
          "ID of the parent cell. If provided, the new edge will be created as a child of this cell. If omitted, the edge is created at the diagram root level.",
        ),
    },
    default_tool(TOOL_add_edge, context, { queue: true }),
  );
};
