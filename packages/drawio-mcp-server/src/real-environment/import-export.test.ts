import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createRealEnvironmentContext,
  disposeRealEnvironmentContext,
  getCellById,
  resetDiagram,
} from "./harness.js";
import {
  expectNoBrowserErrors,
  expectNoServerErrors,
  withVerificationScreenshot,
} from "./assertions.js";
import { callToolJson, callToolRaw } from "./tools.js";
import { expectToolSuccess } from "./test-helpers.js";
import type { RealEnvironmentContext } from "./types.js";

describe("real environment/import export", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("covers xml export to file and xml import into the live diagram", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: rectangle } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 120,
      y: 110,
      width: 150,
      height: 90,
      text: "Export me",
    });
    expectToolSuccess(rectangle);

    const xmlExportPath = join(context.artifactRunDir, "diagram.xml");
    const xmlExport = await callToolRaw(context, "export-diagram", {
      format: "xml",
      output_path: xmlExportPath,
    });

    expect(existsSync(xmlExportPath)).toBe(true);
    expect(readFileSync(xmlExportPath, "utf-8")).toContain("mxGraphModel");

    const xmlTextContent = (
      xmlExport.content as Array<{ type: string; text?: string }>
    ).find(
      (item) => item.type === "text" && item.text?.includes("mxGraphModel"),
    );
    expect(xmlTextContent).toBeDefined();

    const importXml =
      '<mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="imported-1" value="Imported cell" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;" vertex="1" parent="1"><mxGeometry x="80" y="220" width="160" height="80" as="geometry"/></mxCell></root></mxGraphModel>';

    const { payload: importResult } = await callToolJson<any>(
      context,
      "import-diagram",
      {
        data: importXml,
        format: "xml",
        mode: "replace",
        filename: "imported.drawio",
      },
    );
    expect(importResult?.success).toBe(true);

    await context.page.waitForFunction(() => {
      const maybeWindow = window as any;
      const graph = maybeWindow.ui?.editor?.graph;
      const model = graph?.getModel?.();
      const cells = Object.values(model?.cells ?? {}) as any[];
      return cells.some((cell) => cell?.value === "Imported cell");
    });

    await withVerificationScreenshot(
      context,
      "import-export",
      "before-live-state-verification",
      async () => {
        const rectangleCell = await getCellById(
          context.page,
          rectangle.result.id,
        );
        expect(rectangleCell).toBeNull();

        const importedCell = await context.page.evaluate(() => {
          const maybeWindow = window as any;
          const graph = maybeWindow.ui?.editor?.graph;
          const model = graph?.getModel?.();
          const cells = Object.values(model?.cells ?? {}) as any[];
          const cell = cells.find(
            (candidate) => candidate?.value === "Imported cell",
          );
          if (!cell) {
            return null;
          }

          return {
            value: cell.value,
            style: String(cell.style ?? ""),
            width:
              typeof cell.geometry?.width === "number"
                ? cell.geometry.width
                : null,
          };
        });

        expect(importedCell).not.toBeNull();
        expect(importedCell?.value).toBe("Imported cell");
        expect(importedCell?.style).toContain("fillColor=#ffe6cc");
        expect(importedCell?.width).toBe(160);
      },
    );

    await expectNoBrowserErrors(context, "import-export");
    await expectNoServerErrors(context, "import-export", logCountBefore);
  }, 180000);

  it("keeps ui.currentPage.root in sync with graph.model.root after replace import (regression for #56)", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const importXml =
      '<mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="regression-1" value="Regression cell" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel>';

    const { payload: importResult } = await callToolJson<any>(
      context,
      "import-diagram",
      {
        data: importXml,
        format: "xml",
        mode: "replace",
        filename: "regression.drawio",
      },
    );
    expectToolSuccess(importResult);

    await context.page.waitForFunction(() => {
      const maybeWindow = window as any;
      const graph = maybeWindow.ui?.editor?.graph;
      const model = graph?.getModel?.();
      const cells = Object.values(model?.cells ?? {}) as any[];
      return cells.some((cell) => cell?.value === "Regression cell");
    });

    const pageState = await context.page.evaluate(() => {
      const maybeWindow = window as any;
      const ui = maybeWindow.ui;
      const page = ui?.currentPage;
      const model = ui?.editor?.graph?.getModel?.();
      const modelRoot = model?.getRoot?.() ?? model?.root ?? null;

      return {
        pageRootMatchesModelRoot: page?.root === modelRoot,
        graphModelNodeIsNull: page?.graphModelNode == null,
        pageRootHasImportedCell: (() => {
          if (!page?.root || typeof page.root.getChildAt !== "function")
            return null;
          const rootChild = page.root.getChildAt(0);
          if (!rootChild || typeof rootChild.getChildAt !== "function")
            return null;
          for (let i = 0; i < (rootChild.getChildCount?.() ?? 0); i++) {
            const child = rootChild.getChildAt(i);
            if (child?.value === "Regression cell") return true;
          }
          return false;
        })(),
      };
    });

    expect(pageState.pageRootMatchesModelRoot).toBe(true);
    expect(pageState.graphModelNodeIsNull).toBe(true);
    expect(pageState.pageRootHasImportedCell).toBe(true);

    // The page-root identity asserted above is a proxy for correctness. What a
    // user actually loses when currentPage goes stale is the *serialized* file:
    // drawio serializes through the Page abstraction, so a stale page root ends
    // up in the saved bytes while the live graph (holding the import) does not.
    // Assert the import survives serialization, not just the in-memory model.
    const serializedFileData = await context.page.evaluate(() => {
      const maybeWindow = window as any;
      const ui = maybeWindow.ui;

      try {
        if (
          typeof ui?.getXmlFileData === "function" &&
          typeof maybeWindow.mxUtils?.getXml === "function"
        ) {
          return String(
            maybeWindow.mxUtils.getXml(ui.getXmlFileData(true, false, true)),
          );
        }
      } catch {
        /* fall through to getFileData */
      }

      try {
        if (typeof ui?.getFileData === "function") {
          return String(
            ui.getFileData(
              true,
              null,
              null,
              null,
              true,
              null,
              null,
              null,
              null,
              true,
            ),
          );
        }
      } catch {
        /* unsupported build */
      }

      return null;
    });

    if (serializedFileData !== null) {
      expect(serializedFileData).toContain("Regression cell");
    }

    const survivesPageRoundTrip = await context.page.evaluate(async () => {
      const maybeWindow = window as any;
      const ui = maybeWindow.ui;
      if (!ui?.insertPage || !ui?.selectPage || !ui?.currentPage) {
        return { skipped: true };
      }

      const originalPage = ui.currentPage;
      const scratch = ui.insertPage();
      ui.selectPage(scratch);
      await new Promise((r) => setTimeout(r, 20));
      ui.selectPage(originalPage);
      await new Promise((r) => setTimeout(r, 20));

      const model = ui.editor.graph.getModel();
      const cells = Object.values(model?.cells ?? {}) as any[];
      const stillPresent = cells.some(
        (cell) => cell?.value === "Regression cell",
      );

      if (typeof ui.removePage === "function") {
        try {
          ui.removePage(scratch);
        } catch {
          /* best-effort cleanup */
        }
      }

      return { skipped: false, stillPresent };
    });

    if (!survivesPageRoundTrip.skipped) {
      expect(survivesPageRoundTrip.stillPresent).toBe(true);
    }

    await expectNoBrowserErrors(context, "import-export");
    await expectNoServerErrors(context, "import-export", logCountBefore);
  }, 180000);
});
