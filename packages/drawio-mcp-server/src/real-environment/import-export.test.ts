import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

    const xmlExportDir = mkdtempSync(join(tmpdir(), "drawio-real-export-"));
    const xmlExportPath = join(xmlExportDir, "diagram.xml");
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
});
