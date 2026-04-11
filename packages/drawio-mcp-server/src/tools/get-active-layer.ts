import { z } from "zod";

import { default_tool } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_get_active_layer = "get-active-layer";

export const registerGetActiveLayerTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_get_active_layer,
    "Gets the currently active layer information for the target page.",
    {
      target_page: target_page_field(),
    },
    default_tool(TOOL_get_active_layer, context, { queue: true }),
  );
};
