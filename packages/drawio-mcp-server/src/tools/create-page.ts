import { z } from "zod";

import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_create_page = "create-page";

export const registerCreatePageTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_create_page,
    "Appends a new blank page to the current Draw.io document and switches the active page to it.",
    {
      name: z.string().describe("Name for the new page"),
    },
    default_tool(TOOL_create_page, context, { queue: true }),
  );
};
