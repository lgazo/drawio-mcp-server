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

export const registerShowDiagramTool: ToolRegistrar = (server, context) => {
  registerAppTool(
    server,
    TOOL_show_diagram,
    {
      title: "Show Diagram",
      description:
        "Returns the current diagram XML. On MCP Apps-capable hosts the diagram is shown as an interactive draw.io editor inside the conversation, enabling live editing and collaboration; on other clients the raw XML text is returned. Requires a connected document; with several connected documents pass target_document.",
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
      const result = await handler(
        {
          ...args,
          format: "xml",
          size: "diagram",
          crop: true,
          transparent: false,
        },
        extra,
      );
      // The export handler appends a trailing "Exported xml ..." status
      // line; drop it so hosts/apps receive the XML as the final content.
      result.content = result.content.filter(
        (item) => !(item.type === "text" && item.text.startsWith("Exported ")),
      );
      return result;
    },
  );
};
