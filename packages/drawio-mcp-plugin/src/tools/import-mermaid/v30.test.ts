import { describe, expect, it, jest } from "@jest/globals";

// Must register the mock BEFORE any import of the module under test,
// because shared.ts (imported transitively by v30.ts) calls import_diagram.
jest.unstable_mockModule("../../drawio-tools.js", () => ({
  import_diagram: jest.fn((_ui: any, _options: any) => ({
    success: true,
    message: "Diagram imported successfully (added to current diagram)",
    cells: 1,
  })),
}));

// Dynamic import after mock registration (ESM top-level await)
const { import_mermaid } = await import("./v30.js");

const FLOWCHART = "graph TD\nA[Start] --> B[Stop]";

function makeUi(overrides: Partial<Record<string, any>> = {}) {
  return {
    // v30.ts guards on parseMermaidDiagram being a function; default to a no-op so
    // embed-mode tests that only supply parseMermaidImage still pass the guard.
    parseMermaidDiagram: overrides.parseMermaidDiagram ?? jest.fn(),
    parseMermaidImage: overrides.parseMermaidImage,
    editor: {
      graph: {
        model: {
          beginUpdate: () => {},
          endUpdate: () => {},
          getRoot: () => ({}),
          getChildAt: () => null,
        },
      },
    },
  };
}

describe("import_mermaid v30", () => {
  it("uses parseMermaidImage for embed mode", async () => {
    const parseMermaidImage = jest.fn(
      (_source: string, success: (xml: string) => void) => {
        success(
          '<mxGraphModel><root><UserObject mermaidData="{}"/><mxCell style="shape=image"/></root></mxGraphModel>',
        );
      },
    );
    const ui = makeUi({ parseMermaidImage });
    const result = (await import_mermaid(ui, {
      mermaid_source: FLOWCHART,
      mode: "embed",
      insert_mode: "add",
    })) as any;
    expect(parseMermaidImage).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.mode).toBe("embed");
    expect(result.xml).toContain("mermaidData");
  });

  it("uses parseMermaidDiagram with 5 args for native mode", async () => {
    const parseMermaidDiagram = jest.fn(
      (
        _source: string,
        _config: unknown,
        success: (xml: string) => void,
      ) => {
        success("<mxGraphModel><root/></mxGraphModel>");
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
});
