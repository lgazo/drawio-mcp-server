import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "./mcp_console_logger.ts";
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

export function create_logger(server: McpServer): Logger {
  // Per-logger log levels scoped to this logger instance
  const logLevels: { [loggerName: string]: LogLevelValue } = {
    ".": LogLevelMap.info,
  };

  const getEffectiveLogLevel = (loggerName: string): LogLevelValue => {
    return loggerName in logLevels
      ? logLevels[loggerName]
      : logLevels["."];
  };

  const shouldLog = (level: McpLogLevel, loggerName: string): boolean => {
    const numericLevel = LogLevelMap[level];
    const effectiveLevel = getEffectiveLogLevel(loggerName);
    return numericLevel <= effectiveLevel;
  };

  const sendLog = (level: McpLogLevel, loggerName: string, data: object) => {
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
  server.server.setRequestHandler(SetLevelsRequestSchema, async (request) => {
    const newLevels = request.params.levels;
    for (const loggerName in newLevels) {
      if (Object.prototype.hasOwnProperty.call(newLevels, loggerName)) {
        const levelName = newLevels[loggerName];
        if (levelName === null) {
          if (loggerName !== ".") {
            delete logLevels[loggerName];
            sendLog("debug", "logging", {
              message: `Reset log level for logger: ${loggerName}`,
            });
          }
        } else if (
          levelName &&
          validLogLevels.includes(levelName as McpLogLevel)
        ) {
          logLevels[loggerName] = LogLevelMap[levelName as McpLogLevel];
          sendLog("debug", "logging", {
            message: `Set log level for logger '${loggerName}' to '${levelName}'`,
          });
        } else {
          sendLog("warning", "logging", {
            message: `Invalid log level '${levelName}' received for logger '${loggerName}'`,
          });
        }
      }
    }
    return {};
  });

  server.server.setRequestHandler(SetLevelRequestSchema, async (request) => {
    const levelName = request.params.level;
    if (validLogLevels.includes(levelName as McpLogLevel)) {
      logLevels["."] = LogLevelMap[levelName as McpLogLevel];
      sendLog("debug", "logging", {
        message: `Set root log level to '${levelName}'`,
      });
    } else {
      sendLog("warning", "logging", {
        message: `Invalid log level '${levelName}' received`,
      });
    }
    return {};
  });

  return {
    log: (level, message, ...data) => {
      sendLog(level as McpLogLevel, ".", { message, data });
    },
    debug: (message, ...data) => {
      sendLog("debug" as McpLogLevel, ".", { message, data });
    },
  };
}
