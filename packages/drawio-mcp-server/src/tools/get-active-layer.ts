import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_get_active_layer = "get-active-layer";

export const registerGetActiveLayerTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_get_active_layer,
    "Gets the currently active layer information.",
    {},
    default_tool(TOOL_get_active_layer, context),
  );
};
