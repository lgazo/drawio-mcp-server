import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import {
  createRealEnvironmentContext,
  disposeRealEnvironmentContext,
  getCells,
  resetDiagram,
} from "./harness.js";
import {
  expectNoBrowserErrors,
  expectNoServerErrors,
  withVerificationScreenshot,
} from "./assertions.js";
import { callToolJson } from "./tools.js";
import type { RealEnvironmentContext } from "./types.js";

describe("real environment/edit-cell", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("edits an existing cell through MCP and verifies the live diagram state", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: created } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-cell-of-shape", {
      shape_name: "rectangle",
      text: "Original",
      x: 100,
      y: 120,
      width: 120,
      height: 70,
      style: "fillColor=#ffffff;strokeColor=#000000;",
    });

    expect(created.success).toBe(true);

    const { payload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "edit-cell", {
      cell_id: created.result.id,
      text: "Edited via MCP",
      x: 260,
      y: 210,
      width: 180,
      height: 95,
      style: "fillColor=#d5e8d4;strokeColor=#82b366;",
    });

    expect(payload.success).toBe(true);

    await context.page.waitForFunction((id: string) => {
      const ui = (window as any).ui;
      const graph = ui?.editor?.graph;
      const cell = graph?.getModel?.().getCell?.(id);

      return (
        cell &&
        cell.value === "Edited via MCP" &&
        cell.geometry?.x === 260 &&
        cell.geometry?.y === 210 &&
        cell.geometry?.width === 180 &&
        cell.geometry?.height === 95 &&
        String(cell.style || "").includes("fillColor=#d5e8d4")
      );
    }, created.result.id);

    await withVerificationScreenshot(
      context,
      "edit-cell",
      "before-live-state-verification",
      async () => {
        const cells = await getCells(context.page);
        const editedCell = cells.find((cell) => cell.id === created.result.id);

        expect(editedCell).toBeDefined();
        expect(editedCell?.value).toBe("Edited via MCP");
        expect(editedCell?.x).toBe(260);
        expect(editedCell?.y).toBe(210);
        expect(editedCell?.width).toBe(180);
        expect(editedCell?.height).toBe(95);
        expect(editedCell?.style).toContain("fillColor=#d5e8d4");
        expect(editedCell?.style).toContain("strokeColor=#82b366");
      },
    );

    await expectNoBrowserErrors(context, "edit-cell");
    await expectNoServerErrors(context, "edit-cell", logCountBefore);
  }, 180000);
});
