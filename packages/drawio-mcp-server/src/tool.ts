import { Bus, Context } from "./types.js";
import {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { strip_internal_fields } from "./events.js";

export type Handler = (reply_payload: any) => CallToolResult;
export type ToolFn<S> = (
  args: S,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
) => Promise<CallToolResult>;

export function build_channel<S>(
  { bus, id_generator, log }: Context,
  event_name: string,
  handler: Handler,
) {
  const fn: ToolFn<S> = async (
    _args: S,
    _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    const request_id = id_generator.generate();
    // const event_name = `get-selected-cell`;
    const reply_name = `${event_name}.${request_id}`;
    bus.send_to_extension({
      __event: event_name,
      __request_id: request_id,
      ..._args,
    });
    log.debug(`[${event_name}] emitted, waiting for reply @${reply_name}`);

    const p: Promise<CallToolResult> = new Promise((resolve, _reject) => {
      log.debug(`[${event_name}] waiting for response @${reply_name}`);

      bus.on_reply_from_extension(reply_name, (reply: Record<string, any>) => {
        // bus.on(reply_name, (args) => {
        log.debug(`[${reply_name}] received response`, reply);
        const data = strip_internal_fields(reply);

        const response = handler(data);
        resolve(response);
      });
    });

    return p;
  };

  return fn;
}

export function default_tool(name: string, context: Context) {
  const fn = build_channel(context, name, (reply) => {
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

  return fn;
}
