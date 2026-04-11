import { writeFileSync, existsSync } from "node:fs";

import { z } from "zod";

import { export_tool_handler } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

export const TOOL_export_diagram = "export-diagram";

export const registerExportDiagramTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_export_diagram,
    "Export the target page or current diagram as SVG, PNG, or XML. Returns the diagram data as base64 (PNG) or text (SVG/XML). Optionally saves to a file.",
    {
      target_page: target_page_field(),
      format: z
        .enum(["svg", "png", "xml"])
        .describe(
          "Export format: svg for vector graphics, png for raster image, xml for raw diagram data",
        ),
      scale: z
        .number()
        .optional()
        .default(1)
        .describe("Zoom factor for the export (1 = 100%)"),
      border: z
        .number()
        .optional()
        .default(0)
        .describe("Border width in pixels around the diagram"),
      background: z
        .string()
        .optional()
        .default("#ffffff")
        .describe("Background color in hex format (e.g., #ffffff)"),
      shadow: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include shadow effects in the export"),
      crop: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "Crop the export to diagram bounds (true) or full page (false)",
        ),
      selection_only: z
        .boolean()
        .optional()
        .default(false)
        .describe("Export only the currently selected cells"),
      transparent: z
        .boolean()
        .optional()
        .default(false)
        .describe("Use transparent background (overrides background color)"),
      dpi: z
        .number()
        .optional()
        .default(96)
        .describe("DPI for PNG export (affects quality)"),
      embed_xml: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Embed the diagram XML data in SVG/PNG so it can be reopened in draw.io",
        ),
      size: z
        .enum(["selection", "page", "diagram"])
        .optional()
        .default("diagram")
        .describe(
          "What to export: 'selection' for selected cells only, 'page' for current page, 'diagram' for entire model",
        ),
      output_path: z
        .string()
        .optional()
        .describe(
          "Absolute file path to save the exported file (must be an absolute path)",
        ),
    },
    async (args, _extra) => {
      const exportHandler = export_tool_handler(TOOL_export_diagram, context, {
        queue: true,
      });
      const result = await exportHandler(args, _extra);

      if (args.output_path) {
        const path = await import("node:path");
        if (!path.isAbsolute(args.output_path)) {
          throw new Error("output_path must be an absolute path");
        }
        const dir = path.dirname(args.output_path);
        if (!existsSync(dir)) {
          throw new Error(`Directory does not exist: ${dir}`);
        }

        const exportContent = result.content;
        if (args.format === "png") {
          const imageContent = exportContent.find(
            (c: any) => c.type === "image",
          ) as any;
          if (imageContent) {
            writeFileSync(
              args.output_path,
              Buffer.from(imageContent.data, "base64"),
            );
          }
        } else {
          const textContent = exportContent.find(
            (c: any) => c.type === "text",
          ) as any;
          if (textContent) {
            writeFileSync(args.output_path, textContent.text, "utf-8");
          }
        }

        result.content.push({
          type: "text" as const,
          text: `Saved to: ${args.output_path}`,
        });
      }

      return result;
    },
  );
};
