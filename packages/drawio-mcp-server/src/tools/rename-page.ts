import { z } from "zod";

import { default_tool } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_rename_page = "rename-page";

export const registerRenamePageTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_rename_page,
    "Renames the selected page without changing the visible page.",
    {
      page: target_page_field().describe(
        "Page selector for the page to rename. Provide exactly one of `{ index }` or `{ id }`.",
      ),
      name: z.string().describe("New page name"),
    },
    default_tool(TOOL_rename_page, context, { queue: true }),
  );
};
