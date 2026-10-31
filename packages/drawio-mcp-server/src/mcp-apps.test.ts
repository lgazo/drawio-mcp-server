import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createDrawioMcpApp, type DrawioMcpApp } from "./index.js";
import { defaultConfig } from "./config.js";
import { MemoryLogger } from "./real-environment/logger.js";
import {
  build_editor_url,
  build_editor_standalone_url,
} from "./app-resource.js";

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

  it("runs the tool handler on tools/call (document-routing error, not a broken handler)", async () => {
    app = createDrawioMcpApp({
      config: defaultConfig(),
      log: new MemoryLogger(),
    });
    const client = await connectClientForApp(app);

    // No documents are connected and an explicit unknown target_document is
    // passed, so the handler's document routing must reject. Regression:
    // the document-scoped registerTool shim dropped the callback argument,
    // leaving tool.handler undefined and making tools/call throw
    // `Cannot use 'in' operator to search for 'createTask' in undefined`.
    // With no explicit target_document the same call now cold-starts with
    // a blank diagram instead of erroring.
    const result = (await client.callTool({
      name: "show-diagram",
      arguments: {
        target_page: { index: 0 },
        target_document: { id: "does-not-exist" },
      },
    })) as {
      isError?: boolean;
      content?: Array<{ type: string; text?: string }>;
    };

    expect(result.isError).toBe(true);
    const text = (result.content ?? [])
      .map((item) => item.text ?? "")
      .join("\n");
    expect(text).toContain("does-not-exist");
    expect(text).not.toContain("createTask");

    await client.close();
  });
});

describe("MCP Apps: show-diagram cold start", () => {
  let app: DrawioMcpApp;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("returns a blank diagram when no documents are connected", async () => {
    app = createDrawioMcpApp({
      config: defaultConfig(),
      log: new MemoryLogger(),
    });
    const client = await connectClientForApp(app);

    const result = await client.callTool({
      name: "show-diagram",
      arguments: { target_page: { index: 0 } },
    });
    const text =
      (result.content as Array<{ type: string; text?: string }>).find(
        (c) => c.type === "text",
      )?.text ?? "";
    expect(text).toContain("<mxfile");
    expect(text).toContain("<mxGraphModel");
    expect(text).not.toContain("No connected");

    await client.close();
  });

  it("still errors for an explicit unknown target_document", async () => {
    app = createDrawioMcpApp({
      config: defaultConfig(),
      log: new MemoryLogger(),
    });
    const client = await connectClientForApp(app);

    // The SDK surfaces handler-thrown errors as an isError tool result,
    // not a rejected callTool promise.
    const result = (await client.callTool({
      name: "show-diagram",
      arguments: {
        target_document: { id: "does-not-exist" },
        target_page: { index: 0 },
      },
    })) as {
      isError?: boolean;
      content?: Array<{ type: string; text?: string }>;
    };
    expect(result.isError).toBe(true);
    const text = (result.content ?? [])
      .map((item) => item.text ?? "")
      .join("\n");
    expect(text).not.toContain("No connected");
    expect(text).toContain("does-not-exist");

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
    expect(contents[0]?.text).toContain(
      "http://localhost:3000/index.html?embed=1&proto=json&local=1",
    );
    // drawio's App.start skips plugin loading (window.Draw assignment) when
    // offline=1 is set, so the framed editor must boot with plugins running.
    expect(contents[0]?.text?.includes("offline=1")).toBe(false);
    // The shell must speak drawio's embed JSON-string protocol on both
    // message directions (see embed-protocol.ts for the root cause): the
    // protocol helper bundle is spliced inline and every action posted to
    // the editor goes through it as a JSON string.
    expect(contents[0]?.text).toContain("DrawioEmbedProtocol");
    expect(contents[0]?.text).toContain("encodeEditorAction");
    expect(contents[0]?.text?.includes("__EMBED_PROTOCOL__")).toBe(false);
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
    expect(contents[0]?.text).toContain(
      "https://localhost:3443/index.html?embed=1&proto=json&local=1",
    );
    expect(contents[0]?.text?.includes("offline=1")).toBe(false);

    await client.close();
    await app.close();
  });
});

describe("MCP Apps: adaptive shell fallback", () => {
  it("exposes the framed embed URL and an embed-params-free standalone URL", () => {
    const config = defaultConfig();
    const embed = build_editor_url(config);
    const standalone = build_editor_standalone_url(config);

    expect(embed).toBe(
      "http://localhost:3000/index.html?embed=1&proto=json&local=1",
    );
    // The standalone link opens the normal editor tab, where the draw.io
    // plugin boots and the MCP tools keep working — it must not contain any
    // of the embed-mode parameters.
    expect(standalone).toBe("http://localhost:3000/index.html?local=1");
    expect(standalone).toContain("index.html?local=1");
    expect(standalone).not.toContain("embed=1");
    expect(standalone).not.toContain("proto=json");
  });

  it("replaces the standalone URL placeholder in the rendered shell", async () => {
    const app = createDrawioMcpApp({
      config: defaultConfig(),
      log: new MemoryLogger(),
    });
    const client = await connectClientForApp(app);

    const result = await client.readResource({
      uri: "ui://drawio/editor.html",
    });
    const text = (result.contents as Array<{ text?: string }>)[0]?.text ?? "";
    expect(text?.includes("__EDITOR_STANDALONE_URL__")).toBe(false);
    expect(text).toContain("http://localhost:3000/index.html?local=1");

    await client.close();
    await app.close();
  });

  it("shell detects frame-src CSP violations and offers the preview panel", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const shell = readFileSync(join(here, "app-shell", "shell.html"), "utf-8");
    // Blocked-frame detection: a securitypolicyviolation listener for the
    // frame-src directive (feature-detected — must not throw on hosts that
    // never deliver CSP violations).
    expect(shell).toContain("securitypolicyviolation");
    expect(shell).toContain("frame-src");
    // The preview panel replaces the old fallback copy.
    expect(shell.includes("Draw.io editor unreachable.")).toBe(false);
    // Read-only preview rides the server-tool bridge: callServerTool with
    // the export-diagram tool, never a fetch (no connectDomains).
    expect(shell).toContain("callServerTool");
    expect(shell).toContain('"export-diagram"');
    expect(shell.includes("connectDomains")).toBe(false);
    // The 8s init backstop routes into the same panel.
    expect(shell).toContain("showBlocked");
  });
});
