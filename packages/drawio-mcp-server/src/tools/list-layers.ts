import { z } from "zod";

import { default_tool } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_list_layers = "list-layers";

export const registerListLayersTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_list_layers,
    "Lists all available layers on the target page with their IDs and names.",
    {
      target_page: target_page_field(),
    },
    default_tool(TOOL_list_layers, context, { queue: true }),
  );
};
