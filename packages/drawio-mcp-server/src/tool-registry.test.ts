import { describe, expect, it, jest } from "@jest/globals";

describe("shared tool registry", () => {
  async function loadToolDefinitions() {
    const registry = await import("drawio-mcp-plugin/dist/tool-registry.js");
    return registry.toolDefinitions as Array<{
      name: string;
      params: Set<string>;
      handler: (ui: any, options: Record<string, unknown>) => unknown;
      pageExecution?: {
        mode: "visible-page" | "background-page" | "hybrid-page";
        mutates?: boolean;
        allow_background?: (options: Record<string, unknown>) => boolean;
        sync_live_current_page_state?: boolean;
      };
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

  it("classifies background-safe and UI-bound page tools in the shared registry", async () => {
    const toolDefinitions = await loadToolDefinitions();
    const registry = new Map(
      toolDefinitions.map((definition) => [definition.name, definition] as const),
    );

    expect(registry.get("add-rectangle")?.pageExecution?.mode).toBe(
      "background-page",
    );
    expect(registry.get("get-selected-cell")?.pageExecution?.mode).toBe(
      "visible-page",
    );
    expect(registry.get("export-diagram")?.pageExecution?.mode).toBe(
      "hybrid-page",
    );
    expect(
      registry
        .get("export-diagram")
        ?.pageExecution?.allow_background?.({ size: "page" }),
    ).toBe(true);
    expect(
      registry
        .get("export-diagram")
        ?.pageExecution?.allow_background?.({ selection_only: true }),
    ).toBe(false);
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

  it("runs background-safe tools on off-page models without selecting the page", async () => {
    const toolDefinitions = await loadToolDefinitions();
    const registry = new Map(
      toolDefinitions.map((definition) => [definition.name, definition] as const),
    );
    const handler = registry.get("add-rectangle")?.handler;
    expect(handler).toBeDefined();

    const originalWindow = (globalThis as { window?: unknown }).window;
    const originalDocument = (globalThis as { document?: unknown }).document;
    const body = {
      appendChild: jest.fn((node: any) => {
        node.parentNode = body;
      }),
      removeChild: jest.fn((node: any) => {
        node.parentNode = null;
      }),
    };
    (globalThis as { window?: unknown }).window = {
      mxEvent: {
        CHANGE: "change",
      },
    };
    (globalThis as { document?: unknown }).document = { body };

    const currentPage = {
      getId: () => "page-1",
      getName: () => "Current",
      root: { id: "current-root" },
      viewState: { defaultParent: "current-layer" },
    };
    const targetPage: {
      getId: () => string;
      getName: () => string;
      root: { id: string };
      viewState: { defaultParent: string; background: string };
      graphModelNode: { cached: boolean } | null;
      needsUpdate?: boolean;
      setDiagramModified: jest.Mock;
    } = {
      getId: () => "page-2",
      getName: () => "Target",
      root: { id: "target-root" },
      viewState: {
        defaultParent: "target-layer",
        background: "#ffffff",
      },
      graphModelNode: { cached: true },
      setDiagramModified: jest.fn(),
    };

    const backgroundListeners = new Set<() => void>();
    const tempModel = {
      beginUpdate: jest.fn(),
      endUpdate: jest.fn(),
      getCell: jest.fn(),
      addListener: jest.fn((_eventName: string, listener: () => void) => {
        backgroundListeners.add(listener);
      }),
      removeListener: jest.fn((listener: () => void) => {
        backgroundListeners.delete(listener);
      }),
      setRoot: jest.fn(),
    };
    const tempGraph = {
      container: {},
      getModel: jest.fn(() => tempModel),
      getDefaultParent: jest.fn(() => "target-layer"),
      insertVertex: jest.fn(() => {
        for (const listener of backgroundListeners) {
          listener();
        }
        return { id: "rect-1" };
      }),
      setViewState: jest.fn(),
      setAdaptiveColors: jest.fn(),
      setBackgroundImage: jest.fn(),
      destroy: jest.fn(),
    };
    const fileChanged = jest.fn();
    const ui = {
      pages: [currentPage, targetPage],
      currentPage,
      selectPage: jest.fn(),
      updatePageRoot: jest.fn((page: any) => page),
      createTemporaryGraph: jest.fn(() => tempGraph),
      getCurrentFile: jest.fn(() => ({
        fileChanged,
      })),
      editor: {
        graph: {
          getStylesheet: jest.fn(() => ({ name: "live-stylesheet" })),
          getModel: jest.fn(() => ({
            root: currentPage.root,
          })),
          getViewState: jest.fn(() => currentPage.viewState),
        },
      },
    };

    try {
      const result = handler?.(ui, {
        target_page: { id: "page-2" },
        text: "Background rectangle",
      }) as { id: string };

      expect(result.id).toBe("rect-1");
      expect(ui.selectPage).not.toHaveBeenCalled();
      expect(ui.updatePageRoot).toHaveBeenCalledWith(targetPage);
      expect(tempGraph.setViewState).toHaveBeenCalledWith(targetPage.viewState);
      expect(targetPage.needsUpdate).toBe(true);
      expect(targetPage.graphModelNode).toBeNull();
      expect(targetPage.setDiagramModified).toHaveBeenCalledWith(true);
      expect(fileChanged).toHaveBeenCalledTimes(1);
      expect(body.appendChild).toHaveBeenCalledTimes(1);
      expect(tempGraph.destroy).toHaveBeenCalledTimes(1);
      expect(tempModel.removeListener).toHaveBeenCalledTimes(1);
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = originalWindow;
      }

      if (originalDocument === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document?: unknown }).document = originalDocument;
      }
    }
  });

  it("falls back to visible-page execution when background graph support is unavailable", async () => {
    const toolDefinitions = await loadToolDefinitions();
    const registry = new Map(
      toolDefinitions.map((definition) => [definition.name, definition] as const),
    );
    const handler = registry.get("add-rectangle")?.handler;
    expect(handler).toBeDefined();

    const liveModel = {
      beginUpdate: jest.fn(),
      endUpdate: jest.fn(),
      getCell: jest.fn(),
    };
    const liveGraph = {
      getModel: jest.fn(() => liveModel),
      getDefaultParent: jest.fn(() => "visible-layer"),
      insertVertex: jest.fn(() => ({ id: "visible-rect" })),
    };
    const currentPage = {
      getId: () => "page-1",
      getName: () => "Current",
    };
    const targetPage = {
      getId: () => "page-2",
      getName: () => "Target",
    };
    const ui = {
      pages: [currentPage, targetPage],
      currentPage,
      selectPage: jest.fn(),
      editor: {
        graph: liveGraph,
      },
    };

    const result = handler?.(ui, {
      target_page: { id: "page-2" },
      text: "Visible fallback",
    }) as { id: string };

    expect(result.id).toBe("visible-rect");
    expect(ui.selectPage).toHaveBeenCalledWith(targetPage);
  });

  it("cleans up temporary graph resources when background setup fails", async () => {
    const toolDefinitions = await loadToolDefinitions();
    const registry = new Map(
      toolDefinitions.map((definition) => [definition.name, definition] as const),
    );
    const handler = registry.get("add-rectangle")?.handler;
    expect(handler).toBeDefined();

    const originalWindow = (globalThis as { window?: unknown }).window;
    const originalDocument = (globalThis as { document?: unknown }).document;
    const body = {
      appendChild: jest.fn((node: any) => {
        node.parentNode = body;
      }),
      removeChild: jest.fn((node: any) => {
        node.parentNode = null;
      }),
    };
    (globalThis as { window?: unknown }).window = {
      mxEvent: {
        CHANGE: "change",
      },
    };
    (globalThis as { document?: unknown }).document = { body };

    const currentPage = {
      getId: () => "page-1",
      getName: () => "Current",
      root: { id: "current-root" },
      viewState: { defaultParent: "current-layer" },
    };
    const targetPage = {
      getId: () => "page-2",
      getName: () => "Target",
      root: { id: "target-root" },
      viewState: { defaultParent: "target-layer" },
    };
    const tempModel = {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      setRoot: jest.fn(),
      getCell: jest.fn(),
      beginUpdate: jest.fn(),
      endUpdate: jest.fn(),
    };
    const tempGraph = {
      container: {},
      getModel: jest.fn(() => tempModel),
      setViewState: jest.fn(() => {
        throw new Error("boom");
      }),
      destroy: jest.fn(),
    };
    const ui = {
      pages: [currentPage, targetPage],
      currentPage,
      selectPage: jest.fn(),
      updatePageRoot: jest.fn((page: any) => page),
      createTemporaryGraph: jest.fn(() => tempGraph),
      editor: {
        graph: {
          getStylesheet: jest.fn(() => ({ name: "live-stylesheet" })),
        },
      },
    };

    try {
      expect(() =>
        handler?.(ui, {
          target_page: { id: "page-2" },
          text: "Broken background setup",
        }),
      ).toThrow("boom");
      expect(tempModel.removeListener).toHaveBeenCalledTimes(1);
      expect(tempGraph.destroy).toHaveBeenCalledTimes(1);
      expect(body.removeChild).toHaveBeenCalledTimes(1);
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = originalWindow;
      }

      if (originalDocument === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document?: unknown }).document = originalDocument;
      }
    }
  });

  it("keeps UI-bound tools on the visible-page execution path", async () => {
    const toolDefinitions = await loadToolDefinitions();
    const registry = new Map(
      toolDefinitions.map((definition) => [definition.name, definition] as const),
    );
    const handler = registry.get("get-selected-cell")?.handler;
    expect(handler).toBeDefined();

    const selection = { id: "selected-cell" };
    const currentPage = {
      getId: () => "page-1",
      getName: () => "Current",
    };
    const targetPage = {
      getId: () => "page-2",
      getName: () => "Target",
    };
    const ui = {
      pages: [currentPage, targetPage],
      currentPage,
      selectPage: jest.fn(),
      editor: {
        graph: {
          getSelectionCell: jest.fn(() => selection),
        },
      },
    };

    expect(
      handler?.(ui, {
        target_page: { id: "page-2" },
      }),
    ).toBe(selection);
    expect(ui.selectPage).toHaveBeenCalledWith(targetPage);
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
