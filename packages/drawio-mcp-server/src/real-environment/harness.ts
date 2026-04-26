import { chromium, type ConsoleMessage, type Page } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { spawnCaddy, type CaddyHandle } from "drawio-mcp-dev-proxy";
import { createServer } from "node:net";

import { ensureAssets } from "../assets/index.js";
import { getHttpFeatureConfig, type ServerConfig } from "../config.js";
import { createDrawioMcpApp } from "../index.js";
import type {
  CellSnapshot,
  ProxyHandle,
  RealEnvironmentContext,
} from "./types.js";
import { MemoryLogger } from "./logger.js";
import { createArtifactRunDir } from "./screenshot.js";

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("could not resolve free port")));
      }
    });
  });
}

export async function createRealEnvironmentContext(): Promise<RealEnvironmentContext> {
  const logger = new MemoryLogger();
  const browserMessages: { type: string; text: string }[] = [];
  const artifactRunDir = await createArtifactRunDir();

  await ensureAssets({}, () => undefined);

  const app = createDrawioMcpApp({ log: logger });

  const wsServer = await app.startWebSocketServer(0);
  const wsPort = Number((wsServer.address() as { port: number }).port);

  const useHttps = process.env.HARNESS_HTTPS === "1";

  let caddy: CaddyHandle | null = null;
  let proxyPort: number | null = null;
  let webSocketUrl: string | undefined;
  let upstreamHttpPort: number;

  if (useHttps) {
    proxyPort = await getFreePort();
    const httpUpstream = await getFreePort();
    caddy = await spawnCaddy({
      proxyPort,
      httpUpstream,
      wsUpstream: wsPort,
    });
    webSocketUrl = `wss://localhost:${proxyPort}/ws`;

    const config: ServerConfig = {
      extensionPort: wsPort,
      httpPort: httpUpstream,
      transports: [],
      editorEnabled: true,
      webSocketUrl,
      logger: "console",
    };

    await app.startHttpServer(
      httpUpstream,
      config,
      getHttpFeatureConfig(config),
    );
    upstreamHttpPort = httpUpstream;
  } else {
    const config: ServerConfig = {
      extensionPort: wsPort,
      httpPort: 0,
      transports: [],
      editorEnabled: true,
      logger: "console",
    };

    const startedHttp = await app.startHttpServer(
      0,
      config,
      getHttpFeatureConfig(config),
    );
    upstreamHttpPort = startedHttp.port;
  }

  const httpPort = useHttps ? proxyPort! : upstreamHttpPort;
  const baseUrl = useHttps
    ? `https://localhost:${proxyPort}/`
    : `http://localhost:${upstreamHttpPort}/`;

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({
    name: "real-environment-test",
    version: "1.0.0",
  });

  const testServer = app.createMcpServer();
  await Promise.all([
    testServer.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  const browser = await chromium.launch({ headless: true });
  const browserContext = await browser.newContext({
    ignoreHTTPSErrors: useHttps,
  });
  const page = await browserContext.newPage();

  page.on("console", (message: ConsoleMessage) => {
    browserMessages.push({
      type: message.type(),
      text: message.text(),
    });
  });

  await page.addInitScript(
    (args: { port: number; websocketUrl: string | undefined }) => {
      const store: Record<string, unknown> = {
        websocketPort: args.port,
      };
      if (args.websocketUrl) {
        store.websocketUrl = args.websocketUrl;
      }

      (window as any).__DRAWIO_MCP_TEST_HOOKS__ = true;
      window.localStorage.setItem(
        "drawio-mcp-plugin-config",
        JSON.stringify(store),
      );
      window.localStorage.setItem("drawio-mcp-config", JSON.stringify(store));
    },
    { port: wsPort, websocketUrl: webSocketUrl },
  );

  await page.goto(baseUrl, {
    waitUntil: "domcontentloaded",
  });
  await waitForPluginReady(page);

  const proxy: ProxyHandle | null = caddy
    ? { stop: () => caddy!.stop(), proxyPort: caddy.proxyPort }
    : null;

  return {
    browser,
    browserContext,
    page,
    client,
    app,
    logger,
    browserMessages,
    artifactRunDir,
    httpPort,
    wsPort,
    baseUrl,
    proxy,
  };
}

export async function disposeRealEnvironmentContext(
  context: RealEnvironmentContext | undefined,
) {
  if (!context) return;
  await context.client?.close();
  await context.browserContext?.close();
  await context.browser?.close();
  await context.app?.close();
  if (context.proxy) {
    await context.proxy.stop();
  }
}

export async function waitForPluginReady(page: Page) {
  await page.waitForFunction(() => {
    const maybeWindow = window as any;
    return Boolean(maybeWindow.ui?.editor?.graph);
  });

  await page.waitForFunction(() => {
    const maybeWindow = window as any;
    const graph = maybeWindow.ui?.editor?.graph;
    return Boolean(graph?.getModel?.()?.cells);
  });

  await page.waitForFunction(() => document.querySelector("svg") !== null);
  await page.waitForTimeout(1500);
}

export async function getCells(page: Page): Promise<CellSnapshot[]> {
  return page.evaluate(() => {
    const maybeWindow = window as any;
    const graph = maybeWindow.ui?.editor?.graph;
    const model = graph?.getModel?.();
    const cells = Object.values(model?.cells ?? {}) as any[];

    return cells
      .filter((cell) => cell?.vertex && cell?.geometry)
      .map((cell) => ({
        id: String(cell.id),
        value: typeof cell.value === "string" ? cell.value : "",
        style: String(cell.style ?? ""),
        x: typeof cell.geometry?.x === "number" ? cell.geometry.x : null,
        y: typeof cell.geometry?.y === "number" ? cell.geometry.y : null,
        width:
          typeof cell.geometry?.width === "number" ? cell.geometry.width : null,
        height:
          typeof cell.geometry?.height === "number"
            ? cell.geometry.height
            : null,
        parentId: cell.parent?.id ? String(cell.parent.id) : null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  });
}

export async function getCellById(page: Page, cellId: string) {
  return page.evaluate((id: string) => {
    const maybeWindow = window as any;
    const graph = maybeWindow.ui?.editor?.graph;
    const cell = graph?.getModel?.().getCell?.(id);

    if (!cell) {
      return null;
    }

    return {
      id: String(cell.id),
      value: typeof cell.value === "string" ? cell.value : "",
      style: String(cell.style ?? ""),
      x: typeof cell.geometry?.x === "number" ? cell.geometry.x : null,
      y: typeof cell.geometry?.y === "number" ? cell.geometry.y : null,
      width:
        typeof cell.geometry?.width === "number" ? cell.geometry.width : null,
      height:
        typeof cell.geometry?.height === "number" ? cell.geometry.height : null,
      parentId: cell.parent?.id ? String(cell.parent.id) : null,
      edge: Boolean(cell.edge),
      vertex: Boolean(cell.vertex),
      sourceId: cell.source?.id ? String(cell.source.id) : null,
      targetId: cell.target?.id ? String(cell.target.id) : null,
      points: Array.isArray(cell.geometry?.points)
        ? cell.geometry.points.map((point: any) => ({
            x: typeof point.x === "number" ? point.x : null,
            y: typeof point.y === "number" ? point.y : null,
          }))
        : [],
      attributes:
        typeof cell.value === "object" && cell.value?.attributes
          ? Array.from(cell.value.attributes).reduce(
              (acc: Record<string, string>, attr: any) => {
                acc[String(attr.name)] = String(attr.value);
                return acc;
              },
              {},
            )
          : {},
    };
  }, cellId);
}

export async function selectCell(page: Page, cellId: string) {
  await page.evaluate((id: string) => {
    const maybeWindow = window as any;
    const graph = maybeWindow.ui?.editor?.graph;
    const cell = graph?.getModel?.().getCell?.(id);

    if (!cell) {
      throw new Error(`Cell ${id} not found for selection`);
    }

    graph.setSelectionCell(cell);
  }, cellId);
}

export function browserErrors(context: RealEnvironmentContext) {
  return context.browserMessages.filter((entry) => entry.type === "error");
}

export async function resetDiagram(context: RealEnvironmentContext) {
  const emptyDiagram =
    '<mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

  await context.client.callTool({
    name: "import-diagram",
    arguments: {
      data: emptyDiagram,
      format: "xml",
      mode: "replace",
      filename: "blank.drawio",
    },
  });

  await context.page.waitForFunction(() => {
    const maybeWindow = window as any;
    const graph = maybeWindow.ui?.editor?.graph;
    const model = graph?.getModel?.();
    const cells = Object.values(model?.cells ?? {}) as any[];
    return cells.filter((cell) => cell?.vertex).length === 0;
  });
}
