import { Logger } from "./types.js";

export function create_logger(): Logger {
  return {
    log: (level, message, ...data) => {
      return data.length > 0
        ? console.error(`${level?.toUpperCase()}: ${message}`, ...data)
        : console.error(`${level?.toUpperCase()}: ${message}`);
    },
    debug: (message, ...data) => {
      return data.length > 0
        ? console.error(`DEBUG: ${message}`, ...data)
        : console.error(`DEBUG: ${message}`);
    },
  };
}
