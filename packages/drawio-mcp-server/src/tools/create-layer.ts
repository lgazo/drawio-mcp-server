import { z } from "zod";

import { default_tool } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_create_layer = "create-layer";

export const registerCreateLayerTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_create_layer,
    "Creates a new layer on the target page.",
    {
      target_page: target_page_field(),
      name: z.string().describe("Name for the new layer"),
    },
    default_tool(TOOL_create_layer, context, { queue: true }),
  );
};
