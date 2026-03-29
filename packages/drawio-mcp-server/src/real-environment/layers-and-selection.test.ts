import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import {
  createRealEnvironmentContext,
  disposeRealEnvironmentContext,
  getCellById,
  resetDiagram,
  selectCell,
} from "./harness.js";
import {
  expectNoBrowserErrors,
  expectNoServerErrors,
  withVerificationScreenshot,
} from "./assertions.js";
import { callToolJson } from "./tools.js";
import { expectToolSuccess, unwrapToolPayload } from "./test-helpers.js";
import type { RealEnvironmentContext } from "./types.js";

describe("real environment/layers and selection", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("covers layer creation, activation, move-to-layer, selected cell, and paged model", async () => {
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
      text: "Layered rectangle",
    });
    expectToolSuccess(rectangle);

    const { payload: createdLayer } = await callToolJson<{
      success: boolean;
      result: { id: string; name: string };
    }>(context, "create-layer", {
      name: "Verification Layer",
    });
    expectToolSuccess(createdLayer);

    const { payload: layersPayload } = await callToolJson<any>(
      context,
      "list-layers",
      {},
    );
    const layers = unwrapToolPayload<any[]>(layersPayload);
    expect(Array.isArray(layers)).toBe(true);
    expect(layers.some((layer) => layer.id === createdLayer.result.id)).toBe(true);

    await callToolJson(context, "set-active-layer", {
      layer_id: createdLayer.result.id,
    });

    const { payload: activeLayerPayload } = await callToolJson<any>(
      context,
      "get-active-layer",
      {},
    );
    const activeLayer = unwrapToolPayload<any>(activeLayerPayload);
    expect(activeLayer?.id).toBe(createdLayer.result.id);

    await callToolJson(context, "move-cell-to-layer", {
      cell_id: rectangle.result.id,
      target_layer_id: createdLayer.result.id,
    });

    await selectCell(context.page, rectangle.result.id);
    const { payload: selectedCellPayload } = await callToolJson<any>(
      context,
      "get-selected-cell",
      {},
    );
    const selectedCell = unwrapToolPayload<any>(selectedCellPayload);
    expect(String(selectedCell?.id ?? "")).toBe(rectangle.result.id);

    const { payload: pagedModelPayload } = await callToolJson<any>(
      context,
      "list-paged-model",
      {
        page: 0,
        page_size: 20,
        filter: {
          ids: [rectangle.result.id],
        },
      },
    );
    const pagedModel = unwrapToolPayload<any>(pagedModelPayload);

    const pagedCells = Array.isArray(pagedModel?.cells)
      ? pagedModel.cells
      : Array.isArray(pagedModel)
        ? pagedModel
        : [];
    expect(pagedCells.some((cell: any) => cell.id === rectangle.result.id)).toBe(true);

    await withVerificationScreenshot(
      context,
      "layers-and-selection",
      "before-live-state-verification",
      async () => {
        const rectangleCell = await getCellById(context.page, rectangle.result.id);
        expect(rectangleCell).not.toBeNull();
        expect(rectangleCell?.parentId).toBe(createdLayer.result.id);
      },
    );

    await expectNoBrowserErrors(context, "layers-and-selection");
    await expectNoServerErrors(context, "layers-and-selection", logCountBefore);
  }, 180000);
});
