import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createDrawioMcpApp, type DrawioMcpApp } from "./index.js";
import { MemoryLogger } from "./real-environment/logger.js";

describe("multi-transport support", () => {
  let app: DrawioMcpApp;
  let logger: MemoryLogger;

  beforeEach(() => {
    logger = new MemoryLogger();
    app = createDrawioMcpApp({ log: logger });
  });

  afterEach(async () => {
    await app.close();
  });

  it("createMcpServer returns distinct instances", () => {
    const server1 = app.createMcpServer();
    const server2 = app.createMcpServer();

    expect(server1).not.toBe(server2);
  });

  it("each McpServer instance has tools registered", async () => {
    const [ct1, st1] = InMemoryTransport.createLinkedPair();
    const [ct2, st2] = InMemoryTransport.createLinkedPair();

    const server1 = app.createMcpServer();
    const server2 = app.createMcpServer();

    const client1 = new Client({ name: "test-client-1", version: "1.0.0" });
    const client2 = new Client({ name: "test-client-2", version: "1.0.0" });

    await Promise.all([
      server1.connect(st1),
      client1.connect(ct1),
      server2.connect(st2),
      client2.connect(ct2),
    ]);

    const tools1 = await client1.listTools();
    const tools2 = await client2.listTools();

    expect(tools1.tools.length).toBeGreaterThan(0);
    expect(tools2.tools.length).toBeGreaterThan(0);

    const names1 = tools1.tools.map((t) => t.name).sort();
    const names2 = tools2.tools.map((t) => t.name).sort();
    expect(names1).toEqual(names2);

    await client1.close();
    await client2.close();
  });

  it("two InMemoryTransport connections work simultaneously without 'Already connected' error", async () => {
    const [ct1, st1] = InMemoryTransport.createLinkedPair();
    const [ct2, st2] = InMemoryTransport.createLinkedPair();

    const server1 = app.createMcpServer();
    const server2 = app.createMcpServer();

    const client1 = new Client({ name: "test-client-1", version: "1.0.0" });
    const client2 = new Client({ name: "test-client-2", version: "1.0.0" });

    // This is the exact scenario that was failing before the fix:
    // connecting two transports should not throw.
    await expect(
      Promise.all([
        server1.connect(st1),
        client1.connect(ct1),
        server2.connect(st2),
        client2.connect(ct2),
      ]),
    ).resolves.not.toThrow();

    // Both clients can independently list tools
    const [tools1, tools2] = await Promise.all([
      client1.listTools(),
      client2.listTools(),
    ]);

    expect(tools1.tools.length).toBeGreaterThan(0);
    expect(tools2.tools.length).toBeGreaterThan(0);

    await client1.close();
    await client2.close();
  });

  it("close() shuts down all created McpServer instances", async () => {
    const [ct1, st1] = InMemoryTransport.createLinkedPair();
    const [ct2, st2] = InMemoryTransport.createLinkedPair();

    const server1 = app.createMcpServer();
    const server2 = app.createMcpServer();

    const client1 = new Client({ name: "test-client-1", version: "1.0.0" });
    const client2 = new Client({ name: "test-client-2", version: "1.0.0" });

    await Promise.all([
      server1.connect(st1),
      client1.connect(ct1),
      server2.connect(st2),
      client2.connect(ct2),
    ]);

    // close() should succeed without errors even with multiple servers
    await expect(app.close()).resolves.not.toThrow();

    // After close, listing tools should fail because the servers are shut down
    await expect(client1.listTools()).rejects.toThrow();
    await expect(client2.listTools()).rejects.toThrow();
  });

  it("connecting the same McpServer instance to two transports still throws", async () => {
    const [_ct1, st1] = InMemoryTransport.createLinkedPair();
    const [_ct2, st2] = InMemoryTransport.createLinkedPair();

    const server = app.createMcpServer();
    await server.connect(st1);

    // The SDK constraint hasn't changed — a single Protocol instance
    // still rejects a second connect().
    await expect(server.connect(st2)).rejects.toThrow(/already connected/i);
  });
});
