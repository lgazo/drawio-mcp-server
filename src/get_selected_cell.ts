import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { Context } from "./bus.js";
import { build_channel, ToolFn } from "./tool.js";

export type Schema = {};
export const params: Schema = {};

let fn: ToolFn<Schema> | undefined = undefined;

export function tool({ bus }: Context) {
  if (!fn) {
    fn = build_channel(bus, "get-selected-cell", (reply) => {
      const response: CallToolResult = {
        content: [
          {
            type: "text",
            text: JSON.stringify(reply),
          },
        ],
      };
      return response;
    });
  }
  return fn;
}
