export type Logger = {
  log: (level: string, message?: any, ...data: any[]) => void;
  debug: (message?: any, ...data: any[]) => void;
};

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
