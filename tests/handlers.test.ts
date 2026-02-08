import { describe, it, beforeEach } from "@std/testing/bdd";
import { assertEquals, assert, assertExists } from "@std/assert";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { handlers } from "../src/tools.ts";
import { diagram } from "../src/diagram_model.ts";

/**
 * Extract and parse the JSON text payload from a CallToolResult.
 * All handlers return text content, so this narrows the union type safely.
 */
function parseResult(result: CallToolResult): any {
  const content = result.content[0];
  if (content.type !== "text") {
    throw new Error(`Expected text content, got ${content.type}`);
  }
  return JSON.parse(content.text);
}

/** Create a vertex via add-cells and return the cell data. */
async function addVertex(args: { x?: number; y?: number; width?: number; height?: number; text?: string; style?: string } = {}) {
  const result = await handlers["add-cells"]({ cells: [{ type: "vertex" as const, ...args }] });
  return parseResult(result).data.results[0].cell;
}

/** Create an edge via add-cells and return the cell data. */
async function addEdge(sourceId: string, targetId: string, text?: string, style?: string) {
  const result = await handlers["add-cells"]({
    cells: [{ type: "edge" as const, source_id: sourceId, target_id: targetId, text, style }],
  });
  return parseResult(result).data.results[0].cell;
}

// Reset diagram state between tests
beforeEach(() => {
  diagram.clear();
});

