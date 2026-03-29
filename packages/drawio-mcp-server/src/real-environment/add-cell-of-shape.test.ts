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

describe("real environment/add-cell-of-shape", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("adds a cell via MCP and verifies the live diagram state", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const beforeCells = await getCells(context.page);

    const { payload } = await callToolJson<{
      success: boolean;
      result: {
        id: string;
      };
    }>(context, "add-cell-of-shape", {
        shape_name: "rectangle",
        text: "MCP rectangle",
        x: 180,
        y: 140,
        width: 160,
        height: 90,
        style: "fillColor=#dae8fc;strokeColor=#6c8ebf;",
      });

    expect(payload.success).toBe(true);
    expect(payload.result.id).toBeTruthy();

    await context.page.waitForFunction(
      (id: string) => {
        const ui = (window as any).ui;
        const graph = ui?.editor?.graph;
        const cell = graph?.getModel?.().getCell?.(id);
        return Boolean(cell);
      },
      payload.result.id,
    );

    await withVerificationScreenshot(
      context,
      "add-cell-of-shape",
      "before-live-state-verification",
      async () => {
        const afterCells = await getCells(context.page);
        expect(afterCells).toHaveLength(beforeCells.length + 1);

        const insertedCell = afterCells.find((cell) => cell.id === payload.result.id);
        expect(insertedCell).toBeDefined();
        expect(insertedCell?.value).toBe("MCP rectangle");
        expect(insertedCell?.x).toBe(180);
        expect(insertedCell?.y).toBe(140);
        expect(insertedCell?.width).toBe(160);
        expect(insertedCell?.height).toBe(90);
        expect(insertedCell?.style).toContain("fillColor=#dae8fc");
        expect(insertedCell?.style).toContain("strokeColor=#6c8ebf");
      },
    );

    await expectNoBrowserErrors(context, "add-cell-of-shape");
    await expectNoServerErrors(context, "add-cell-of-shape", logCountBefore);
  }, 180000);
});
