import { EventEmitter } from "node:events";
import { Bus, bus_reply_stream, bus_request_stream, Logger } from "./types.js";

export function create_bus(log: Logger) {
  return function (emitter: EventEmitter): Bus {
    const bus: Bus = {
      send_to_extension: (request) => {
        log.debug(`[bus] sending to Extension`, request);
        emitter.emit(bus_request_stream, request);
      },
      on_reply_from_extension: (event_name, reply) => {
        const listener = (emitter_data: any) => {
          log.debug(`[bus] received from Extension`, emitter_data);
          if (emitter_data && emitter_data.__event === event_name) {
            emitter.off(bus_reply_stream, listener);
            reply(emitter_data);
          }
        };
        emitter.on(bus_reply_stream, listener);
        return () => {
          emitter.off(bus_reply_stream, listener);
        };
      },
    };
    return bus;
  };
}
