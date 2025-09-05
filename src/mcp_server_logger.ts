import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Logger } from "./types.js";
import { z } from "zod";

// Log levels (lower is more severe)
const LogLevelMap = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
} as const;

export const validLogLevels = Object.keys(
  LogLevelMap,
) as (keyof typeof LogLevelMap)[];

type McpLogLevel = keyof typeof LogLevelMap;
export type LogLevelValue = (typeof LogLevelMap)[McpLogLevel];

// Define the request schema for setLevels
const SetLevelsRequestSchema = z.object({
  method: z.literal("logging/setLevels"),
  params: z.object({
    levels: z.record(
      z.string(),
      z.enum(validLogLevels as [string, ...string[]]).nullable(),
    ),
  }),
});

// Define the request schema for setLevel
const SetLevelRequestSchema = z.object({
  method: z.literal("logging/setLevel"),
  params: z.object({
    level: z.enum(validLogLevels as [string, ...string[]]),
  }),
});

// Per-logger log levels (default is root `"."`)
let logLevels: { [loggerName: string]: LogLevelValue } = {
  ".": LogLevelMap.info, // Start with info level
};

// Helper: Effective log level for a logger
const getEffectiveLogLevel = (loggerName: string): LogLevelValue => {
  return loggerName in logLevels
    ? logLevels[loggerName]
    : (logLevels["."] ?? LogLevelMap.info);
};

// Helper: Should we log at this level?
const shouldLog = (level: McpLogLevel, loggerName: string): boolean => {
  const numericLevel = LogLevelMap[level];
  const effectiveLevel = getEffectiveLogLevel(loggerName);
  return numericLevel <= effectiveLevel;
};

// Helper: Actually send a log if allowed
const log =
  (server: McpServer) =>
  (level: McpLogLevel, loggerName: string, data: object) => {
    if (!(level in LogLevelMap)) {
      console.error(`Internal Error: Invalid log level used: ${level}`);
      return;
    }
    if (shouldLog(level, loggerName)) {
      server.server.sendLoggingMessage({
        level,
        logger: loggerName,
        data,
      });
    }
  };

export function create_logger(server: McpServer): Logger {
  const log3 = log(server);

  // 2. Register handler for logging/setLevels (only override requested loggers)
  server.server.setRequestHandler(SetLevelsRequestSchema, async (request) => {
    const newLevels = request.params.levels;
    // Only update logLevels for specified keys; unset any set to null
    for (const loggerName in newLevels) {
      if (Object.prototype.hasOwnProperty.call(newLevels, loggerName)) {
        const levelName = newLevels[loggerName];
        if (levelName === null) {
          if (loggerName !== ".") {
            delete logLevels[loggerName]; // Remove override
            log3("debug", "logging", {
              message: `Reset log level for logger: ${loggerName}`,
            });
          }
        } else if (
          levelName &&
          validLogLevels.includes(levelName as McpLogLevel)
        ) {
          logLevels[loggerName] = LogLevelMap[levelName as McpLogLevel];
          log3("debug", "logging", {
            message: `Set log level for logger '${loggerName}' to '${levelName}'`,
          });
        } else {
          log3("warning", "logging", {
            message: `Invalid log level '${levelName}' received for logger '${loggerName}'`,
          });
        }
      }
    }
    return {};
  });

  // Register handler for logging/setLevel (sets root logger level)
  server.server.setRequestHandler(SetLevelRequestSchema, async (request) => {
    const log3 = log(server);
    const levelName = request.params.level;
    if (validLogLevels.includes(levelName as McpLogLevel)) {
      logLevels["."] = LogLevelMap[levelName as McpLogLevel];
      log3("debug", "logging", {
        message: `Set root log level to '${levelName}'`,
      });
    } else {
      log3("warning", "logging", {
        message: `Invalid log level '${levelName}' received`,
      });
    }
    return {};
  });

  return {
    log: (level, message, ...data) => {
      log3(level as McpLogLevel, ".", { message, data });
    },
    debug: (message, ...data) => {
      log3("debug" as McpLogLevel, ".", { message, data });
    },
  };
}
