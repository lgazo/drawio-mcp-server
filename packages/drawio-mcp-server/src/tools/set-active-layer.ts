import { z } from "zod";

import { default_tool } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_set_active_layer = "set-active-layer";

export const registerSetActiveLayerTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_set_active_layer,
    "Sets the active layer for creating new elements. All subsequent element creation will happen in this layer.",
    {
      target_page: target_page_field(),
      layer_id: z.string().describe("ID of the layer to set as active"),
    },
    default_tool(TOOL_set_active_layer, context, { queue: true }),
  );
};
