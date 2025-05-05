import EventEmitter from "node:events";
import {
  Bus,
  bus_reply_stream,
  bus_request_stream,
  BusListener,
  Logger,
} from "./types.js";

type BusListenerList = BusListener<any>[];

export function create_bus(log: Logger) {
  return function (emitter: EventEmitter): Bus {
    const listeners: BusListenerList = [];
    const bus: Bus = {
      send_to_extension: (request) => {
        log.debug(`[bus] sending to Extension via ${bus_request_stream}`, request);
        
        // Check if there are any listeners on the emitter
        const listenerCount = emitter.listenerCount(bus_request_stream);
        log.debug(`[bus] Number of listeners on ${bus_request_stream}: ${listenerCount}`);
        
        // Emit the event
        emitter.emit(bus_request_stream, request);
        log.debug(`[bus] Event emitted to ${bus_request_stream}`);
      },
      on_reply_from_extension: (event_name, reply) => {
        log.debug(`[bus] Setting up listener for event: ${event_name} on stream ${bus_reply_stream}`);
        
        const listener = (emitter_data: any) => {
          log.debug(`[bus] received data from Extension on ${bus_reply_stream}`, emitter_data);
          
          if (emitter_data && emitter_data.__event) {
            log.debug(`[bus] Event name in data: ${emitter_data.__event}, expecting: ${event_name}`);
            
            if (emitter_data.__event === event_name) {
              log.debug(`[bus] ✅ Event name match! Calling reply handler for ${event_name}`);
              reply(emitter_data);
            } else {
              log.debug(`[bus] ❌ Event name mismatch. Ignoring this message.`);
            }
          } else {
            log.debug(`[bus] ⚠️ Received data has no __event field`);
          }
        };
        
        emitter.on(bus_reply_stream, listener);
        listeners.push(reply);
        
        // Log number of listeners
        const listenerCount = emitter.listenerCount(bus_reply_stream);
        log.debug(`[bus] Now have ${listenerCount} listeners on ${bus_reply_stream}`);
      },
    };
    return bus;
  };
}
