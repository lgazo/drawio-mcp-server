import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_list_layers = "list-layers";

export const registerListLayersTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_list_layers,
    "Lists all available layers in the diagram with their IDs and names.",
    {},
    default_tool(TOOL_list_layers, context),
  );
};
