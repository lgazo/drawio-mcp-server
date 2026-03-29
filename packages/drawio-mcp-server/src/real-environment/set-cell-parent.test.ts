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

describe("real environment/set-cell-parent", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("reparents a child cell through MCP and verifies the live diagram state", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: parentPayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-cell-of-shape", {
        shape_name: "rectangle",
        text: "Parent",
        x: 320,
        y: 160,
        width: 220,
        height: 140,
      });

    const { payload: childPayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-cell-of-shape", {
        shape_name: "rectangle",
        text: "Child",
        x: 120,
        y: 80,
        width: 100,
        height: 60,
      });

    expect(parentPayload.success).toBe(true);
    expect(childPayload.success).toBe(true);

    const beforeCells = await getCells(context.page);
    const childBefore = beforeCells.find((cell) => cell.id === childPayload.result.id);
    expect(childBefore).toBeDefined();
    expect(childBefore?.parentId).not.toBe(parentPayload.result.id);

    const { payload } = await callToolJson<{
      success: boolean;
      result: { cell_id: string; parent_id: string };
    }>(context, "set-cell-parent", {
        cell_id: childPayload.result.id,
        parent_id: parentPayload.result.id,
      });

    expect(payload.success).toBe(true);
    expect(payload.result.cell_id).toBe(childPayload.result.id);
    expect(payload.result.parent_id).toBe(parentPayload.result.id);

    await context.page.waitForFunction(
      ({ childId, parentId }: { childId: string; parentId: string }) => {
        const ui = (window as any).ui;
        const graph = ui?.editor?.graph;
        const child = graph?.getModel?.().getCell?.(childId);
        return child?.parent?.id === parentId;
      },
      {
        childId: childPayload.result.id,
        parentId: parentPayload.result.id,
      },
    );

    await withVerificationScreenshot(
      context,
      "set-cell-parent",
      "before-live-state-verification",
      async () => {
        const afterCells = await getCells(context.page);
        const childAfter = afterCells.find((cell) => cell.id === childPayload.result.id);
        expect(childAfter).toBeDefined();
        expect(childAfter?.parentId).toBe(parentPayload.result.id);
      },
    );

    await expectNoBrowserErrors(context, "set-cell-parent");
    await expectNoServerErrors(context, "set-cell-parent", logCountBefore);
  }, 180000);
});
