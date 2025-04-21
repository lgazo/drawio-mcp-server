import EventEmitter from "node:events";
import {
  Bus,
  bus_reply_stream,
  bus_request_stream,
  BusListener,
} from "./bus.js";

type BusListenerList = BusListener<any>[];

export function create_bus(emitter: EventEmitter): Bus {
  const listeners: BusListenerList = [];
  const bus: Bus = {
    send_to_extension: (request) => {
      console.error(`[bus] sending to Extension`, request);
      emitter.emit(bus_request_stream, request);
    },
    on_reply_from_extension: (event_name, reply) => {
      const listener = (emitter_data: any) => {
        console.error(`[bus] received from Extension`, emitter_data);
        if (emitter_data && emitter_data.__event === event_name) {
          reply(emitter_data);
        }
      };
      emitter.on(bus_reply_stream, listener);
      listeners.push(reply);
    },
  };
  return bus;
}
