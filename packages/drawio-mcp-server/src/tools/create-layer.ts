import { z } from "zod";

import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_create_layer = "create-layer";

export const registerCreateLayerTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_create_layer,
    "Creates a new layer in the diagram.",
    {
      name: z.string().describe("Name for the new layer"),
    },
    default_tool(TOOL_create_layer, context),
  );
};
