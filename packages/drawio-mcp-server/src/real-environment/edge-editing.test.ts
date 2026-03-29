import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

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
import { callToolJson } from "./tools.js";
import { expectToolSuccess } from "./test-helpers.js";
import type { RealEnvironmentContext } from "./types.js";

describe("real environment/edge editing", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("covers edge editing with target change, style change, and waypoints", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: source } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 120,
      y: 110,
      width: 150,
      height: 90,
      text: "Source",
    });
    const { payload: target } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 360,
      y: 110,
      width: 150,
      height: 90,
      text: "Target",
    });
    const { payload: alternateTarget } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 620,
      y: 110,
      width: 150,
      height: 90,
      text: "Alternate target",
    });

    expectToolSuccess(source);
    expectToolSuccess(target);
    expectToolSuccess(alternateTarget);

    const { payload: initialEdge } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-edge", {
      source_id: source.result.id,
      target_id: target.result.id,
      text: "initial edge",
    });
    expectToolSuccess(initialEdge);

    await callToolJson(context, "edit-edge", {
      cell_id: initialEdge.result.id,
      text: "edited edge",
      target_id: alternateTarget.result.id,
      style: "endArrow=classic;strokeColor=#9673a6;html=1;rounded=0;",
      points: [{ x: 500, y: 70 }],
    });

    await withVerificationScreenshot(
      context,
      "edge-editing",
      "before-live-state-verification",
      async () => {
        const edge = await getCellById(context.page, initialEdge.result.id);
        expect(edge).not.toBeNull();
        expect(edge?.edge).toBe(true);
        expect(edge?.value).toBe("edited edge");
        expect(edge?.sourceId).toBe(source.result.id);
        expect(edge?.targetId).toBe(alternateTarget.result.id);
        expect(edge?.style).toContain("strokeColor=#9673a6");
        expect(edge?.points).toHaveLength(1);
        expect(edge?.points[0]?.x).toBe(500);
        expect(edge?.points[0]?.y).toBe(70);
      },
    );

    await expectNoBrowserErrors(context, "edge-editing");
    await expectNoServerErrors(context, "edge-editing", logCountBefore);
  }, 180000);
});
