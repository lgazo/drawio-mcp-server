import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import {
  createRealEnvironmentContext,
  disposeRealEnvironmentContext,
  resetDiagram,
} from "./harness.js";
import {
  expectNoBrowserErrors,
  expectNoServerErrors,
  withVerificationScreenshot,
} from "./assertions.js";
import { callToolJson } from "./tools.js";
import type { RealEnvironmentContext } from "./types.js";

describe("real environment/add-edge", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("adds an edge through MCP and verifies the live diagram state", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: source } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-cell-of-shape", {
      shape_name: "rectangle",
      text: "Source",
      x: 100,
      y: 140,
      width: 120,
      height: 70,
    });

    const { payload: target } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-cell-of-shape", {
      shape_name: "rectangle",
      text: "Target",
      x: 360,
      y: 140,
      width: 120,
      height: 70,
    });

    expect(source.success).toBe(true);
    expect(target.success).toBe(true);

    const { payload } = await callToolJson<{
      success: boolean;
      result: { id: string; source?: { id?: string }; target?: { id?: string }; value?: string; style?: string };
    }>(context, "add-edge", {
      source_id: source.result.id,
      target_id: target.result.id,
      text: "connects to",
      style: "endArrow=classic;strokeColor=#b85450;html=1;rounded=0;",
    });

    expect(payload.success).toBe(true);
    expect(payload.result.id).toBeTruthy();

    await context.page.waitForFunction(
      ({ edgeId, sourceId, targetId }: { edgeId: string; sourceId: string; targetId: string }) => {
        const ui = (window as any).ui;
        const graph = ui?.editor?.graph;
        const edge = graph?.getModel?.().getCell?.(edgeId);

        return (
          edge &&
          edge.edge === true &&
          edge.source?.id === sourceId &&
          edge.target?.id === targetId &&
          edge.value === "connects to" &&
          String(edge.style || "").includes("strokeColor=#b85450")
        );
      },
      {
        edgeId: payload.result.id,
        sourceId: source.result.id,
        targetId: target.result.id,
      },
    );

    await withVerificationScreenshot(
      context,
      "add-edge",
      "before-live-state-verification",
      async () => {
        const edge = await context.page.evaluate((edgeId: string) => {
          const ui = (window as any).ui;
          const graph = ui?.editor?.graph;
          const cell = graph?.getModel?.().getCell?.(edgeId);

          if (!cell) {
            return null;
          }

          return {
            id: String(cell.id),
            edge: Boolean(cell.edge),
            value: typeof cell.value === "string" ? cell.value : "",
            style: String(cell.style || ""),
            sourceId: cell.source?.id ? String(cell.source.id) : null,
            targetId: cell.target?.id ? String(cell.target.id) : null,
          };
        }, payload.result.id);

        expect(edge).toBeDefined();
        expect(edge).not.toBeNull();
        expect(edge?.edge).toBe(true);
        expect(edge?.value).toBe("connects to");
        expect(edge?.sourceId).toBe(source.result.id);
        expect(edge?.targetId).toBe(target.result.id);
        expect(edge?.style).toContain("strokeColor=#b85450");
      },
    );

    await expectNoBrowserErrors(context, "add-edge");
    await expectNoServerErrors(context, "add-edge", logCountBefore);
  }, 180000);
});
