import { z } from "zod";

import { default_tool } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_import_mermaid = "import-mermaid";

export const registerImportMermaidTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_import_mermaid,
    "Insert a Mermaid diagram into the target Draw.io page. Conversion runs inside the Draw.io editor via its bundled Mermaid pipeline (EditorUi.parseMermaidDiagram). mode='native' converts supported Mermaid types into native mxGraph cells; unsupported types fall back to an embedded image cell. mode='embed' always emits a single image cell that preserves the Mermaid source for re-editing inside Draw.io. `target_page` is required for `replace` and `add`, and optional for `new-page`.",
    {
      target_page: target_page_field().optional(),
      mermaid_source: z
        .string()
        .min(1)
        .describe(
          "Raw Mermaid syntax. Examples: 'graph TD; A-->B;', 'sequenceDiagram\\nA->>B: hi'.",
        ),
      mode: z
        .enum(["native", "embed"])
        .optional()
        .default("native")
        .describe(
          "native = convert to native mxGraph cells when the diagram type is supported (best editability). embed = single image cell with mermaidData attribute for round-trip Mermaid editing in Draw.io.",
        ),
      insert_mode: z
        .enum(["replace", "add", "new-page"])
        .optional()
        .default("add")
        .describe(
          "How the resulting XML is merged into the diagram: replace, add, or new-page.",
        ),
    },
    async (args, extra) => {
      if (args.insert_mode !== "new-page" && !args.target_page) {
        throw new Error(
          "`target_page` is required when import-mermaid insert_mode is `replace` or `add`",
        );
      }

      const handler = default_tool(TOOL_import_mermaid, context, {
        queue: true,
      });
      return handler(args, extra);
    },
  );
};
