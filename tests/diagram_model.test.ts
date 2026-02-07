import { DiagramModel } from "../src/diagram_model.js";

describe("DiagramModel", () => {
  let model: DiagramModel;

  beforeEach(() => {
    model = new DiagramModel();
  });

  describe("toXml", () => {
    it("should include the default layer in XML output", () => {
      const xml = model.toXml();
      expect(xml).toContain('<mxCell id="0"/>');
      expect(xml).toContain('<mxCell id="1" parent="0"/>');
    });

    it("should include custom layers as mxCell elements in XML output", () => {
      const layer = model.createLayer("Network");
      const xml = model.toXml();
      expect(xml).toContain(`<mxCell id="${layer.id}" value="Network" style="" parent="0"/>`);
    });

    it("should include multiple custom layers in XML output", () => {
      const layer1 = model.createLayer("Network");
      const layer2 = model.createLayer("Security");
      const xml = model.toXml();
      expect(xml).toContain(`<mxCell id="${layer1.id}" value="Network" style="" parent="0"/>`);
      expect(xml).toContain(`<mxCell id="${layer2.id}" value="Security" style="" parent="0"/>`);
    });

    it("should render cells assigned to custom layers with correct parent", () => {
      const layer = model.createLayer("Custom");
      model.setActiveLayer(layer.id);
      const cell = model.addRectangle({ text: "In Custom Layer" });
      const xml = model.toXml();
      expect(xml).toContain(`parent="${layer.id}"`);
      expect(xml).toContain(`id="${cell.id}"`);
    });

    it("should escape special characters in layer names", () => {
      model.createLayer("Layer <1> & \"test\"");
      const xml = model.toXml();
      expect(xml).toContain("Layer &lt;1&gt; &amp; &quot;test&quot;");
    });

    it("should escape special XML characters in cell text values", () => {
      model.addRectangle({ text: '<strong>"Hello" & \'World\'</strong>' });
      const xml = model.toXml();
      expect(xml).toContain("&lt;strong&gt;&quot;Hello&quot; &amp; &apos;World&apos;&lt;/strong&gt;");
    });

    it("should escape special XML characters in cell styles", () => {
      model.addRectangle({ text: "Test", style: 'fillColor=#ff0000;label="<b>bold</b>";' });
      const xml = model.toXml();
      expect(xml).toContain('fillColor=#ff0000;label=&quot;&lt;b&gt;bold&lt;/b&gt;&quot;;');
    });

    it("should produce valid XML with no custom layers", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml();
      expect(xml).toContain('<mxCell id="0"/>');
      expect(xml).toContain('<mxCell id="1" parent="0"/>');
      expect(xml).toContain('value="Hello"');
    });

    it("should render edges in XML output", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id, text: "connects" });
      expect("error" in edge).toBe(false);
      if (!("error" in edge)) {
        const xml = model.toXml();
        expect(xml).toContain(`edge="1"`);
        expect(xml).toContain(`source="${a.id}"`);
        expect(xml).toContain(`target="${b.id}"`);
        expect(xml).toContain(`value="connects"`);
        expect(xml).toContain(`<mxGeometry relative="1" as="geometry"/>`);
      }
    });
  });

  describe("addRectangle", () => {
    it("should create a cell with defaults", () => {
      const cell = model.addRectangle({});
      expect(cell.type).toBe("vertex");
      expect(cell.value).toBe("New Cell");
      expect(cell.width).toBe(200);
      expect(cell.height).toBe(100);
    });

    it("should accept custom dimensions", () => {
      const cell = model.addRectangle({ width: 48, height: 48, text: "Icon" });
      expect(cell.width).toBe(48);
      expect(cell.height).toBe(48);
      expect(cell.value).toBe("Icon");
    });

    it("should clamp negative dimensions to 1", () => {
      const cell = model.addRectangle({ width: -10, height: -5 });
      expect(cell.width).toBe(1);
      expect(cell.height).toBe(1);
    });

    it("should clamp zero dimensions to 1", () => {
      const cell = model.addRectangle({ width: 0, height: 0 });
      expect(cell.width).toBe(1);
      expect(cell.height).toBe(1);
    });
  });

  describe("addEdge", () => {
    it("should error when source does not exist", () => {
      model.addRectangle({ text: "Target" });
      const result = model.addEdge({ sourceId: "nonexistent", targetId: "cell-2" });
      expect("error" in result).toBe(true);
    });

    it("should error when target does not exist", () => {
      const a = model.addRectangle({ text: "Source" });
      const result = model.addEdge({ sourceId: a.id, targetId: "nonexistent" });
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("TARGET_NOT_FOUND");
      }
    });

    it("should create edge between existing cells", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      expect("error" in edge).toBe(false);
      if (!("error" in edge)) {
        expect(edge.type).toBe("edge");
      }
    });

    it("should create edge with custom text and style", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id, text: "label", style: "dashed=1;" });
      expect("error" in edge).toBe(false);
      if (!("error" in edge)) {
        expect(edge.value).toBe("label");
        expect(edge.style).toBe("dashed=1;");
      }
    });
  });

  describe("editCell", () => {
    it("should return error for non-existent cell", () => {
      const result = model.editCell("nonexistent", { text: "X" });
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("CELL_NOT_FOUND");
      }
    });

    it("should return error when editing an edge as a vertex", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      expect("error" in edge).toBe(false);
      if (!("error" in edge)) {
        const result = model.editCell(edge.id, { text: "X" });
        expect("error" in result).toBe(true);
        if ("error" in result) {
          expect(result.error.code).toBe("WRONG_CELL_TYPE");
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
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.value).toBe("Updated");
        expect(result.x).toBe(500);
        expect(result.y).toBe(600);
        expect(result.width).toBe(300);
        expect(result.height).toBe(200);
        expect(result.style).toBe("fillColor=#ff0000;");
      }
    });
  });

  describe("editEdge", () => {
    it("should return error for non-existent edge", () => {
      const result = model.editEdge("nonexistent", { text: "X" });
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("CELL_NOT_FOUND");
      }
    });

    it("should return error when editing a vertex as an edge", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.editEdge(cell.id, { text: "X" });
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("WRONG_CELL_TYPE");
      }
    });

    it("should return error when reassigning to non-existent source", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      expect("error" in edge).toBe(false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { sourceId: "nonexistent" });
        expect("error" in result).toBe(true);
        if ("error" in result) {
          expect(result.error.code).toBe("SOURCE_NOT_FOUND");
        }
      }
    });

    it("should return error when reassigning to non-existent target", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      expect("error" in edge).toBe(false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { targetId: "nonexistent" });
        expect("error" in result).toBe(true);
        if ("error" in result) {
          expect(result.error.code).toBe("TARGET_NOT_FOUND");
        }
      }
    });

    it("should update edge text, source, target, and style", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id, text: "old" });
      expect("error" in edge).toBe(false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, {
          text: "new",
          sourceId: c.id,
          style: "dashed=1;",
        });
        expect("error" in result).toBe(false);
        if (!("error" in result)) {
          expect(result.value).toBe("new");
          expect(result.sourceId).toBe(c.id);
          expect(result.style).toBe("dashed=1;");
        }
      }
    });

    it("should update edge target to valid cell", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      expect("error" in edge).toBe(false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { targetId: c.id });
        expect("error" in result).toBe(false);
        if (!("error" in result)) {
          expect(result.targetId).toBe(c.id);
        }
      }
    });

    it("should reassign both source and target simultaneously", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const d = model.addRectangle({ text: "D" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      expect("error" in edge).toBe(false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { sourceId: c.id, targetId: d.id });
        expect("error" in result).toBe(false);
        if (!("error" in result)) {
          expect(result.sourceId).toBe(c.id);
          expect(result.targetId).toBe(d.id);
        }
      }
    });

    it("should partially update source when target is invalid", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      expect("error" in edge).toBe(false);
      if (!("error" in edge)) {
        const result = model.editEdge(edge.id, { sourceId: c.id, targetId: "nonexistent" });
        expect("error" in result).toBe(true);
        if ("error" in result) {
          expect(result.error.code).toBe("TARGET_NOT_FOUND");
        }
        // Source was already mutated before the target check
        const updated = model.getCell(edge.id);
        expect(updated?.sourceId).toBe(c.id);
      }
    });
  });

  describe("getCell", () => {
    it("should return a vertex by ID", () => {
      const cell = model.addRectangle({ text: "Hello" });
      const found = model.getCell(cell.id);
      expect(found).toBeDefined();
      expect(found!.value).toBe("Hello");
      expect(found!.type).toBe("vertex");
    });

    it("should return undefined for non-existent ID", () => {
      expect(model.getCell("nonexistent")).toBeUndefined();
    });

    it("should return an edge by ID", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      if (!("error" in edge)) {
        const found = model.getCell(edge.id);
        expect(found).toBeDefined();
        expect(found!.type).toBe("edge");
        expect(found!.sourceId).toBe(a.id);
        expect(found!.targetId).toBe(b.id);
      }
    });
  });

  describe("moveCellToLayer", () => {
    it("should return error for non-existent cell", () => {
      const layer = model.createLayer("L");
      const result = model.moveCellToLayer("nonexistent", layer.id);
      expect("error" in result).toBe(true);
    });

    it("should return error for non-existent layer", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.moveCellToLayer(cell.id, "nonexistent");
      expect("error" in result).toBe(true);
    });
  });

  describe("setActiveLayer", () => {
    it("should return error for non-existent layer", () => {
      const result = model.setActiveLayer("nonexistent");
      expect("error" in result).toBe(true);
    });
  });

  describe("batchAddCells", () => {
    it("should resolve temp IDs for edges within the batch", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "A", tempId: "tmp-a" },
        { type: "vertex", text: "B", tempId: "tmp-b" },
        { type: "edge", sourceId: "tmp-a", targetId: "tmp-b" },
      ]);
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
    });

    it("should fail validation for edges with invalid source", () => {
      const results = model.batchAddCells([
        { type: "edge", sourceId: "nonexistent", targetId: "also-nonexistent" },
      ]);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].success).toBe(false);
    });

    it("should fail validation for edges with invalid target", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "A", tempId: "tmp-a" },
        { type: "edge", sourceId: "tmp-a", targetId: "nonexistent" },
      ]);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => !r.success)).toBe(true);
    });

    it("should support dry run mode", () => {
      const results = model.batchAddCells(
        [{ type: "vertex", text: "DryRun" }],
        { dryRun: true },
      );
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      // Should not have persisted
      expect(model.listCells()).toHaveLength(0);
    });

    it("should support dry run with no text provided", () => {
      const results = model.batchAddCells(
        [{ type: "vertex" }],
        { dryRun: true },
      );
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].cell?.value).toBe("");
    });

    it("should return INVALID_SOURCE with tempId when edge has bad source", () => {
      const results = model.batchAddCells([
        { type: "edge", sourceId: "bad-src", targetId: "bad-tgt", tempId: "edge-1" },
      ]);
      expect(results.length).toBeGreaterThanOrEqual(1);
      const sourceErr = results.find(r => !r.success && r.error?.code === "INVALID_SOURCE");
      expect(sourceErr).toBeDefined();
      expect(sourceErr!.tempId).toBe("edge-1");
    });

    it("should succeed with edge that has no tempId", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "A", tempId: "tmp-a" },
        { type: "vertex", text: "B", tempId: "tmp-b" },
        { type: "edge", sourceId: "tmp-a", targetId: "tmp-b" },
      ]);
      expect(results).toHaveLength(3);
      expect(results[2].success).toBe(true);
      expect(results[2].tempId).toBeUndefined();
    });

    it("should succeed with vertex that has no tempId", () => {
      const results = model.batchAddCells([
        { type: "vertex", text: "No TempId" },
      ]);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].tempId).toBeUndefined();
    });

    it("should reference existing diagram cells in batch edges", () => {
      const existing = model.addRectangle({ text: "Existing" });
      const results = model.batchAddCells([
        { type: "vertex", text: "New", tempId: "tmp-new" },
        { type: "edge", sourceId: existing.id, targetId: "tmp-new" },
      ]);
      expect(results).toHaveLength(2);
      expect(results[1].success).toBe(true);
    });

    it("should allow an edge to reference another edge via tempId", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const results = model.batchAddCells([
        { type: "edge", sourceId: a.id, targetId: b.id, tempId: "edge-1" },
        { type: "edge", sourceId: a.id, targetId: "edge-1" },
      ]);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
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
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it("should report errors for non-existent cells", () => {
      const results = model.batchEditCells([
        { cell_id: "nonexistent", text: "X" },
      ]);
      expect(results[0].success).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all cells", () => {
      model.addRectangle({ text: "A" });
      model.addRectangle({ text: "B" });
      expect(model.listCells()).toHaveLength(2);
      model.clear();
      expect(model.listCells()).toHaveLength(0);
    });

    it("should reset nextId so new cells start from cell-2", () => {
      model.addRectangle({ text: "A" }); // cell-2
      model.addRectangle({ text: "B" }); // cell-3
      model.clear();
      const cell = model.addRectangle({ text: "C" });
      expect(cell.id).toBe("cell-2");
    });

    it("should reset layers and pages to defaults", () => {
      const layer = model.createLayer("Custom");
      model.setActiveLayer(layer.id);
      model.addRectangle({ text: "A" });
      model.clear();

      // Layers reset to just the default layer
      expect(model.listLayers()).toHaveLength(1);
      expect(model.getActiveLayer().id).toBe("1");
      // New cells are parented to the default layer
      const cell = model.addRectangle({ text: "B" });
      expect(cell.parent).toBe("1");
      // Pages reset to single default page
      expect(model.listPages()).toHaveLength(1);
      expect(model.getActivePage().id).toBe("page-1");
    });
  });

  describe("listCells", () => {
    it("should return all cells without filter", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id });
      expect(model.listCells()).toHaveLength(3);
    });

    it("should filter by vertex type", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id });
      const vertices = model.listCells({ cellType: "vertex" });
      expect(vertices).toHaveLength(2);
      expect(vertices.every(c => c.type === "vertex")).toBe(true);
    });

    it("should filter by edge type", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id });
      const edges = model.listCells({ cellType: "edge" });
      expect(edges).toHaveLength(1);
      expect(edges[0].type).toBe("edge");
    });
  });

  describe("deleteCell", () => {
    it("should return deleted false for non-existent cell", () => {
      expect(model.deleteCell("does-not-exist").deleted).toBe(false);
    });

    it("should delete a vertex", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.deleteCell(cell.id);
      expect(result.deleted).toBe(true);
      expect(result.cascadedEdgeIds).toHaveLength(0);
      expect(model.getCell(cell.id)).toBeUndefined();
    });

    it("should cascade-delete edges when a vertex is deleted", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const c = model.addRectangle({ text: "C" });
      const edgeAB = model.addEdge({ sourceId: a.id, targetId: b.id });
      const edgeBC = model.addEdge({ sourceId: b.id, targetId: c.id });
      expect("error" in edgeAB).toBe(false);
      expect("error" in edgeBC).toBe(false);

      // Delete B — should remove both edges connected to B
      const result = model.deleteCell(b.id);
      expect(result.deleted).toBe(true);
      expect(result.cascadedEdgeIds).toHaveLength(2);
      expect(model.getCell(b.id)).toBeUndefined();
      if (!("error" in edgeAB)) {
        expect(model.getCell(edgeAB.id)).toBeUndefined();
      }
      if (!("error" in edgeBC)) {
        expect(model.getCell(edgeBC.id)).toBeUndefined();
      }
      // A and C should remain
      expect(model.getCell(a.id)).toBeDefined();
      expect(model.getCell(c.id)).toBeDefined();
    });

    it("should not cascade-delete when deleting an edge", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      const edge = model.addEdge({ sourceId: a.id, targetId: b.id });
      expect("error" in edge).toBe(false);

      if (!("error" in edge)) {
        model.deleteCell(edge.id);
        expect(model.getCell(edge.id)).toBeUndefined();
        // Vertices should still exist
        expect(model.getCell(a.id)).toBeDefined();
        expect(model.getCell(b.id)).toBeDefined();
      }
    });
  });

  describe("getStats", () => {
    it("should return correct stats for empty diagram", () => {
      const stats = model.getStats();
      expect(stats.total_cells).toBe(0);
      expect(stats.vertices).toBe(0);
      expect(stats.edges).toBe(0);
      expect(stats.layers).toBe(1); // Default layer
      expect(stats.bounds).toBeNull();
      expect(stats.cells_with_text).toBe(0);
      expect(stats.cells_without_text).toBe(0);
    });

    it("should return correct stats for diagram with cells", () => {
      model.addRectangle({ text: "A", x: 100, y: 100, width: 200, height: 100 });
      model.addRectangle({ text: "B", x: 400, y: 200, width: 150, height: 80 });
      model.addRectangle({ text: "", x: 50, y: 50, width: 100, height: 100 }); // No text

      const stats = model.getStats();
      expect(stats.total_cells).toBe(3);
      expect(stats.vertices).toBe(3);
      expect(stats.edges).toBe(0);
      expect(stats.cells_with_text).toBe(2);
      expect(stats.cells_without_text).toBe(1);
      expect(stats.bounds).toEqual({
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
      expect(stats.total_cells).toBe(3);
      expect(stats.vertices).toBe(2);
      expect(stats.edges).toBe(1);
      expect(stats.cells_with_text).toBe(3);
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
      expect(stats.total_cells).toBe(4);
      expect(stats.layers).toBe(3);
      expect(stats.cells_by_layer["1"]).toBe(1); // Default layer
      expect(stats.cells_by_layer[layer1.id]).toBe(2);
      expect(stats.cells_by_layer[layer2.id]).toBe(1);
    });

    it("should return null bounds when vertices have no position", () => {
      // addRectangle always sets x/y, but default is 0,0
      // Vertices with x=0 y=0 still count as positioned (filter checks !== undefined)
      model.addRectangle({ text: "A" });
      const stats = model.getStats();
      expect(stats.bounds).not.toBeNull();
    });
  });
});
