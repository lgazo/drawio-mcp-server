import { describe, it, beforeEach } from "@std/testing/bdd";
import { assertEquals, assert, assertExists, assertNotEquals } from "@std/assert";
import { DiagramModel } from "../src/diagram_model.ts";

describe("DiagramModel importXml", () => {
  let model: DiagramModel;

  beforeEach(() => {
    model = new DiagramModel();
  });

  describe("single page import", () => {
    it("should import a simple single-page diagram", () => {
      const xml = `<mxfile host="app.diagrams.net">
        <diagram id="test-page" name="Test Page">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="2" value="Hello" style="rounded=1;" vertex="1" parent="1">
                <mxGeometry x="100" y="200" width="120" height="60" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      const result = model.importXml(xml);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.pages, 1);
        assertEquals(result.cells, 1);
      }

      const cells = model.listCells();
      assertEquals(cells.length, 1);
      assertEquals(cells[0].value, "Hello");
      assertEquals(cells[0].x, 100);
      assertEquals(cells[0].y, 200);
      assertEquals(cells[0].width, 120);
      assertEquals(cells[0].height, 60);
      assert(cells[0].style!.includes("rounded=1"));
    });

    it("should import vertices and edges", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="2" value="A" style="" vertex="1" parent="1">
                <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
              <mxCell id="3" value="B" style="" vertex="1" parent="1">
                <mxGeometry x="200" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
              <mxCell id="4" value="link" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="2" target="3" parent="1">
                <mxGeometry relative="1" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      const result = model.importXml(xml);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.cells, 3);
      }

      const vertices = model.listCells({ cellType: "vertex" });
      const edges = model.listCells({ cellType: "edge" });
      assertEquals(vertices.length, 2);
      assertEquals(edges.length, 1);
      assertEquals(edges[0].value, "link");
      assertEquals(edges[0].sourceId, "2");
      assertEquals(edges[0].targetId, "3");
    });

  });

  describe("multi-page import", () => {
    it("should merge cells from multiple pages into single model", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="2" value="Cell on Page 1" style="" vertex="1" parent="1">
                <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
        <diagram id="p2" name="Page 2">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="3" value="Cell on Page 2" style="" vertex="1" parent="1">
                <mxGeometry x="20" y="20" width="80" height="40" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      const result = model.importXml(xml);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.pages, 2);
        assertEquals(result.cells, 2);
      }

      // All cells from both pages merged into single model
      const cells = model.listCells();
      assertEquals(cells.length, 2);
      assert(cells.some(c => c.value === "Cell on Page 1"));
      assert(cells.some(c => c.value === "Cell on Page 2"));
    });
  });

  describe("import with layers", () => {
    it("should import custom layers", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="layer-2" value="Background" parent="0"/>
              <mxCell id="2" value="On Default" style="" vertex="1" parent="1">
                <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
              <mxCell id="3" value="On Background" style="" vertex="1" parent="layer-2">
                <mxGeometry x="200" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      const result = model.importXml(xml);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.layers, 2);
        assertEquals(result.cells, 2);
      }

      const layers = model.listLayers();
      assertEquals(layers.length, 2);
      assertEquals(layers[0].name, "Default Layer");
      assertEquals(layers[1].name, "Background");

      // Verify cells are on correct layers
      const cells = model.listCells();
      const defaultCell = cells.find(c => c.value === "On Default");
      const bgCell = cells.find(c => c.value === "On Background");
      assertExists(defaultCell);
      assertExists(bgCell);
      assertEquals(defaultCell!.parent, "1");
      assertEquals(bgCell!.parent, "layer-2");
    });
  });

  describe("import with groups", () => {
    it("should import groups and set up parent-child relationships", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="group-1" value="VNet" style="rounded=1;container=1;collapsible=0;" vertex="1" parent="1">
                <mxGeometry x="10" y="10" width="400" height="300" as="geometry"/>
              </mxCell>
              <mxCell id="child-1" value="Subnet A" style="" vertex="1" parent="group-1">
                <mxGeometry x="20" y="20" width="100" height="50" as="geometry"/>
              </mxCell>
              <mxCell id="child-2" value="Subnet B" style="" vertex="1" parent="group-1">
                <mxGeometry x="20" y="100" width="100" height="50" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      const result = model.importXml(xml);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.cells, 3);
      }

      const group = model.getCell("group-1");
      assertExists(group);
      assertEquals(group!.isGroup, true);
      assertEquals(group!.children!.length, 2);
      assert(group!.children!.includes("child-1"));
      assert(group!.children!.includes("child-2"));

      const child1 = model.getCell("child-1");
      assertExists(child1);
      assertEquals(child1!.parent, "group-1");
    });

    it("should import swimlane groups", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="swim-1" value="Swimlane" style="swimlane;" vertex="1" parent="1">
                <mxGeometry x="10" y="10" width="400" height="300" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      model.importXml(xml);
      const cell = model.getCell("swim-1");
      assertExists(cell);
      assertEquals(cell!.isGroup, true);
    });
  });

  describe("import edge without source/target", () => {
    it("should import edges without source or target attributes", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="2" value="floating edge" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1">
                <mxGeometry relative="1" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      const result = model.importXml(xml);
      assertEquals("error" in result, false);

      const edges = model.listCells({ cellType: "edge" });
      assertEquals(edges.length, 1);
      assertEquals(edges[0].value, "floating edge");
      assertEquals(edges[0].sourceId, undefined);
      assertEquals(edges[0].targetId, undefined);
    });
  });

  describe("import cell without parent attribute", () => {
    it("should default parent to layer 1", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="2" value="No Parent" style="" vertex="1">
                <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      model.importXml(xml);
      const cells = model.listCells();
      assertEquals(cells.length, 1);
      assertEquals(cells[0].parent, "1");
    });
  });

  describe("import layer without value attribute", () => {
    it("should use layer id as name when value is missing", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="custom-layer" parent="0"/>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      model.importXml(xml);
      const layers = model.listLayers();
      assertEquals(layers.length, 2);
      const customLayer = layers.find(l => l.id === "custom-layer");
      assertExists(customLayer);
      assertEquals(customLayer!.name, "custom-layer");
    });
  });

  describe("import cell without id attribute", () => {
    it("should handle cells without id (skip or assign)", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell value="No ID" style="" vertex="1" parent="1">
                <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      // Should not throw, even if the cell has no id
      const result = model.importXml(xml);
      assertEquals("error" in result, false);
    });
  });

  describe("import error handling", () => {
    it("should return error for empty string", () => {
      const result = model.importXml("");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "EMPTY_XML");
      }
    });

    it("should return error for whitespace-only string", () => {
      const result = model.importXml("   \n  ");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "EMPTY_XML");
      }
    });

    it("should return error for non-drawio XML", () => {
      const result = model.importXml("<html><body>Not a diagram</body></html>");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "INVALID_XML");
      }
    });
  });

  describe("import replaces existing state", () => {
    it("should clear previous cells when importing", () => {
      // Add some cells first
      model.addRectangle({ text: "Old Cell 1" });
      model.addRectangle({ text: "Old Cell 2" });
      assertEquals(model.listCells().length, 2);

      // Import new diagram
      const xml = `<mxfile>
        <diagram id="p1" name="Fresh">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="2" value="New Cell" style="" vertex="1" parent="1">
                <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      model.importXml(xml);
      const cells = model.listCells();
      assertEquals(cells.length, 1);
      assertEquals(cells[0].value, "New Cell");
    });

  });

  describe("roundtrip: export then import", () => {
    it("should preserve cells through export and import", () => {
      model.addRectangle({ text: "Box A", x: 50, y: 100, width: 200, height: 80 });
      model.addRectangle({ text: "Box B", x: 300, y: 100, width: 200, height: 80 });

      const xml = model.toXml();
      const newModel = new DiagramModel();
      const result = newModel.importXml(xml);
      assertEquals("error" in result, false);

      const cells = newModel.listCells();
      assertEquals(cells.length, 2);
      assert(cells.map(c => c.value).includes("Box A"));
      assert(cells.map(c => c.value).includes("Box B"));
    });

    it("should preserve edges through export and import", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id, text: "connects" });

      const xml = model.toXml();
      const newModel = new DiagramModel();
      newModel.importXml(xml);

      const edges = newModel.listCells({ cellType: "edge" });
      assertEquals(edges.length, 1);
      assertEquals(edges[0].value, "connects");
    });

    it("should preserve groups through roundtrip", () => {
      const group = model.createGroup({ text: "VNet", x: 10, y: 10, width: 400, height: 300 });
      const child = model.addRectangle({ text: "Subnet" });
      model.addCellToGroup(child.id, group.id);

      const xml = model.toXml();
      const newModel = new DiagramModel();
      newModel.importXml(xml);

      const importedGroup = newModel.listCells().find(c => c.value === "VNet");
      assertExists(importedGroup);
      assertEquals(importedGroup!.isGroup, true);
      assert(importedGroup!.children!.length > 0);
    });

    it("should preserve layers through roundtrip", () => {
      model.createLayer("Custom Layer");
      model.addRectangle({ text: "On default" });

      const xml = model.toXml();
      const newModel = new DiagramModel();
      newModel.importXml(xml);

      const layers = newModel.listLayers();
      assertEquals(layers.length, 2);
    });

    it("should roundtrip with compression", () => {
      model.addRectangle({ text: "Compressed Cell", x: 50, y: 50 });
      const xml = model.toXml({ compress: true });

      const newModel = new DiagramModel();
      const result = newModel.importXml(xml);
      assertEquals("error" in result, false);

      const cells = newModel.listCells();
      assertEquals(cells.length, 1);
      assertEquals(cells[0].value, "Compressed Cell");
    });
  });

  describe("import edge without parent attribute", () => {
    it("should default parent to layer 1 when parent is missing on edge", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="v1" value="A" style="" vertex="1" parent="1">
                <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
              <mxCell id="v2" value="B" style="" vertex="1" parent="1">
                <mxGeometry x="200" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
              <mxCell id="e1" value="Link" style="" edge="1" source="v1" target="v2"/>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      model.importXml(xml);
      const edges = model.listCells({ cellType: "edge" });
      assertEquals(edges.length, 1);
      assertEquals(edges[0].parent, "1");
    });
  });

  describe("import and export floating edge (no source/target)", () => {
    it("should handle edge without source and target in roundtrip", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="e1" value="Floating" style="" edge="1" parent="1"/>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      model.importXml(xml);
      const edges = model.listCells({ cellType: "edge" });
      assertEquals(edges.length, 1);
      assertEquals(edges[0].sourceId, undefined);
      assertEquals(edges[0].targetId, undefined);

      // Export and verify no source/target attributes in the XML
      const exportedXml = model.toXml();
      assert(!exportedXml.includes('source='));
      assert(!exportedXml.includes('target='));
      assert(exportedXml.includes('edge="1"'));
    });
  });

  describe("import root with only UserObjects (no mxCell array)", () => {
    it("should handle root containing only UserObjects", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <UserObject id="uo-1" label="Only UO">
                <mxCell style="" vertex="1" parent="1">
                  <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
                </mxCell>
              </UserObject>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      const result = model.importXml(xml);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.cells, 1);
      }
    });
  });

  describe("import XML with escaped characters", () => {
    it("should handle XML entities in cell values", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="2" value="A &amp; B &lt;C&gt;" style="" vertex="1" parent="1">
                <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      model.importXml(xml);
      const cells = model.listCells();
      assertEquals(cells.length, 1);
      assertEquals(cells[0].value, "A & B <C>");
    });
  });

  describe("import diagram without geometry", () => {
    it("should use default geometry when mxGeometry is missing", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="2" value="No Geometry" style="" vertex="1" parent="1"/>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      model.importXml(xml);
      const cells = model.listCells();
      assertEquals(cells.length, 1);
      assertEquals(cells[0].x, 0);
      assertEquals(cells[0].y, 0);
      assertEquals(cells[0].width, 200);
      assertEquals(cells[0].height, 100);
    });
  });

  describe("import with UserObject elements", () => {
    it("should import UserObject elements as cells", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <UserObject id="uo-1" label="User Object Cell">
                <mxCell style="rounded=1;" vertex="1" parent="1">
                  <mxGeometry x="50" y="50" width="150" height="75" as="geometry"/>
                </mxCell>
              </UserObject>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      model.importXml(xml);
      const cells = model.listCells();
      assertEquals(cells.length, 1);
      assertEquals(cells[0].id, "uo-1");
      assertEquals(cells[0].value, "User Object Cell");
      assertEquals(cells[0].x, 50);
      assertEquals(cells[0].y, 50);
      assertEquals(cells[0].width, 150);
      assertEquals(cells[0].height, 75);
    });

    it("should import UserObject with value attribute", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <UserObject id="uo-2" value="From Value Attr">
                <mxCell style="" vertex="1" parent="1">
                  <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
                </mxCell>
              </UserObject>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      model.importXml(xml);
      const cell = model.getCell("uo-2");
      assertExists(cell);
      assertEquals(cell!.value, "From Value Attr");
    });
  });

  describe("import group with existing container=1 in style", () => {
    it("should not duplicate container=1 on import", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="g1" value="Group" style="container=1;rounded=1;" vertex="1" parent="1">
                <mxGeometry x="10" y="10" width="400" height="300" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      model.importXml(xml);
      const group = model.getCell("g1");
      assertExists(group);
      assertEquals(group!.isGroup, true);

      // Export and check no duplication
      const exportedXml = model.toXml();
      const matches = exportedXml.match(/container=1/g) || [];
      assertEquals(matches.length, 1);
    });
  });

  describe("import root without mxCell elements", () => {
    it("should handle empty root gracefully", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root></root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      const result = model.importXml(xml);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.cells, 0);
      }
    });
  });

  describe("import mxfile without diagram children", () => {
    it("should handle mxfile with no diagram elements", () => {
      const xml = `<mxfile host="app.diagrams.net"></mxfile>`;

      const result = model.importXml(xml);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.pages, 1);
        assertEquals(result.cells, 0);
      }
    });
  });

  describe("import diagram without mxGraphModel root", () => {
    it("should handle diagram without mxGraphModel", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
        </diagram>
      </mxfile>`;

      const result = model.importXml(xml);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.cells, 0);
      }
    });
  });

  describe("ID collision prevention", () => {
    it("should set nextId higher than imported IDs", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="cell-50" value="High ID" style="" vertex="1" parent="1">
                <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      model.importXml(xml);

      // Adding a new cell should not collide with imported IDs
      const newCell = model.addRectangle({ text: "New" });
      assertNotEquals(newCell.id, "cell-50");
      // The new ID should have a number > 50
      const numMatch = newCell.id.match(/\d+/);
      assertExists(numMatch);
      assert(parseInt(numMatch![0], 10) > 50);
    });

    it("should handle non-numeric IDs gracefully", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="abc-def" value="Alpha" style="" vertex="1" parent="1">
                <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      const result = model.importXml(xml);
      assertEquals("error" in result, false);

      // Should still be able to add new cells
      const newCell = model.addRectangle({ text: "After non-numeric" });
      assertExists(newCell.id);
    });

    it("should not reuse IDs from deleted cells after import", () => {
      const xml = `<mxfile>
        <diagram id="p1" name="Page 1">
          <mxGraphModel>
            <root>
              <mxCell id="0"/>
              <mxCell id="1" parent="0"/>
              <mxCell id="cell-10" value="Ten" style="" vertex="1" parent="1">
                <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
              <mxCell id="cell-20" value="Twenty" style="" vertex="1" parent="1">
                <mxGeometry x="200" y="10" width="100" height="50" as="geometry"/>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`;

      model.importXml(xml);
      model.deleteCell("cell-20");

      const newCell = model.addRectangle({ text: "After delete" });
      assertNotEquals(newCell.id, "cell-20");
    });
  });

  describe("import bare mxGraphModel", () => {
    it("should import bare mxGraphModel without mxfile wrapper", () => {
      const xml = `<mxGraphModel>
        <root>
          <mxCell id="0"/>
          <mxCell id="1" parent="0"/>
          <mxCell id="2" value="Bare" style="" vertex="1" parent="1">
            <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
          </mxCell>
        </root>
      </mxGraphModel>`;

      const result = model.importXml(xml);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.pages, 1);
        assertEquals(result.cells, 1);
      }

      const cells = model.listCells();
      assertEquals(cells.length, 1);
      assertEquals(cells[0].value, "Bare");
    });
  });
});
