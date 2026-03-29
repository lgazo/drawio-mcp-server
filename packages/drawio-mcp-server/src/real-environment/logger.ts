import type { AppLogger } from "../index.js";
import type { LogEntry } from "./types.js";

export class MemoryLogger implements AppLogger {
  readonly entries: LogEntry[] = [];

  log(level: string, message?: any, ...data: any[]) {
    this.entries.push({
      level,
      message: String(message ?? ""),
      data,
    });
  }

  debug(message?: any, ...data: any[]) {
    this.entries.push({
      level: "debug",
      message: String(message ?? ""),
      data,
    });
  }

  errors() {
    return this.entries.filter((entry) => {
      if (entry.level.toLowerCase() === "error") {
        return true;
      }

      return entry.data.some((value) => value instanceof Error);
    });
  }
}
