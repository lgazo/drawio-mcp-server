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
    
    // Log before sending
    log.debug(`[${event_name}] Preparing to send request with ID ${request_id}`);
    
    const requestData = {
      __event: event_name,
      __request_id: request_id,
      ..._args,
    };
    
    log.debug(`[${event_name}] Request data: ${JSON.stringify(requestData)}`);
    
    // Send the request
    bus.send_to_extension(requestData);
    
    log.debug(`[${event_name}] Request sent, emitted, waiting for reply @${reply_name}`);

    // Add 3 second timeout
    const TIMEOUT_MS = 3000;

    try {
      return await new Promise<CallToolResult>((resolve, reject) => {
        log.debug(`[${event_name}] waiting for response @${reply_name}`);

        // Setup timeout timer
        const timeoutId = setTimeout(() => {
          log.debug(`[${event_name}] request timed out after ${TIMEOUT_MS}ms`);
          reject(new Error(`Request timed out after ${TIMEOUT_MS}ms`));
        }, TIMEOUT_MS);

        bus.on_reply_from_extension(reply_name, (reply: Record<string, any>) => {
          // Clear timeout timer when response received
          clearTimeout(timeoutId);
          
          log.debug(`[${reply_name}] received response`, reply);
          const data = strip_internal_fields(reply);

          const response = handler(data);
          resolve(response);
        });
      });
    } catch (error: any) {
      // Handle timeout or other errors
      log.debug(`[${event_name}] Error: ${error.message}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: error.message }),
          },
        ],
      };
    }
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
