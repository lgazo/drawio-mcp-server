import { remove_circular_dependencies } from "./drawio";
import { reply_name } from "./events";
import {
  bus_reply_stream,
  bus_request_stream,
  DrawioCellOptions,
  OnRequestFromServer,
  OnStandardToolRequestFromServer,
  SendReplyToServer,
} from "./types";

export const send_reply_to_server: SendReplyToServer = (reply: any) => {
  console.debug(`[bus] sending reply`, reply);
  window.dispatchEvent(new CustomEvent(bus_reply_stream, { detail: reply }));
};

export const on_request_from_server: OnRequestFromServer = (
  event_name,
  request_listener,
) => {
  console.debug(`[bus] registered ${event_name}`);
  const listener = (emitter_data: any) => {
    // console.debug(`[bus] received from server, expecting ${event_name}`, emitter_data);
    const event = emitter_data.detail;
    if (event.__event === event_name) {
      console.debug(
        `[bus] received from server, matched ${event_name}`,
        emitter_data,
      );
      request_listener(event);
    }
  };
  window.addEventListener(bus_request_stream, listener);
};

export const on_standard_tool_request_from_server: OnStandardToolRequestFromServer =
  (event_name, ui, accepted_option_keys, drawio_function) => {
    return on_request_from_server(event_name, (request: any) => {
      const option_entries = Object.entries(request).filter(([key, _value]) => {
        return accepted_option_keys.has(key);
      });

      const options = option_entries.reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as DrawioCellOptions);

      let reply;
      try {
        const result = drawio_function(ui, options);
        reply = {
          __event: reply_name(event_name, request.__request_id),
          __request_id: request.__request_id,
          success: true,
          result: remove_circular_dependencies(result),
        };
      } catch (e) {
        console.error(
          `[bus] failed executing standard tool ${event_name} with request ID = ${request.__request_id}. Returning success=false to the server.`,
          e,
        );
        reply = {
          __event: reply_name(event_name, request.__request_id),
          __request_id: request.__request_id,
          success: false,
          error: remove_circular_dependencies(e),
        };
      }
      send_reply_to_server(reply);
    });
  };
