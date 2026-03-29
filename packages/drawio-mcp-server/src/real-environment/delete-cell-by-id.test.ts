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

describe("real environment/delete-cell-by-id", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("deletes a cell through MCP and verifies the live diagram state", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: createdPayload } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-cell-of-shape", {
      shape_name: "rectangle",
      text: "Delete me",
      x: 260,
      y: 160,
      width: 120,
      height: 70,
    });

    expect(createdPayload.success).toBe(true);

    const beforeDelete = await getCells(context.page);
    expect(
      beforeDelete.some((cell) => cell.id === createdPayload.result.id),
    ).toBe(true);

    const { payload } = await callToolJson<{
      success: boolean;
      result: unknown;
    }>(context, "delete-cell-by-id", {
      cell_id: createdPayload.result.id,
    });
    expect(payload.success).toBe(true);

    await context.page.waitForFunction((id: string) => {
      const ui = (window as any).ui;
      const graph = ui?.editor?.graph;
      return !graph?.getModel?.().getCell?.(id);
    }, createdPayload.result.id);

    await withVerificationScreenshot(
      context,
      "delete-cell-by-id",
      "before-live-state-verification",
      async () => {
        const afterDelete = await getCells(context.page);
        expect(
          afterDelete.some((cell) => cell.id === createdPayload.result.id),
        ).toBe(false);
        expect(afterDelete).toHaveLength(beforeDelete.length - 1);
      },
    );

    await expectNoBrowserErrors(context, "delete-cell-by-id");
    await expectNoServerErrors(context, "delete-cell-by-id", logCountBefore);
  }, 180000);
});
