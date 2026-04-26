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
import { expectToolSuccess, unwrapToolPayload } from "./test-helpers.js";
import type { RealEnvironmentContext } from "./types.js";

describe("real environment/shapes", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("covers shape discovery, rectangle creation, shape assignment, and cell data", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload: shapeCategoriesPayload } = await callToolJson<any>(
      context,
      "get-shape-categories",
      {},
    );
    const shapeCategories = unwrapToolPayload<any>(shapeCategoriesPayload);
    expect(shapeCategories).toBeDefined();

    const { payload: shapesInCategoryPayload } = await callToolJson<any>(
      context,
      "get-shapes-in-category",
      {
        category_id: "General",
      },
    );
    const shapesInCategory = unwrapToolPayload<any>(shapesInCategoryPayload);
    expect(shapesInCategory).toBeDefined();

    const chosenShapeName = "rectangle";

    const { payload: shapeByNamePayload } = await callToolJson<any>(
      context,
      "get-shape-by-name",
      {
        shape_name: chosenShapeName,
      },
    );
    const shapeByName = unwrapToolPayload<any>(shapeByNamePayload);
    expect(shapeByName).toBeDefined();

    const { payload: rectangle } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 120,
      y: 110,
      width: 150,
      height: 90,
      text: "Rectangle tool",
    });
    expectToolSuccess(rectangle);

    await callToolJson(context, "set-cell-shape", {
      cell_id: rectangle.result.id,
      shape_name: chosenShapeName,
    });

    await callToolJson(context, "set-cell-data", {
      cell_id: rectangle.result.id,
      key: "status",
      value: "verified",
    });

    await withVerificationScreenshot(
      context,
      "shapes",
      "before-live-state-verification",
      async () => {
        const rectangleCell = await getCellById(
          context.page,
          rectangle.result.id,
        );
        expect(rectangleCell).not.toBeNull();
        expect(rectangleCell?.style.length).toBeGreaterThan(0);
        expect(rectangleCell?.attributes.status).toBe("verified");
      },
    );

    await expectNoBrowserErrors(context, "shapes");
    await expectNoServerErrors(context, "shapes", logCountBefore);
  }, 180000);

  it("creates an AWS Lambda shaped cell with the expected AWS style", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const shapeName = "mxgraph.aws4.lambda";

    const { payload: shapeByNamePayload } = await callToolJson<any>(
      context,
      "get-shape-by-name",
      {
        shape_name: shapeName,
      },
    );
    const shapeByName = unwrapToolPayload<any>(shapeByNamePayload);
    expect(shapeByName).toBeDefined();
    expect(String(shapeByName?.style ?? "")).toContain(
      "shape=mxgraph.aws4.resourceIcon",
    );
    expect(String(shapeByName?.style ?? "")).toContain(
      "resIcon=mxgraph.aws4.lambda",
    );
    expect(String(shapeByName?.style ?? "")).toContain("fillColor=#ED7100");

    const { payload } = await callToolJson<{
      success: boolean;
      result: { id: string; style?: string };
    }>(context, "add-cell-of-shape", {
      shape_name: shapeName,
      text: "Lambda",
      x: 180,
      y: 140,
      width: 120,
      height: 120,
    });
    expectToolSuccess(payload);

    await withVerificationScreenshot(
      context,
      "shapes-aws-lambda",
      "before-live-state-verification",
      async () => {
        const liveCellState = await context.page.evaluate((cellId: string) => {
          const maybeWindow = window as any;
          const graph = maybeWindow.ui?.editor?.graph;
          const cell = graph?.getModel?.().getCell?.(cellId);
          return {
            cellStyle: cell?.style ?? null,
            stateStyle: graph?.view?.getState?.(cell)?.style ?? null,
          };
        }, payload.result.id);

        const exportedXml = await context.page.evaluate(() => {
          const maybeWindow = window as any;
          const editor = maybeWindow.ui?.editor;
          const xmlNode = editor?.getGraphXml?.();
          return (window as any).mxUtils?.getXml?.(xmlNode) ?? "";
        });

        const lambdaCell = await getCellById(context.page, payload.result.id);
        expect(lambdaCell).not.toBeNull();
        expect(String(liveCellState.cellStyle ?? "")).toContain(
          "mxgraph.aws4.lambda",
        );
        expect(exportedXml).toContain(`id="${payload.result.id}"`);
        expect(exportedXml).toContain("mxgraph.aws4.lambda");

        const exportedLambda = await callToolJson<any>(
          context,
          "list-paged-model",
          {
            page: 0,
            page_size: 20,
            filter: {
              ids: [payload.result.id],
            },
          },
        );
        const lambdaEntry = unwrapToolPayload<any>(exportedLambda.payload);
        const lambdaCells = Array.isArray(lambdaEntry?.cells)
          ? lambdaEntry.cells
          : Array.isArray(lambdaEntry)
            ? lambdaEntry
            : [];
        const lambdaCellFromTool = lambdaCells.find(
          (cell: any) => cell.id === payload.result.id,
        );

        expect(lambdaCellFromTool).toBeDefined();
        expect(exportedXml).toContain("mxgraph.aws4.lambda");
      },
    );

    await expectNoBrowserErrors(context, "shapes-aws-lambda");
    await expectNoServerErrors(context, "shapes-aws-lambda", logCountBefore);
  }, 180000);

  it("applies AWS Lambda style through set-cell-shape and preserves it in the live diagram", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const shapeName = "mxgraph.aws4.lambda";

    const { payload: rectangle } = await callToolJson<{
      success: boolean;
      result: { id: string };
    }>(context, "add-rectangle", {
      x: 220,
      y: 180,
      width: 120,
      height: 120,
      text: "Lambda by shape",
    });
    expectToolSuccess(rectangle);

    await callToolJson(context, "set-cell-shape", {
      cell_id: rectangle.result.id,
      shape_name: shapeName,
    });

    await withVerificationScreenshot(
      context,
      "shapes-aws-lambda-set-cell-shape",
      "before-live-state-verification",
      async () => {
        const exportedXml = await context.page.evaluate(() => {
          const maybeWindow = window as any;
          const editor = maybeWindow.ui?.editor;
          const xmlNode = editor?.getGraphXml?.();
          return (window as any).mxUtils?.getXml?.(xmlNode) ?? "";
        });

        const lambdaCell = await getCellById(context.page, rectangle.result.id);
        expect(lambdaCell).not.toBeNull();
        expect(exportedXml).toContain(`id="${rectangle.result.id}"`);
        expect(exportedXml).toContain("mxgraph.aws4.lambda");
      },
    );

    await expectNoBrowserErrors(context, "shapes-aws-lambda-set-cell-shape");
    await expectNoServerErrors(
      context,
      "shapes-aws-lambda-set-cell-shape",
      logCountBefore,
    );
  }, 180000);

  const vendorCases: Array<{
    label: string;
    shape_name: string;
    keyFragment: string;
  }> = [
    {
      label: "GCP search marker",
      shape_name: "mxgraph.gcp2.search",
      keyFragment: "mxgraph.gcp2.search",
    },
    {
      label: "Azure compute Virtual_Machine",
      shape_name: "mxgraph.azure2.compute.virtual_machine",
      keyFragment: "Virtual_Machine.svg",
    },
    {
      label: "Cisco19 l2_switch",
      shape_name: "mxgraph.cisco19.l2_switch",
      keyFragment: "prIcon=l2_switch",
    },
    {
      label: "CiscoSafe capability anti_malware",
      shape_name: "mxgraph.cisco_safe.capability.anti_malware",
      keyFragment: "mxgraph.cisco_safe.capability.anti_malware",
    },
  ];

  for (const vendorCase of vendorCases) {
    it(
      `resolves and renders ${vendorCase.label} from runtime-extracted catalog`,
      async () => {
        await resetDiagram(context);
        context.browserMessages.length = 0;
        const logCountBefore = context.logger.entries.length;

        const { payload: shapeByNamePayload } = await callToolJson<any>(
          context,
          "get-shape-by-name",
          { shape_name: vendorCase.shape_name },
        );
        const shapeByName = unwrapToolPayload<any>(shapeByNamePayload);
        expect(shapeByName).toBeDefined();
        expect(shapeByName).not.toBeNull();
        expect(String(shapeByName?.style ?? "")).toContain(
          vendorCase.keyFragment,
        );

        const { payload } = await callToolJson<{
          success: boolean;
          result: { id: string; style?: string };
        }>(context, "add-cell-of-shape", {
          shape_name: vendorCase.shape_name,
          text: vendorCase.label,
          x: 200,
          y: 160,
          width: 120,
          height: 120,
        });
        expectToolSuccess(payload);

        const screenshotLabel = `shapes-${vendorCase.shape_name.replace(
          /[^a-z0-9]+/gi,
          "-",
        )}`;

        await withVerificationScreenshot(
          context,
          screenshotLabel,
          "before-live-state-verification",
          async () => {
            const exportedXml = await context.page.evaluate(() => {
              const maybeWindow = window as any;
              const editor = maybeWindow.ui?.editor;
              const xmlNode = editor?.getGraphXml?.();
              return (window as any).mxUtils?.getXml?.(xmlNode) ?? "";
            });

            const cell = await getCellById(context.page, payload.result.id);
            expect(cell).not.toBeNull();
            expect(exportedXml).toContain(`id="${payload.result.id}"`);
            expect(exportedXml).toContain(vendorCase.keyFragment);
          },
        );

        await expectNoBrowserErrors(context, screenshotLabel);
        await expectNoServerErrors(context, screenshotLabel, logCountBefore);
      },
      180000,
    );
  }
});
