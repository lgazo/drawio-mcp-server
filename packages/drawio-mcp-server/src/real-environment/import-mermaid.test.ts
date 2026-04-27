import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import {
  createRealEnvironmentContext,
  disposeRealEnvironmentContext,
  resetDiagram,
} from "./harness.js";
import { expectNoBrowserErrors, expectNoServerErrors } from "./assertions.js";
import { callToolJson } from "./tools.js";
import type { RealEnvironmentContext } from "./types.js";

const FLOWCHART = "graph TD\nA[Start] --> B[Stop]";

type PageInfo = {
  index: number;
  id: string;
  name: string;
  is_current: boolean;
};

describe("real environment/import-mermaid", () => {
  let context: RealEnvironmentContext;

  beforeAll(async () => {
    context = await createRealEnvironmentContext();
  }, 180000);

  afterAll(async () => {
    await disposeRealEnvironmentContext(context);
  });

  it("native mode converts a flowchart to native cells on the target page", async () => {
    await resetDiagram(context);
    context.browserMessages.length = 0;
    const logCountBefore = context.logger.entries.length;

    const { payload } = await callToolJson<{
      success: boolean;
      result?: { mode?: string; cells?: number; xml?: string };
      message?: string;
    }>(context, "import-mermaid", {
      target_page: { index: 0 },
      mermaid_source: FLOWCHART,
      mode: "native",
      insert_mode: "add",
    });

    expect(payload.success).toBe(true);
    expect(payload.result?.mode).toBe("native");
    expect(typeof payload.result?.xml).toBe("string");
    expect(payload.result?.xml ?? "").toContain("mxGraphModel");

    await context.page.waitForFunction(() => {
      const ui = (window as any).ui;
      const model = ui?.editor?.graph?.getModel?.();
      const cells = Object.values(model?.cells ?? {}) as any[];
      return cells.some((cell) => cell?.vertex === true);
    });

    await expectNoBrowserErrors(context, "import-mermaid:native");
    await expectNoServerErrors(
      context,
      "import-mermaid:native",
      logCountBefore,
    );
  }, 180000);

  it("embed mode produces XML carrying the mermaidData attribute", async () => {
    await resetDiagram(context);

    const { payload } = await callToolJson<{
      success: boolean;
      result?: { mode?: string; cells?: number; xml?: string };
      message?: string;
    }>(context, "import-mermaid", {
      target_page: { index: 0 },
      mermaid_source: FLOWCHART,
      mode: "embed",
      insert_mode: "replace",
    });

    expect(payload.success).toBe(true);
    expect(payload.result?.mode).toBe("embed");
    expect(payload.result?.xml ?? "").toContain("mermaidData");
    expect(payload.result?.xml ?? "").toContain("shape=image");
  }, 180000);

  it("requires target_page for replace and add modes", async () => {
    await resetDiagram(context);

    const result = await context.client.callTool({
      name: "import-mermaid",
      arguments: {
        mermaid_source: FLOWCHART,
        mode: "native",
        insert_mode: "add",
      },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text?: string }>;
    expect(String(content[0]?.text ?? "")).toContain(
      "`target_page` is required",
    );
  }, 180000);

  it("allows new-page imports without target_page", async () => {
    await resetDiagram(context);

    const { payload: beforePagesPayload } = await callToolJson<{
      success: boolean;
      result: PageInfo[];
    }>(context, "list-pages", {});
    expect(beforePagesPayload.success).toBe(true);

    const { payload } = await callToolJson<{
      success: boolean;
      result?: { mode?: string; xml?: string };
    }>(context, "import-mermaid", {
      mermaid_source: FLOWCHART,
      mode: "native",
      insert_mode: "new-page",
    });

    expect(payload.success).toBe(true);
    expect(payload.result?.mode).toBe("native");
    expect(payload.result?.xml ?? "").toContain("mxGraphModel");

    const { payload: afterPagesPayload } = await callToolJson<{
      success: boolean;
      result: PageInfo[];
    }>(context, "list-pages", {});
    expect(afterPagesPayload.success).toBe(true);
    expect(afterPagesPayload.result).toHaveLength(
      beforePagesPayload.result.length + 1,
    );
    expect(afterPagesPayload.result.at(-1)?.is_current).toBe(true);
  }, 180000);
});
