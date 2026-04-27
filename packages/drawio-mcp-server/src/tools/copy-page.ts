import { z } from "zod";

import { default_tool } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_copy_page = "copy-page";

export const registerCopyPageTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_copy_page,
    "Creates a copy of an existing page in the target/current Draw.io document, appends the copy to the end of the page list, and returns the copied page metadata. When possible, the previously visible page is restored after the copy is created.",
    {
      page: target_page_field().describe(
        "Source page selector for the page to copy. Provide exactly one of `{ index }` or `{ id }`.",
      ),
      name: z
        .string()
        .optional()
        .describe("Optional name for the copied page."),
    },
    default_tool(TOOL_copy_page, context, { queue: true }),
  );
};
