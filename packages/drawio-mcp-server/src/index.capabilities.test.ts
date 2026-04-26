import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createDrawioMcpApp, type DrawioMcpApp } from "./index.js";
import { defaultConfig } from "./config.js";
import { MemoryLogger } from "./real-environment/logger.js";

describe("createDrawioMcpApp capabilities", () => {
  let app: DrawioMcpApp;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("does not advertise logging capability when logger is console", async () => {
    app = createDrawioMcpApp({
      config: { ...defaultConfig(), logger: "console" },
      log: new MemoryLogger(),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const server = app.createMcpServer();
    const client = new Client({ name: "cap-test", version: "1.0.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const capabilities = client.getServerCapabilities();
    expect(capabilities?.logging).toBeUndefined();

    await client.close();
  });

  it("advertises logging capability when logger is mcp-server", async () => {
    app = createDrawioMcpApp({
      config: { ...defaultConfig(), logger: "mcp-server" },
      log: new MemoryLogger(),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const server = app.createMcpServer();
    const client = new Client({ name: "cap-test", version: "1.0.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const capabilities = client.getServerCapabilities();
    expect(capabilities?.logging).toBeDefined();
    expect(capabilities?.logging).toEqual(
      expect.objectContaining({ setLevels: true }),
    );

    await client.close();
  });
});
