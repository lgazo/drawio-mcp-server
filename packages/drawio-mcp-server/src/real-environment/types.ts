import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Browser, Page } from "@playwright/test";

import type { createDrawioMcpApp } from "../index.js";
import type { MemoryLogger } from "./logger.js";

export type LogEntry = {
  level: string;
  message: string;
  data: unknown[];
};

export type CellSnapshot = {
  id: string;
  value: string;
  style: string;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  parentId: string | null;
};

export type RealEnvironmentApp = ReturnType<typeof createDrawioMcpApp>;

export interface RealEnvironmentContext {
  browser: Browser;
  page: Page;
  client: Client;
  app: RealEnvironmentApp;
  logger: MemoryLogger;
  browserMessages: { type: string; text: string }[];
  artifactRunDir: string;
  httpPort: number;
  wsPort: number;
}
