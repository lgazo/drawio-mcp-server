import { describe, expect, it, jest } from "@jest/globals";

describe("shared tool registry", () => {
  async function loadToolDefinitions() {
    const registry = await import("drawio-mcp-plugin/dist/tool-registry.js");
    return registry.toolDefinitions as Array<{
      name: string;
      params: Set<string>;
    }>;
  }

  async function loadDrawioTools() {
    return import("drawio-mcp-plugin/dist/drawio-tools.js");
  }

  it("contains the new page management tools", async () => {
    const toolDefinitions = await loadToolDefinitions();
    const names = toolDefinitions.map((definition) => definition.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "list-pages",
        "get-current-page",
        "create-page",
        "rename-page",
      ]),
    );
  });

  it("marks page-scoped tools with target_page while preserving global tools", async () => {
    const toolDefinitions = await loadToolDefinitions();
    const registry = new Map(
      toolDefinitions.map((definition) => [definition.name, definition] as const),
    );

    expect(registry.get("add-rectangle")?.params.has("target_page")).toBe(true);
    expect(registry.get("list-paged-model")?.params.has("target_page")).toBe(
      true,
    );
    expect(registry.get("rename-page")?.params.has("page")).toBe(true);
    expect(registry.get("get-shape-by-name")?.params.has("target_page")).toBe(
      false,
    );
  });

  it("marks current pages by stable id instead of object identity", async () => {
    const { serialize_page_info } = await loadDrawioTools();
    const ui = {
      currentPage: {
        getId: () => "page-2",
        getName: () => "Second",
      },
    };
    const page = {
      getId: () => "page-2",
      getName: () => "Second",
    };

    expect(serialize_page_info(ui, page, 1).is_current).toBe(true);
  });

  it("fails create-page when the environment cannot rename pages", async () => {
    const { create_page } = await loadDrawioTools();
    const insertPage = jest.fn();
    const ui = {
      currentPage: {
        getId: () => "page-1",
        getName: () => "First",
      },
      pages: [
        {
          getId: () => "page-1",
          getName: () => "First",
        },
      ],
      insertPage,
    };

    expect(() => create_page(ui, { name: "Named Page" })).toThrow(
      "Draw.io page renaming is not supported in this version; cannot create a named page",
    );
    expect(insertPage).not.toHaveBeenCalled();
  });

  it("fails import-diagram new-page when the environment cannot rename imported pages", async () => {
    const { import_diagram } = await loadDrawioTools();
    const insertPage = jest.fn();
    const originalWindow = (globalThis as { window?: unknown }).window;
    const fakeDocument = {
      documentElement: {
        nodeName: "mxGraphModel",
      },
      getElementsByTagName: () => [],
    };

    (globalThis as { window?: unknown }).window = {
      mxUtils: {
        parseXml: () => fakeDocument,
      },
    };

    try {
      const result = import_diagram(
        {
          currentPage: {
            getId: () => "page-1",
            getName: () => "First",
          },
          pages: [
            {
              getId: () => "page-1",
              getName: () => "First",
            },
          ],
          insertPage,
          editor: {
            graph: {
              getModel: () => ({}),
            },
          },
        },
        {
          data: "<mxGraphModel><root/></mxGraphModel>",
          format: "xml",
          mode: "new-page",
          filename: "Imported.drawio",
        },
      );

      expect(result).toEqual({
        success: false,
        message:
          "Draw.io page renaming is not supported in this version; cannot create a named imported page",
      });
      expect(insertPage).not.toHaveBeenCalled();
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = originalWindow;
      }
    }
  });
});