describe("tool handlers", () => {
  describe("delete-cell-by-id", () => {
    it("should delete an existing cell", async () => {
      const cell = await addVertex({ text: "ToDelete" });
      const result = await handlers["delete-cell-by-id"]({ cell_id: cell.id });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.deleted, cell.id);
    });

    it("should return error for non-existent cell", async () => {
      const result = await handlers["delete-cell-by-id"]({ cell_id: "nope" });
      assertEquals(result.isError, true);
    });

    it("should report cascaded edge deletions", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      await addEdge(a.id, b.id);
      const result = await handlers["delete-cell-by-id"]({ cell_id: a.id });
      const parsed = parseResult(result);
      assertEquals(parsed.data.deleted, a.id);
      assertEquals(parsed.data.cascaded_edges.length, 1);
    });
  });

  describe("delete-edge", () => {
    it("should delete an existing edge", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      const edge = await addEdge(a.id, b.id);
      const result = await handlers["delete-edge"]({ cell_id: edge.id });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.deleted, edge.id);
      assertExists(parsed.data.remaining);
    });

    it("should return error for non-existent cell", async () => {
      const result = await handlers["delete-edge"]({ cell_id: "nope" });
      assertEquals(result.isError, true);
      const parsed = JSON.parse((result.content[0] as any).text);
      assertEquals(parsed.error.code, "CELL_NOT_FOUND");
    });

    it("should return error when target is a vertex, not an edge", async () => {
      const cell = await addVertex({ text: "NotAnEdge" });
      const result = await handlers["delete-edge"]({ cell_id: cell.id });
      assertEquals(result.isError, true);
      const parsed = JSON.parse((result.content[0] as any).text);
      assertEquals(parsed.error.code, "NOT_AN_EDGE");
      assert(parsed.error.message.includes("vertex"));
    });
  });

  describe("edit-edge", () => {
    it("should update edge text", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      const edge = await addEdge(a.id, b.id, "old");
      const result = await handlers["edit-edge"]({
        cell_id: edge.id,
        text: "new label",
      });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.cell.value, "new label");
    });

    it("should return error for non-existent edge", async () => {
      const result = await handlers["edit-edge"]({
        cell_id: "nonexistent",
        text: "X",
      });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "CELL_NOT_FOUND");
    });

    it("should return error when editing a vertex as an edge", async () => {
      const cell = await addVertex({ text: "A" });
      const result = await handlers["edit-edge"]({
        cell_id: cell.id,
        text: "X",
      });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "WRONG_CELL_TYPE");
    });
  });

  describe("list-paged-model", () => {
    it("should return empty page for empty diagram", async () => {
      const result = await handlers["list-paged-model"]({});
      const parsed = parseResult(result);
      assertEquals(parsed.data.totalCells, 0);
      assertEquals(parsed.data.cells.length, 0);
    });

    it("should paginate cells", async () => {
      for (let i = 0; i < 5; i++) {
        await addVertex({ text: `Cell ${i}` });
      }
      const page0 = await handlers["list-paged-model"]({ page: 0, page_size: 2 });
      const parsed0 = parseResult(page0);
      assertEquals(parsed0.data.cells.length, 2);
      assertEquals(parsed0.data.totalPages, 3);
      const page2 = await handlers["list-paged-model"]({ page: 2, page_size: 2 });
      const parsed2 = parseResult(page2);
      assertEquals(parsed2.data.cells.length, 1);
    });

    it("should filter by cell type", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      await addEdge(a.id, b.id);
      const vertexResult = await handlers["list-paged-model"]({
        filter: { cell_type: "vertex" },
      });
      const parsed = parseResult(vertexResult);
      assertEquals(parsed.data.totalCells, 2);
    });

    it("should filter by edge type", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      await addEdge(a.id, b.id);
      const edgeResult = await handlers["list-paged-model"]({
        filter: { cell_type: "edge" },
      });
      const parsed = parseResult(edgeResult);
      assertEquals(parsed.data.totalCells, 1);
    });
  });

  describe("layer operations", () => {
    it("should create, list, set, and get active layer", async () => {
      const createResult = await handlers["create-layer"]({ name: "Network" });
      const created = parseResult(createResult);
      assertEquals(created.data.layer.name, "Network");
      const listResult = await handlers["list-layers"]();
      const layers = parseResult(listResult).data.layers;
      assertEquals(layers.length, 2);
      await handlers["set-active-layer"]({ layer_id: created.data.layer.id });
      const activeResult = await handlers["get-active-layer"]();
      const active = parseResult(activeResult).data.layer;
      assertEquals(active.name, "Network");
    });

    it("should move cell to different layer", async () => {
      const layerResult = await handlers["create-layer"]({ name: "Target" });
      const layerId = parseResult(layerResult).data.layer.id;
      const cell = await addVertex({ text: "Movable" });
      const moveResult = await handlers["move-cell-to-layer"]({
        cell_id: cell.id,
        target_layer_id: layerId,
      });
      const moved = parseResult(moveResult);
      assertEquals(moved.data.cell.parent, layerId);
    });

    it("should return error for set-active-layer with non-existent layer", async () => {
      const result = await handlers["set-active-layer"]({ layer_id: "nonexistent" });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "LAYER_NOT_FOUND");
    });

    it("should return error for move-cell-to-layer with non-existent cell", async () => {
      const layerResult = await handlers["create-layer"]({ name: "Target" });
      const layerId = parseResult(layerResult).data.layer.id;
      const result = await handlers["move-cell-to-layer"]({
        cell_id: "nonexistent",
        target_layer_id: layerId,
      });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "CELL_NOT_FOUND");
    });

    it("should return error for move-cell-to-layer with non-existent layer", async () => {
      const cell = await addVertex({ text: "A" });
      const result = await handlers["move-cell-to-layer"]({
        cell_id: cell.id,
        target_layer_id: "nonexistent",
      });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "LAYER_NOT_FOUND");
    });
  });

  describe("export-diagram", () => {
    it("should return valid XML", async () => {
      await addVertex({ text: "Test" });
      const result = await handlers["export-diagram"]({});
      const parsed = parseResult(result);
      assert(parsed.data.xml.includes("<mxfile"));
      assert(parsed.data.xml.includes("Test"));
      assertEquals(parsed.data.compression, { enabled: false });
    });
  });

  describe("clear-diagram", () => {
    it("should clear all cells", async () => {
      await addVertex({ text: "A" });
      await addVertex({ text: "B" });
      await handlers["clear-diagram"]();
      const stats = await handlers["get-diagram-stats"]();
      const parsed = parseResult(stats);
      assertEquals(parsed.data.stats.total_cells, 0);
    });
  });

  describe("get-diagram-stats", () => {
    it("should return correct stats", async () => {
      await addVertex({ text: "A" });
      await addVertex({ text: "B" });
      const result = await handlers["get-diagram-stats"]();
      const parsed = parseResult(result);
      assertEquals(parsed.data.stats.total_cells, 2);
      assertEquals(parsed.data.stats.vertices, 2);
      assertEquals(parsed.data.stats.edges, 0);
    });
  });

  describe("get-shape-categories", () => {
    it("should include basic and Azure categories", async () => {
      const result = await handlers["get-shape-categories"]();
      const parsed = parseResult(result);
      const categoryIds = parsed.data.categories.map((c: any) => c.id);
      assert(categoryIds.includes("general"));
      assert(categoryIds.includes("flowchart"));
      assert(parsed.data.categories.length > 5);
    });
  });

  describe("get-shapes-in-category", () => {
    it("should return shapes for general category", async () => {
      const result = await handlers["get-shapes-in-category"]({ category_id: "general" });
      const parsed = parseResult(result);
      assert(parsed.data.total > 0);
    });

    it("should return error for unknown category", async () => {
      const result = await handlers["get-shapes-in-category"]({ category_id: "nonexistent" });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "CATEGORY_NOT_FOUND");
    });

    it("should return shapes for an Azure category", async () => {
      const result = await handlers["get-shapes-in-category"]({ category_id: "compute" });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assert(parsed.data.total > 0);
      assert("name" in parsed.data.shapes[0]);
      assert("id" in parsed.data.shapes[0]);
    });

    it("should return shapes for flowchart category", async () => {
      const result = await handlers["get-shapes-in-category"]({ category_id: "flowchart" });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assert(parsed.data.total > 0);
    });
  });

  describe("get-shape-by-name", () => {
    it("should find basic shapes", async () => {
      const result = await handlers["get-shape-by-name"]({ shape_name: "rectangle" });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.shape.name, "rectangle");
    });

    it("should return error for unknown shape", async () => {
      const result = await handlers["get-shape-by-name"]({ shape_name: "xyznonexistent" });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "SHAPE_NOT_FOUND");
    });

    it("should find Azure shapes by exact title", async () => {
      const searchResult = await handlers["search-shapes"]({ queries: ["virtual machine"], limit: 1 });
      const shapeName = parseResult(searchResult).data.results[0].matches[0].name;
      const result = await handlers["get-shape-by-name"]({ shape_name: shapeName });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.shape.name, shapeName);
    });

    it("should find Azure shapes via fuzzy search", async () => {
      const result = await handlers["get-shape-by-name"]({ shape_name: "storage account" });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assert("style" in parsed.data.shape);
    });

    it("should prioritize basic shapes over Azure fuzzy matches", async () => {
      const startResult = await handlers["get-shape-by-name"]({ shape_name: "start" });
      const startParsed = parseResult(startResult);
      assertEquals(startParsed.success, true);
      assertEquals(startParsed.data.shape.name, "start");
      assert(startParsed.data.shape.style.includes("ellipse"));

      const endResult = await handlers["get-shape-by-name"]({ shape_name: "end" });
      const endParsed = parseResult(endResult);
      assertEquals(endParsed.success, true);
      assertEquals(endParsed.data.shape.name, "end");
      assert(endParsed.data.shape.style.includes("ellipse"));
    });
  });

  describe("add-cells", () => {
    it("should add multiple cells and resolve temp IDs", async () => {
      const result = await handlers["add-cells"]({
        cells: [
          { type: "vertex", x: 100, y: 100, text: "A", temp_id: "a" },
          { type: "vertex", x: 300, y: 100, text: "B", temp_id: "b" },
          { type: "edge", source_id: "a", target_id: "b", text: "link" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 3);
      assertEquals(parsed.data.summary.failed, 0);
    });

    it("should support dry_run mode", async () => {
      const result = await handlers["add-cells"]({
        cells: [{ type: "vertex", x: 100, y: 100, text: "DryRun" }],
        dry_run: true,
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.dry_run, true);
      assertEquals(parsed.data.summary.succeeded, 1);
      const stats = await handlers["get-diagram-stats"]();
      const statsParsed = parseResult(stats);
      assertEquals(statsParsed.data.stats.total_cells, 0);
    });

    it("should fail when edge references non-existent source", async () => {
      const result = await handlers["add-cells"]({
        cells: [{ type: "edge", source_id: "nonexistent", target_id: "also-nonexistent" }],
      });
      const parsed = parseResult(result);
      assert(parsed.data.summary.failed > 0);
    });

    it("should resolve temp IDs for edges referencing earlier batch items", async () => {
      const result = await handlers["add-cells"]({
        cells: [
          { type: "vertex", x: 100, y: 100, text: "A", temp_id: "tmp-a" },
          { type: "vertex", x: 300, y: 100, text: "B", temp_id: "tmp-b" },
          { type: "edge", source_id: "tmp-a", target_id: "tmp-b", temp_id: "tmp-e" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 3);
      const edgeResult = parsed.data.results[2];
      assertEquals(edgeResult.success, true);
    });
  });

  describe("edit-cells", () => {
    it("should edit multiple cells", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      const result = await handlers["edit-cells"]({
        cells: [
          { cell_id: a.id, text: "Updated A" },
          { cell_id: b.id, x: 999 },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 2);
    });

    it("should report failure for non-existent cell in batch", async () => {
      const a = await addVertex({ text: "A" });
      const result = await handlers["edit-cells"]({
        cells: [
          { cell_id: a.id, text: "Updated" },
          { cell_id: "nonexistent", text: "Fail" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 1);
      assertEquals(parsed.data.summary.failed, 1);
    });
  });

  describe("add-cells-of-shape", () => {
    it("should add multiple shape cells", async () => {
      const result = await handlers["add-cells-of-shape"]({
        cells: [
          { shape_name: "rectangle", x: 100, y: 100, temp_id: "r1" },
          { shape_name: "decision", x: 300, y: 100, temp_id: "d1" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 2);
      assertEquals(parsed.data.summary.failed, 0);
    });

    it("should return error for empty cells array", async () => {
      const result = await handlers["add-cells-of-shape"]({ cells: [] });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "INVALID_INPUT");
    });

    it("should add Azure shape cells with info", async () => {
      const searchResult = await handlers["search-shapes"]({ queries: ["virtual machine"], limit: 1 });
      const azureName = parseResult(searchResult).data.results[0].matches[0].name;
      const result = await handlers["add-cells-of-shape"]({
        cells: [{ shape_name: azureName, x: 100, y: 100 }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 1);
      assert(parsed.data.results[0].info.includes("Azure icon"));
    });

    it("should include confidence for fuzzy-matched Azure shapes", async () => {
      // Use a partial/approximate name that is NOT an alias hit so it falls
      // through to the fuzzy-search path in resolveShape.
      const result = await handlers["add-cells-of-shape"]({
        cells: [{ shape_name: "defender for cloud", x: 100, y: 100 }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 1);
      assert(parsed.data.results[0].info.includes("matched from search"));
      assert(parsed.data.results[0].confidence > 0);
    });

    it("should handle mixed success and failure in batch", async () => {
      const result = await handlers["add-cells-of-shape"]({
        cells: [
          { shape_name: "rectangle", x: 100, y: 100 },
          { shape_name: "xyznonexistent_shape", x: 200, y: 200 },
          { shape_name: "decision", x: 300, y: 300 },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 2);
      assertEquals(parsed.data.summary.failed, 1);
      assertEquals(parsed.data.success, false);
      assertEquals(parsed.data.results[1].success, false);
      assertEquals(parsed.data.results[1].error.code, "SHAPE_NOT_FOUND");
    });

    it("should use custom dimensions over shape defaults", async () => {
      const result = await handlers["add-cells-of-shape"]({
        cells: [
          { shape_name: "rectangle", x: 50, y: 50, width: 400, height: 200, text: "Big", style: "fillColor=#ff0000;" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.results[0].cell.width, 400);
      assertEquals(parsed.data.results[0].cell.height, 200);
      assertEquals(parsed.data.results[0].cell.value, "Big");
      assertEquals(parsed.data.results[0].cell.style, "fillColor=#ff0000;");
    });
  });

  describe("search-shapes", () => {
    it("should find shapes with queries array", async () => {
      const result = await handlers["search-shapes"]({ queries: ["storage"] });
      const parsed = parseResult(result);
      assertEquals(parsed.data.results.length, 1);
      assert(parsed.data.results[0].matches.length > 0);
    });

    it("should support multiple queries", async () => {
      const result = await handlers["search-shapes"]({
        queries: ["storage", "compute"],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.results.length, 2);
      assertEquals(parsed.data.totalQueries, 2);
    });

    it("should error when queries array is empty", async () => {
      const result = await handlers["search-shapes"]({ queries: [] });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "INVALID_INPUT");
    });

    it("should respect custom limit", async () => {
      const result = await handlers["search-shapes"]({ queries: ["azure"], limit: 3 });
      const parsed = parseResult(result);
      assert(parsed.data.results[0].matches.length <= 3);
    });

    it("should include basic shapes in results", async () => {
      const result = await handlers["search-shapes"]({ queries: ["rectangle"] });
      const parsed = parseResult(result);
      const matches = parsed.data.results[0].matches;
      assert(matches.length > 0);
      assertEquals(matches[0].name, "rectangle");
      assertEquals(matches[0].category, "basic");
      assertEquals(matches[0].confidence, 1.0);
    });

    it("should return basic shapes before Azure icons for matching queries", async () => {
      const result = await handlers["search-shapes"]({ queries: ["diamond"] });
      const parsed = parseResult(result);
      const matches = parsed.data.results[0].matches;
      assert(matches.length > 0);
      assertEquals(matches[0].category, "basic");
    });

    it("should find basic shapes with partial match", async () => {
      const result = await handlers["search-shapes"]({ queries: ["rect"] });
      const parsed = parseResult(result);
      const matches = parsed.data.results[0].matches;
      const basicMatch = matches.find((m: any) => m.name === "rectangle");
      assertExists(basicMatch);
      assertEquals(basicMatch.category, "basic");
    });

    it("should combine basic and Azure results in a single query", async () => {
      const result = await handlers["search-shapes"]({ queries: ["circle", "storage"] });
      const parsed = parseResult(result);
      assertEquals(parsed.data.results.length, 2);
      const circleMatches = parsed.data.results[0].matches;
      assert(circleMatches.some((m: any) => m.category === "basic"));
      const storageMatches = parsed.data.results[1].matches;
      assert(storageMatches.length > 0);
    });
  });

  describe("get-style-presets", () => {
    it("should return preset categories", async () => {
      const result = await handlers["get-style-presets"]();
      const parsed = parseResult(result);
      assert("azure" in parsed.data.presets);
      assert("flowchart" in parsed.data.presets);
      assert("general" in parsed.data.presets);
      assert("edges" in parsed.data.presets);
    });
  });

  describe("set-cell-shape", () => {
    it("should update cells' styles to match shapes", async () => {
      const a = await addVertex({ text: "A" });
      const b = await addVertex({ text: "B" });
      const result = await handlers["set-cell-shape"]({
        cells: [
          { cell_id: a.id, shape_name: "ellipse" },
          { cell_id: b.id, shape_name: "circle" },
        ],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.succeeded, 2);
    });

    it("should error when cells array is empty", async () => {
      const result = await handlers["set-cell-shape"]({ cells: [] });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "INVALID_INPUT");
    });

    it("should report errors for unknown shapes in cells array", async () => {
      const cell = await addVertex({ text: "A" });
      const result = await handlers["set-cell-shape"]({
        cells: [{ cell_id: cell.id, shape_name: "xyznonexistent" }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.failed, 1);
      assertEquals(parsed.data.results[0].error.code, "SHAPE_NOT_FOUND");
    });

    it("should report errors for non-existent cell in cells array", async () => {
      const result = await handlers["set-cell-shape"]({
        cells: [{ cell_id: "nonexistent", shape_name: "rectangle" }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.failed, 1);
    });
  });
});
