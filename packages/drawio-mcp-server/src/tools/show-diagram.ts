import { z } from "zod";

import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";

import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";

import { export_tool_handler } from "../tool.js";
import { target_page_field } from "./shared.js";
import { ToolRegistrar } from "./types.js";

type ShowDiagramArgs = {
  target_page?: { index?: number; id?: string };
  target_document?: { id: string };
};

export const TOOL_show_diagram = "show-diagram";
export const SHOW_DIAGRAM_RESOURCE_URI = "ui://drawio/editor.html";

// Cold start: with no connected Draw.io document (and no explicit
// target_document) the export handler's document routing throws; hosts
// then open this blank diagram so the user can start drawing.
export const BLANK_DIAGRAM_XML = `<mxfile><diagram id="blank" name="Page-1"><mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0"><root><mxCell id="0" /><mxCell id="1" parent="0" /></root></mxGraphModel></diagram></mxfile>`;

export const registerShowDiagramTool: ToolRegistrar = (server, context) => {
  registerAppTool(
    server,
    TOOL_show_diagram,
    {
      title: "Show Diagram",
      description:
        "Returns the current diagram XML. On MCP Apps-capable hosts the diagram is shown as an interactive draw.io editor inside the conversation, enabling live editing and collaboration; on other clients the raw XML text is returned. Works without a connected document: if no Draw.io documents are open (and no target_document is passed), a blank diagram is returned so the editor opens an empty canvas to start drawing from; with several connected documents pass target_document.",
      inputSchema: z.object({
        target_page: target_page_field(),
      }),
      _meta: { ui: { resourceUri: SHOW_DIAGRAM_RESOURCE_URI } },
    },
    async (
      args: ShowDiagramArgs,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const handler = export_tool_handler("export-diagram", context, {
        queue: true,
      });
      let result;
      try {
        result = await handler(
          {
            ...args,
            format: "xml",
            size: "diagram",
            crop: true,
            transparent: false,
          },
          extra,
        );
      } catch (error) {
        // Cold start: only mask the auto-target "no documents" routing
        // error when the caller did not pass an explicit target_document;
        // unknown-document or multi-document routing errors still surface.
        const message = error instanceof Error ? error.message : String(error);
        if (
          !args.target_document &&
          message.includes("No connected Draw.io documents")
        ) {
          return {
            content: [{ type: "text" as const, text: BLANK_DIAGRAM_XML }],
          };
        }
        throw error;
      }
      // The export handler appends a trailing "Exported xml ..." status
      // line; drop it so hosts/apps receive the XML as the final content.
      result.content = result.content.filter(
        (item) => !(item.type === "text" && item.text.startsWith("Exported ")),
      );
      return result;
    },
  );
};
