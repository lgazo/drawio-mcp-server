import { describe, expect, it } from "@jest/globals";

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
});
