import { z } from "zod";

import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_edit_edge = "edit-edge";

export const registerEditEdgeTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_edit_edge,
    "Update properties of an existing edge by its ID. Only provided fields are modified; unspecified properties remain unchanged. Supports setting waypoints for edge geometry control.",
    {
      cell_id: z
        .string()
        .describe(
          "Identifier (`id` attribute) of the edge cell to update. The ID must reference an edge.",
        ),
      text: z.string().optional().describe("Replace the edge's label text."),
      source_id: z
        .string()
        .optional()
        .describe(
          "Reassign the edge's source terminal to a different cell ID.",
        ),
      target_id: z
        .string()
        .optional()
        .describe(
          "Reassign the edge's target terminal to a different cell ID.",
        ),
      style: z
        .string()
        .optional()
        .describe(
          "Replace the edge's style string (semi-colon separated `key=value` pairs).",
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
          "Array of {x, y} waypoints to set as edge geometry control points. Replaces existing waypoints. Use an empty array to clear waypoints.",
        ),
    },
    default_tool(TOOL_edit_edge, context),
  );
};
