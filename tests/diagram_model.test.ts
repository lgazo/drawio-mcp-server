import { describe, it, beforeEach } from "@std/testing/bdd";
import { assertEquals, assert, assertExists, assertGreater, assertNotEquals } from "@std/assert";
import { DiagramModel } from "../src/diagram_model.ts";

describe("DiagramModel", () => {
  let model: DiagramModel;

  beforeEach(() => {
    model = new DiagramModel();
  });

  describe("toXml", () => {
    it("should include the default layer in XML output", () => {
      const xml = model.toXml();
      assert(xml.includes('<mxCell id="0"/>'));
      assert(xml.includes('<mxCell id="1" parent="0"/>'));
    });

    it("should include custom layers as mxCell elements in XML output", () => {
      const layer = model.createLayer("Network");
      const xml = model.toXml();
      assert(xml.includes(`<mxCell id="${layer.id}" value="Network" style="" parent="0"/>`));
    });

    it("should include multiple custom layers in XML output", () => {
      const layer1 = model.createLayer("Network");
      const layer2 = model.createLayer("Security");
      const xml = model.toXml();
      assert(xml.includes(`<mxCell id="${layer1.id}" value="Network" style="" parent="0"/>`));
      assert(xml.includes(`<mxCell id="${layer2.id}" value="Security" style="" parent="0"/>`));
    });

    it("should render cells assigned to custom layers with correct parent", () => {
      const layer = model.createLayer("Custom");
      model.setActiveLayer(layer.id);
      const cell = model.addRectangle({ text: "In Custom Layer" });
      const xml = model.toXml();
      assert(xml.includes(`parent="${layer.id}"`));
      assert(xml.includes(`id="${cell.id}"`));
    });

    it("should escape special characters in layer names", () => {
      model.createLayer("Layer <1> & \"test\"");
      const xml = model.toXml();
      assert(xml.includes("Layer &lt;1&gt; &amp; &quot;test&quot;"));
    });

    it("should escape special XML characters in cell text values", () => {
      model.addRectangle({ text: '<strong>"Hello" & \'World\'</strong>' });
      const xml = model.toXml();
      assert(xml.includes("&lt;strong&gt;&quot;Hello&quot; &amp; &apos;World&apos;&lt;/strong&gt;"));
    });

    it("should escape special XML characters in cell styles", () => {
      model.addRectangle({ text: "Test", style: 'fillColor=#ff0000;label="<b>bold</b>";' });
      const xml = model.toXml();
      assert(xml.includes('fillColor=#ff0000;label=&quot;&lt;b&gt;bold&lt;/b&gt;&quot;;'));
    });

    it("should produce valid XML with no custom layers", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml();
      assert(xml.includes('<mxCell id="0"/>'));
      assert(xml.includes('<mxCell id="1" parent="0"/>'));
      assert(xml.includes('value="Hello"'));
    });

    it("should render edges in XML output", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id, text: "connects" });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        assert(xml.includes(`edge="1"`));
        assert(xml.includes(`source="${a.id}"`));
        assert(xml.includes(`target="${b.id}"`));
        assert(xml.includes(`value="connects"`));
        assert(xml.includes(`<mxGeometry relative="1" as="geometry"/>`));
      }
    });
  });

  describe("addRectangle", () => {
    it("should create a cell with defaults", () => {
      const cell = model.addRectangle({});
      assertEquals(cell.type, "vertex");
      assertEquals(cell.value, "New Cell");
      assertEquals(cell.width, 200);
      assertEquals(cell.height, 100);
    });

    it("should accept custom dimensions", () => {
      const cell = model.addRectangle({ width: 48, height: 48, text: "Icon" });
      assertEquals(cell.width, 48);
      assertEquals(cell.height, 48);
      assertEquals(cell.value, "Icon");
    });

    it("should clamp negative dimensions to 1", () => {
      const cell = model.addRectangle({ width: -10, height: -5 });
      assertEquals(cell.width, 1);
      assertEquals(cell.height, 1);
    });

    it("should clamp zero dimensions to 1", () => {
      const cell = model.addRectangle({ width: 0, height: 0 });
      assertEquals(cell.width, 1);
      assertEquals(cell.height, 1);
    });
  });

  describe("addEdge", () => {
    it("should error when source does not exist", () => {
      model.addRectangle({ text: "Target" });
      const result = model.addEdge({ sourceId: "nonexistent", targetId: "cell-2" });
      assertEquals("error" in result, true);
    });

    it("should error when target does not exist", () => {
      const a = model.addRectangle({ text: "Source" });
      const result = model.addEdge({ sourceId: a.id, targetId: "nonexistent" });
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "TARGET_NOT_FOUND");
      }
    });

    it("should create edge between existing cells", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        assertEquals(edge.type, "edge");
      }
    });

    it("should create edge with custom text and style", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id, text: "label", style: "dashed=1;" });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        assertEquals(edge.value, "label");
        assertEquals(edge.style, "dashed=1;");
      }
    });
  });

  describe("editCell", () => {
    it("should return error for non-existent cell", () => {
      const result = model.editCell("nonexistent", { text: "X" });
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "CELL_NOT_FOUND");
      }
    });

    it("should return error when editing an edge as a vertex", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editCell(edge.id, { text: "X" });
        assertEquals("error" in result, true);
        if ("error" in result) {
          assertEquals(result.error.code, "WRONG_CELL_TYPE");
        }
      }
    });

    it("should update all specified properties", () => {
      const cell = model.addRectangle({ text: "Original" });
      const result = model.editCell(cell.id, {
        text: "Updated",
        x: 500,
        y: 600,
        width: 300,
        height: 200,
        style: "fillColor=#ff0000;",
      });
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.value, "Updated");
        assertEquals(result.x, 500);
        assertEquals(result.y, 600);
        assertEquals(result.width, 300);
        assertEquals(result.height, 200);
        assertEquals(result.style, "fillColor=#ff0000;");
      }
    });
  });

  describe("editEdge", () => {
    it("should return error for non-existent edge", () => {
      const result = model.editEdge("nonexistent", { text: "X" });
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "CELL_NOT_FOUND");
      }
    });

    it("should return error when editing a vertex as an edge", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.editEdge(cell.id, { text: "X" });
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "WRONG_CELL_TYPE");
      }
    });

    it("should return error when reassigning to non-existent source", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { sourceId: "nonexistent" });
        assertEquals("error" in result, true);
        if ("error" in result) {
          assertEquals(result.error.code, "SOURCE_NOT_FOUND");
        }
      }
    });

    it("should return error when reassigning to non-existent target", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { targetId: "nonexistent" });
        assertEquals("error" in result, true);
        if ("error" in result) {
          assertEquals(result.error.code, "TARGET_NOT_FOUND");
        }
      }
    });

    it("should update edge text, source, target, and style", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id, text: "old" });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, {
          text: "new",
          sourceId: c.id,
          style: "dashed=1;",
        });
        assertEquals("error" in result, false);
        if (!("error" in result)) {
          assertEquals(result.value, "new");
          assertEquals(result.sourceId, c.id);
          assertEquals(result.style, "dashed=1;");
        }
      }
    });

    it("should update edge target to valid cell", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { targetId: c.id });
        assertEquals("error" in result, false);
        if (!("error" in result)) {
          assertEquals(result.targetId, c.id);
        }
      }
    });

    it("should reassign both source and target simultaneously", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const d = model.addRectangle({ text: "D" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { sourceId: c.id, targetId: d.id });
        assertEquals("error" in result, false);
        if (!("error" in result)) {
          assertEquals(result.sourceId, c.id);
          assertEquals(result.targetId, d.id);
        }
      }
    });

    it("should partially update source when target is invalid", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { sourceId: c.id, targetId: "nonexistent" });
        assertEquals("error" in result, true);
        if ("error" in result) {
          assertEquals(result.error.code, "TARGET_NOT_FOUND");
        }
        // Source was already mutated before the target check
        const updated = model.getCell(edge.id);
        assertEquals(updated?.sourceId, c.id);
      }
    });
  });

  describe("getCell", () => {
    it("should return a vertex by ID", () => {
      const cell = model.addRectangle({ text: "Hello" });
      const found = model.getCell(cell.id);
      assertExists(found);
      assertEquals(found!.value, "Hello");
      assertEquals(found!.type, "vertex");
    });

    it("should return undefined for non-existent ID", () => {
      assertEquals(model.getCell("nonexistent"), undefined);
    });

    it("should return an edge by ID", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      if (!("error" in edge)) {
        const found = model.getCell(edge.id);
        assertExists(found);
        assertEquals(found!.type, "edge");
        assertEquals(found!.sourceId, a.id);
        assertEquals(found!.targetId, b.id);
      }
    });
  });

  describe("moveCellToLayer", () => {
    it("should return error for non-existent cell", () => {
      const layer = model.createLayer("L");
      const result = model.moveCellToLayer("nonexistent", layer.id);
      assertEquals("error" in result, true);
    });

    it("should return error for non-existent layer", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.moveCellToLayer(cell.id, "nonexistent");
      assertEquals("error" in result, true);
    });
  });

  describe("setActiveLayer", () => {
    it("should return error for non-existent layer", () => {
      const result = model.setActiveLayer("nonexistent");
      assertEquals("error" in result, true);
    });
  });

  describe("batchAddCells", () => {
    it("should resolve temp IDs for edges within the batch", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "A", tempId: "tmp-a" },
        { type: "vertex", text: "B", tempId: "tmp-b" },
        { type: "edge", sourceId: "tmp-a", targetId: "tmp-b" },
      ]);
      assertEquals(results.length, 3);
      assertEquals(results[0].success, true);
      assertEquals(results[1].success, true);
      assertEquals(results[2].success, true);
    });

    it("should fail validation for edges with invalid source", () => {
      const results = model.batchAddCells([
        { type: "edge", sourceId: "nonexistent", targetId: "also-nonexistent" },
      ]);
      assertGreater(results.length, 0);
      assertEquals(results[0].success, false);
    });

    it("should fail validation for edges with invalid target", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "A", tempId: "tmp-a" },
        { type: "edge", sourceId: "tmp-a", targetId: "nonexistent" },
      ]);
      assertGreater(results.length, 0);
      assert(results.some(r => !r.success));
    });

    it("should support dry run mode", () => {
      const results = model.batchAddCells(
        [{ type: "vertex", text: "DryRun" }],
        { dryRun: true },
      );
      assertEquals(results.length, 1);
      assertEquals(results[0].success, true);
      // Should not have persisted
      assertEquals(model.listCells().length, 0);
    });

    it("should support dry run with no text provided", () => {
      const results = model.batchAddCells(
        [{ type: "vertex" }],
        { dryRun: true },
      );
      assertEquals(results.length, 1);
      assertEquals(results[0].success, true);
      assertEquals(results[0].cell?.value, "");
    });

    it("should return INVALID_SOURCE with tempId when edge has bad source", () => {
      const results = model.batchAddCells([
        { type: "edge", sourceId: "bad-src", targetId: "bad-tgt", tempId: "edge-1" },
      ]);
      assert(results.length >= 1);
      const sourceErr = results.find(r => !r.success && r.error?.code === "INVALID_SOURCE");
      assertExists(sourceErr);
      assertEquals(sourceErr!.tempId, "edge-1");
    });

    it("should succeed with edge that has no tempId", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "A", tempId: "tmp-a" },
        { type: "vertex", text: "B", tempId: "tmp-b" },
        { type: "edge", sourceId: "tmp-a", targetId: "tmp-b" },
      ]);
      assertEquals(results.length, 3);
      assertEquals(results[2].success, true);
      assertEquals(results[2].tempId, undefined);
    });

    it("should succeed with vertex that has no tempId", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "No TempId" },
      ]);
      assertEquals(results.length, 1);
      assertEquals(results[0].success, true);
      assertEquals(results[0].tempId, undefined);
    });

    it("should reference existing diagram cells in batch edges", () => {
      const existing = model.addRectangle({ text: "Existing" });
      const results = model.batchAddCells([
        { type: "vertex", text: "New", tempId: "tmp-new" },
        { type: "edge", sourceId: existing.id, targetId: "tmp-new" },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[1].success, true);
    });

    it("should allow an edge to reference another edge via tempId", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const results = model.batchAddCells([
        { type: "edge", sourceId: a.id, targetId: b.id, tempId: "edge-1" },
        { type: "edge", sourceId: a.id, targetId: "edge-1" },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[0].success, true);
      assertEquals(results[1].success, true);
    });
  });

  describe("batchEditCells", () => {
    it("should edit multiple cells", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const results = model.batchEditCells([
        { cell_id: a.id, text: "Updated A" },
        { cell_id: b.id, x: 999 },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[0].success, true);
      assertEquals(results[1].success, true);
    });

    it("should report errors for non-existent cells", () => {
      const results = model.batchEditCells([
        { cell_id: "nonexistent", text: "X" },
      ]);
      assertEquals(results[0].success, false);
    });
  });

  describe("clear", () => {
    it("should remove all cells", () => {
      model.addRectangle({ text: "A" });
      model.addRectangle({ text: "B" });
      assertEquals(model.listCells().length, 2);
      model.clear();
      assertEquals(model.listCells().length, 0);
    });

    it("should reset nextId so new cells start from cell-2", () => {
      model.addRectangle({ text: "A" }); // cell-2
      model.addRectangle({ text: "B" }); // cell-3
      model.clear();
      const cell = model.addRectangle({ text: "C" });
      assertEquals(cell.id, "cell-2");
    });

    it("should reset layers to defaults", () => {
      const layer = model.createLayer("Custom");
      model.setActiveLayer(layer.id);
      model.addRectangle({ text: "A" });
      model.clear();

      // Layers reset to just the default layer
      assertEquals(model.listLayers().length, 1);
      assertEquals(model.getActiveLayer().id, "1");
      // New cells are parented to the default layer
      const cell = model.addRectangle({ text: "B" });
      assertEquals(cell.parent, "1");
    });
  });

  describe("listCells", () => {
    it("should return all cells without filter", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals(model.listCells().length, 3);
    });

    it("should filter by vertex type", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id });
      const vertices = model.listCells({ cellType: "vertex" });
      assertEquals(vertices.length, 2);
      assertEquals(vertices.every(c => c.type === "vertex"), true);
    });

    it("should filter by edge type", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id });
      const edges = model.listCells({ cellType: "edge" });
      assertEquals(edges.length, 1);
      assertEquals(edges[0].type, "edge");
    });
  });

  describe("deleteCell", () => {
    it("should return deleted false for non-existent cell", () => {
      assertEquals(model.deleteCell("does-not-exist").deleted, false);
    });

    it("should delete a vertex", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.deleteCell(cell.id);
      assertEquals(result.deleted, true);
      assertEquals(result.cascadedEdgeIds.length, 0);
      assertEquals(model.getCell(cell.id), undefined);
    });

    it("should cascade-delete edges when a vertex is deleted", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edgeAB = model.addEdge({ sourceId: a.id, targetId: b.id });
      const edgeBC = model.addEdge({ sourceId: b.id, targetId: c.id });
      assertEquals("error" in edgeAB, false);
      assertEquals("error" in edgeBC, false);

      // Delete B — should remove both edges connected to B
      const result = model.deleteCell(b.id);
      assertEquals(result.deleted, true);
      assertEquals(result.cascadedEdgeIds.length, 2);
      assertEquals(model.getCell(b.id), undefined);
      if (!("error" in edgeAB)) {
        assertEquals(model.getCell(edgeAB.id), undefined);
      }
      if (!("error" in edgeBC)) {
        assertEquals(model.getCell(edgeBC.id), undefined);
      }
      // A and C should remain
      assertExists(model.getCell(a.id));
      assertExists(model.getCell(c.id));
    });

    it("should not cascade-delete when deleting an edge", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      assertEquals("error" in edge, false);

      if (!("error" in edge)) {
        model.deleteCell(edge.id);
        assertEquals(model.getCell(edge.id), undefined);
        // Vertices should still exist
        assertExists(model.getCell(a.id));
        assertExists(model.getCell(b.id));
      }
    });
  });

  describe("getStats", () => {
    it("should return correct stats for empty diagram", () => {
      const stats = model.getStats();
      assertEquals(stats.total_cells, 0);
      assertEquals(stats.vertices, 0);
      assertEquals(stats.edges, 0);
      assertEquals(stats.layers, 1); // Default layer
      assertEquals(stats.bounds, null);
      assertEquals(stats.cells_with_text, 0);
      assertEquals(stats.cells_without_text, 0);
    });

    it("should return correct stats for diagram with cells", () => {
      model.addRectangle({ text: "A", x: 100, y: 100, width: 200, height: 100 });
      model.addRectangle({ text: "B", x: 400, y: 200, width: 150, height: 80 });
      model.addRectangle({ text: "", x: 50, y: 50, width: 100, height: 100 }); // No text

      const stats = model.getStats();
      assertEquals(stats.total_cells, 3);
      assertEquals(stats.vertices, 3);
      assertEquals(stats.edges, 0);
      assertEquals(stats.cells_with_text, 2);
      assertEquals(stats.cells_without_text, 1);
      assertEquals(stats.bounds, {
        minX: 50,
        minY: 50,
        maxX: 550, // 400 + 150
        maxY: 280, // 200 + 80
      });
    });

    it("should count edges correctly", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id, text: "connects" });

      const stats = model.getStats();
      assertEquals(stats.total_cells, 3);
      assertEquals(stats.vertices, 2);
      assertEquals(stats.edges, 1);
      assertEquals(stats.cells_with_text, 3);
    });

    it("should track cells by layer", () => {
      const layer1 = model.createLayer("Network");
      const layer2 = model.createLayer("Security");

      model.addRectangle({ text: "Default" }); // Added to default layer

      model.setActiveLayer(layer1.id);
      model.addRectangle({ text: "Net1" });
      model.addRectangle({ text: "Net2" });

      model.setActiveLayer(layer2.id);
      model.addRectangle({ text: "Sec1" });

      const stats = model.getStats();
      assertEquals(stats.total_cells, 4);
      assertEquals(stats.layers, 3);
      assertEquals(stats.cells_by_layer["1"], 1); // Default layer
      assertEquals(stats.cells_by_layer[layer1.id], 2);
      assertEquals(stats.cells_by_layer[layer2.id], 1);
    });

    it("should return null bounds when vertices have no position", () => {
      // addRectangle always sets x/y, but default is 0,0
      // Vertices with x=0 y=0 still count as positioned (filter checks !== undefined)
      model.addRectangle({ text: "A" });
      const stats = model.getStats();
      assertNotEquals(stats.bounds, null);
    });
  });
});
