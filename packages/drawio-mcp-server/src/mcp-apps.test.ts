import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createDrawioMcpApp, type DrawioMcpApp } from "./index.js";
import { defaultConfig } from "./config.js";
import { MemoryLogger } from "./real-environment/logger.js";

describe("MCP Apps: show-diagram tool", () => {
  let app: DrawioMcpApp;

  afterEach(async () => {
    if (app) await app.close();
  });

  async function connectClient(config = defaultConfig()): Promise<Client> {
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

  it("advertises show-diagram with ui _meta and target_document", async () => {
    app = createDrawioMcpApp({
      config: defaultConfig(),
      log: new MemoryLogger(),
    });
    const client = await connectClient();
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
    const client = await connectClient();
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
