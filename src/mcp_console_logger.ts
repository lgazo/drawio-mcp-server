import { Logger } from "./types.js";

export function create_logger(): Logger {
  return {
    log: (level, message, data) => {
      return console.error(message, data);
    },
    debug: (message, data) => {
      return console.error(message, data);
    },
  };
}
