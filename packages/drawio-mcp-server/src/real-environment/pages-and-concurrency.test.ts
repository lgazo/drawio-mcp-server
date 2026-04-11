import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import {
  createRealEnvironmentContext,
  disposeRealEnvironmentContext,
  resetDiagram,
} from "./harness.js";
import {
  expectNoBrowserErrors,
  expectNoServerErrors,
} from "./assertions.js";
import {
  callClientToolJson,
  callToolJson,
  callToolRaw,
} from "./tools.js";
import {
  expectToolSuccess,
  unwrapToolPayload,
} from "./test-helpers.js";
import type { RealEnvironmentContext } from "./types.js";

type PageInfo = {
  index: number;
  id: string;
  name: string;
  is_current: boolean;
};

function extractPrimaryText(result: Awaited<ReturnType<typeof callToolRaw>>) {
  return (
    (result.content as Array<{ type: string; text?: string }>).find(
      (item) => item.type === "text" && item.text?.includes("mxGraphModel"),
    )?.text ?? ""
  );
}

describe("real environment/pages and concurrency", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("supports page listing and serializes concurrent page-targeted edits", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: renamedFirstPayload } = await callToolJson<{
      success: boolean;
      result: PageInfo;
    }>(context, "rename-page", {
      page: { index: 0 },
      name: "Page Alpha",
    });
    expectToolSuccess(renamedFirstPayload);
    const pageAlpha = unwrapToolPayload<PageInfo>(renamedFirstPayload);

    const { payload: createdPayload } = await callToolJson<{
      success: boolean;
      result: PageInfo;
    }>(context, "create-page", {
      name: "Page Beta",
    });
    expectToolSuccess(createdPayload);
    const pageBeta = unwrapToolPayload<PageInfo>(createdPayload);

    const importXml =
      '<mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="gamma-seed" value="Gamma Seed" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;" vertex="1" parent="1"><mxGeometry x="80" y="120" width="180" height="80" as="geometry"/></mxCell></root></mxGraphModel>';

    const { payload: importPayload } = await callToolJson<{
      success: boolean;
      result: { success: boolean; pages: number };
    }>(context, "import-diagram", {
      data: importXml,
      format: "xml",
      mode: "new-page",
      filename: "Page Gamma.drawio",
    });
    expectToolSuccess(importPayload);
    const importResult = unwrapToolPayload<{ success: boolean; pages: number }>(
      importPayload,
    );
    expect(importResult.success).toBe(true);
    expect(importResult.pages).toBe(3);

    const { payload: pagesPayload } = await callToolJson<{
      success: boolean;
      result: PageInfo[];
    }>(context, "list-pages", {});
    expectToolSuccess(pagesPayload);
    const pages = unwrapToolPayload<PageInfo[]>(pagesPayload);

    expect(pages).toEqual([
      {
        index: 0,
        id: pageAlpha.id,
        name: "Page Alpha",
        is_current: false,
      },
      {
        index: 1,
        id: pageBeta.id,
        name: "Page Beta",
        is_current: false,
      },
      {
        index: 2,
        id: pages[2].id,
        name: "Page Gamma",
        is_current: true,
      },
    ]);

    const missingTargetPage = await context.client.callTool({
      name: "add-rectangle",
      arguments: {
        text: "Missing target page",
      },
    });
    expect(missingTargetPage.isError).toBe(true);
    expect(
      (missingTargetPage.content as Array<{ type: string; text?: string }>)[0]
        ?.text,
    ).toContain("target_page");

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const secondServer = context.app.createMcpServer();
    const secondClient = new Client({
      name: "page-concurrency-client",
      version: "1.0.0",
    });

    await Promise.all([
      secondServer.connect(serverTransport),
      secondClient.connect(clientTransport),
    ]);

    try {
      const { payload: alphaRectPayload } = await callToolJson<{
        success: boolean;
        result: { id: string };
      }>(context, "add-rectangle", {
        target_page: { id: pageAlpha.id },
        x: 80,
        y: 80,
        width: 180,
        height: 80,
        text: "Alpha Seed",
      });
      expectToolSuccess(alphaRectPayload);
      const alphaRect = unwrapToolPayload<{ id: string }>(alphaRectPayload);

      const { payload: betaRectPayload } = await callClientToolJson<{
        success: boolean;
        result: { id: string };
      }>(secondClient, "add-rectangle", {
        target_page: { id: pageBeta.id },
        x: 120,
        y: 120,
        width: 180,
        height: 80,
        text: "Beta Seed",
      });
      expectToolSuccess(betaRectPayload);
      const betaRect = unwrapToolPayload<{ id: string }>(betaRectPayload);

      await Promise.all([
        callToolJson(context, "edit-cell", {
          target_page: { id: pageAlpha.id },
          cell_id: alphaRect.id,
          text: "Alpha Updated",
        }),
        callClientToolJson(secondClient, "edit-cell", {
          target_page: { id: pageBeta.id },
          cell_id: betaRect.id,
          text: "Beta Updated",
        }),
      ]);
    } finally {
      await secondClient.close();
    }

    const { payload: currentPagePayload } = await callToolJson<{
      success: boolean;
      result: PageInfo;
    }>(context, "get-current-page", {});
    expectToolSuccess(currentPagePayload);
    const currentPage = unwrapToolPayload<PageInfo>(currentPagePayload);
    expect(currentPage.id).toBe(pageBeta.id);

    const alphaExport = await callToolRaw(context, "export-diagram", {
      target_page: { id: pageAlpha.id },
      format: "xml",
      size: "page",
    });
    const betaExport = await callToolRaw(context, "export-diagram", {
      target_page: { id: pageBeta.id },
      format: "xml",
      size: "page",
    });
    const gammaExport = await callToolRaw(context, "export-diagram", {
      target_page: { id: pages[2].id },
      format: "xml",
      size: "page",
    });

    const alphaXml = extractPrimaryText(alphaExport);
    const betaXml = extractPrimaryText(betaExport);
    const gammaXml = extractPrimaryText(gammaExport);

    expect(alphaXml).toContain("Alpha Updated");
    expect(alphaXml).not.toContain("Beta Updated");
    expect(alphaXml).not.toContain("Gamma Seed");

    expect(betaXml).toContain("Beta Updated");
    expect(betaXml).not.toContain("Alpha Updated");
    expect(betaXml).not.toContain("Gamma Seed");

    expect(gammaXml).toContain("Gamma Seed");
    expect(gammaXml).not.toContain("Alpha Updated");
    expect(gammaXml).not.toContain("Beta Updated");

    await expectNoBrowserErrors(context, "pages-and-concurrency");
    await expectNoServerErrors(
      context,
      "pages-and-concurrency",
      logCountBefore,
    );
  }, 180000);
});
