import { Logger } from "./types.js";

export function create_logger(): Logger {
  return {
    log: (level, message, data) => {
      return console.log(message, data);
    },
    debug: (message, data) => {
      return console.debug(message, data);
    },
  };
}
