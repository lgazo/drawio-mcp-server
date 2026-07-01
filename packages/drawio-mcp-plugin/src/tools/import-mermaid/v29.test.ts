import { describe, expect, it, jest } from "@jest/globals";

// Must register the mock BEFORE any import of the module under test,
// because shared.ts (imported transitively by v29.ts) calls import_diagram.
jest.unstable_mockModule("../../drawio-tools.js", () => ({
  import_diagram: jest.fn((_ui: any, _options: any) => ({
    success: true,
    message: "Diagram imported successfully (added to current diagram)",
    cells: 0,
  })),
}));

// Dynamic import after mock registration (ESM top-level await)
const { import_mermaid } = await import("./v29.js");

const FLOWCHART = "graph TD\nA[Start] --> B[Stop]";

function makeUi(overrides: Partial<Record<string, any>> = {}) {
  return {
    parseMermaidDiagram: overrides.parseMermaidDiagram,
    editor: {
      graph: {
        model: {
          beginUpdate() {},
          endUpdate() {},
          getRoot: () => ({}),
          getChildAt: () => null,
        },
      },
    },
  };
}

describe("import_mermaid v29", () => {
  it("passes enableParser=true for native mode", async () => {
    const parseMermaidDiagram = jest.fn(
      (
        _s: string,
        _cfg: unknown,
        success: (xml: string) => void,
        _err: unknown,
        _perr: unknown,
        enableParser: boolean,
      ) => {
        expect(enableParser).toBe(true);
        success("<mxGraphModel/>");
      },
    );
    const ui = makeUi({ parseMermaidDiagram });
    const result = (await import_mermaid(ui, {
      mermaid_source: FLOWCHART,
      mode: "native",
      insert_mode: "add",
    })) as any;
    expect(parseMermaidDiagram).toHaveBeenCalled();
    expect(result.mode).toBe("native");
  });

  it("passes enableParser=false for embed mode", async () => {
    const parseMermaidDiagram = jest.fn(
      (
        _s: string,
        _cfg: unknown,
        success: (xml: string) => void,
        _err: unknown,
        _perr: unknown,
        enableParser: boolean,
      ) => {
        expect(enableParser).toBe(false);
        success(
          '<mxGraphModel><UserObject mermaidData="{}"/></mxGraphModel>',
        );
      },
    );
    const ui = makeUi({ parseMermaidDiagram });
    const result = (await import_mermaid(ui, {
      mermaid_source: FLOWCHART,
      mode: "embed",
      insert_mode: "add",
    })) as any;
    expect(result.mode).toBe("embed");
    expect(result.xml).toContain("mermaidData");
  });
});
