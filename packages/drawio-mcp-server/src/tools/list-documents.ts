import { ToolRegistrar } from "./types.js";

export const TOOL_list_documents = "list-documents";

export const registerListDocumentsTool: ToolRegistrar = (server, context) => {
  server.tool(
    TOOL_list_documents,
    "Lists all connected Draw.io document instances with their stable instance IDs and basic metadata.",
    {},
    async () => {
      const documents = await context.document_routing.list_documents();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              result: documents,
            }),
          },
        ],
      };
    },
  );
};
