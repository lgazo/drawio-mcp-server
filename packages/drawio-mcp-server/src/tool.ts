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
export type ToolExecutionOptions = {
  queue?: boolean;
  reply_timeout_ms?: number;
};

const DEFAULT_REPLY_TIMEOUT_MS = (() => {
  const raw = process.env.DRAWIO_MCP_REPLY_TIMEOUT_MS;
  const parsed = Number(raw);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return 60_000;
})();

export function build_channel<S>(
  { bus, id_generator, request_queue, log }: Context,
  event_name: string,
  handler: Handler,
  options: ToolExecutionOptions = {},
) {
  const invoke = async (
    _args: S,
    _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    const reply_timeout_ms =
      options.reply_timeout_ms && options.reply_timeout_ms > 0
        ? options.reply_timeout_ms
        : DEFAULT_REPLY_TIMEOUT_MS;
    const request_id = id_generator.generate();
    // const event_name = `get-selected-cell`;
    const reply_name = `${event_name}.${request_id}`;
    bus.send_to_extension({
      __event: event_name,
      __request_id: request_id,
      ..._args,
    });
    log.debug(`[${event_name}] emitted, waiting for reply @${reply_name}`);

    const p: Promise<CallToolResult> = new Promise((resolve, reject) => {
      log.debug(`[${event_name}] waiting for response @${reply_name}`);

      let settled = false;
      let timeout_handle: ReturnType<typeof setTimeout> | undefined;
      let cleanup: (() => void) | undefined;

      const finish = (finalize: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        if (timeout_handle) {
          clearTimeout(timeout_handle);
        }
        cleanup?.();
        finalize();
      };

      timeout_handle = setTimeout(() => {
        finish(() => {
          const error = new Error(
            `Timed out waiting for reply to \`${event_name}\` after ${reply_timeout_ms}ms`,
          );
          log.log("warn", `[${reply_name}] ${error.message}`);
          reject(error);
        });
      }, reply_timeout_ms);

      cleanup = bus.on_reply_from_extension(reply_name, (reply: Record<string, any>) => {
        // bus.on(reply_name, (args) => {
        finish(() => {
          log.debug(`[${reply_name}] received response`, reply);
          const data = strip_internal_fields(reply);

          try {
            const response = handler(data);
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
      });

      if (settled) {
        cleanup?.();
      }
    });

    return p;
  };

  const fn: ToolFn<S> = async (
    _args: S,
    _extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => {
    if (options.queue) {
      return request_queue.enqueue(() => invoke(_args, _extra));
    }

    return invoke(_args, _extra);
  };

  return fn;
}

export function default_tool(
  name: string,
  context: Context,
  options: ToolExecutionOptions = {},
) {
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
  }, options);

  return fn;
}

export function export_tool_handler(
  name: string,
  context: Context,
  options: ToolExecutionOptions = {},
) {
  const fn = build_channel(context, name, (reply) => {
    const { success, result, error } = reply;

    if (!success) {
      return {
        content: [
          {
            type: "text",
            text: `Export failed: ${error || "Unknown error"}`,
          },
        ],
      };
    }

    const { format, mimeType, data, width, height, warning } = result;

    const content: any[] = [];

    if (warning) {
      content.push({
        type: "text",
        text: `Warning: ${warning}`,
      });
    }

    if (format === "png") {
      content.push({
        type: "image",
        mimeType: "image/png",
        data: data,
      });
    } else {
      content.push({
        type: "text",
        text: data,
      });
    }

    const dimensions = width && height ? `, ${width}x${height}` : "";
    content.push({
      type: "text",
      text: `Exported ${format} (${mimeType})${dimensions}`,
    });

    const response: CallToolResult = {
      content,
    };
    return response;
  }, options);

  return fn;
}
