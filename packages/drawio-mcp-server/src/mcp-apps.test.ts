import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createDrawioMcpApp, type DrawioMcpApp } from "./index.js";
import { defaultConfig } from "./config.js";
import { MemoryLogger } from "./real-environment/logger.js";

async function connectClientForApp(app: DrawioMcpApp): Promise<Client> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = app.createMcpServer();
  const client = new Client({ name: "apps-test", version: "1.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

describe("MCP Apps: show-diagram tool", () => {
  let app: DrawioMcpApp;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("advertises show-diagram with ui _meta and target_document", async () => {
    app = createDrawioMcpApp({
      config: defaultConfig(),
      log: new MemoryLogger(),
    });
    const client = await connectClientForApp(app);
    const { tools } = await client.listTools();

    const tool = tools.find((t) => t.name === "show-diagram");
    expect(tool).toBeDefined();
    expect(tool?.description).toContain("interactive");
    // ext-apps' registerAppTool normalizes UI metadata: when
    // `_meta.ui.resourceUri` is set it also writes the legacy
    // `_meta["ui/resourceUri"]` key for compatibility with older hosts.
    expect(
      (tool as unknown as { _meta?: Record<string, unknown> })._meta,
    ).toEqual({
      ui: { resourceUri: "ui://drawio/editor.html" },
      "ui/resourceUri": "ui://drawio/editor.html",
    });
    const schema = tool?.inputSchema as {
      properties?: Record<string, unknown>;
      [key: string]: unknown;
    };
    expect(schema?.properties?.target_document).toBeDefined();
    expect(schema?.properties?.target_page).toBeDefined();
    expect(schema?.$schema).toBeUndefined();

    await client.close();
  });

  it("injects target_document into every tool except list-documents", async () => {
    app = createDrawioMcpApp({
      config: defaultConfig(),
      log: new MemoryLogger(),
    });
    const client = await connectClientForApp(app);
    const { tools } = await client.listTools();

    for (const tool of tools) {
      const schema = tool.inputSchema as {
        properties?: Record<string, unknown>;
      };
      if (tool.name === "list-documents") {
        expect(schema?.properties?.target_document).toBeUndefined();
        continue;
      }
      expect(schema?.properties?.target_document).toBeDefined();
    }

    await client.close();
  });
});

describe("MCP Apps: editor resource", () => {
  it("serves the shell with the MCP Apps mime type and CSP", async () => {
    const app = createDrawioMcpApp({
      config: defaultConfig(),
      log: new MemoryLogger(),
    });
    const client = await connectClientForApp(app);

    const result = await client.readResource({
      uri: "ui://drawio/editor.html",
    });
    const contents = result.contents as Array<{
      mimeType?: string;
      text?: string;
      uri: string;
    }>;
    expect(contents[0]?.mimeType).toBe("text/html;profile=mcp-app");
    expect(contents[0]?.text).toContain("<iframe");
    expect(contents[0]?.text).toContain("McpAppsApp");
    expect(contents[0]?.text).toContain("http://localhost:3000/index.html");
    const meta = (
      result as unknown as {
        _meta?: { ui?: { csp?: { frameDomains?: string[] } } };
      }
    )._meta;
    expect(meta?.ui?.csp?.frameDomains).toContain("http://localhost:3000");
    expect(contents[0]?.uri).toBe("ui://drawio/editor.html");
    expect(contents[0]?.text?.includes("__EDITOR_URL__")).toBe(false);
    expect(contents[0]?.text?.includes("/*__APP_CLIENT__*/")).toBe(false);

    await client.close();
    await app.close();
  });

  it("uses https origin when TLS is enabled", async () => {
    const config = {
      ...defaultConfig(),
      tlsEnabled: true,
      tlsAuto: true,
      httpPort: 3443,
    };
    const app = createDrawioMcpApp({
      config,
      log: new MemoryLogger(),
    });
    const client = await connectClientForApp(app);

    const result = await client.readResource({
      uri: "ui://drawio/editor.html",
    });
    const meta = (
      result as unknown as {
        _meta?: { ui?: { csp?: { frameDomains?: string[] } } };
      }
    )._meta;
    expect(meta?.ui?.csp?.frameDomains).toContain("https://localhost:3443");
    const contents = result.contents as Array<{ text?: string }>;
    expect(contents[0]?.text).toContain("https://localhost:3443/index.html");

    await client.close();
    await app.close();
  });
});
