import { z } from "zod";

import { default_tool } from "../tool.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_import_diagram = "import-diagram";

export const registerImportDiagramTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_import_diagram,
    "Import a diagram from XML, SVG with embedded XML, or PNG with embedded XML into the current Draw.io instance.",
    {
      data: z
        .string()
        .describe(
          "The diagram data: raw XML string, or base64-encoded SVG/PNG with embedded XML",
        ),
      format: z
        .enum(["xml", "svg", "png"])
        .describe(
          "Input format: xml for raw Draw.io XML, svg for SVG with embedded XML, png for PNG with embedded XML",
        ),
      mode: z
        .enum(["replace", "add", "new-page"])
        .optional()
        .default("replace")
        .describe(
          "Import mode: replace clears current diagram and loads new one, add merges imported cells into current diagram, new-page creates a new page with imported diagram",
        ),
      filename: z
        .string()
        .optional()
        .describe("Optional original filename for context"),
    },
    default_tool(TOOL_import_diagram, context),
  );
};
