import { DiagramModel } from "../src/diagram_model.js";

describe("DiagramModel importXml", () => {
  let model: DiagramModel;

  beforeEach(() => {
    model = new DiagramModel();
  });

  const SINGLE_PAGE_XML = `<mxfile host="app.diagrams.net">
    <diagram id="d1" name="Overview">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="Hello" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
                    <mxGeometry x="100" y="200" width="120" height="60" as="geometry"/>
                </mxCell>
                <mxCell id="3" value="World" style="fillColor=#dae8fc;" vertex="1" parent="1">
                    <mxGeometry x="300" y="200" width="120" height="60" as="geometry"/>
                </mxCell>
                <mxCell id="4" value="link" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="2" target="3">
                    <mxGeometry relative="1" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;

  const MULTI_PAGE_XML = `<mxfile host="app.diagrams.net">
    <diagram id="page1" name="Overview">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="10" value="Web App" style="fillColor=#dae8fc;" vertex="1" parent="1">
                    <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
    </diagram>
    <diagram id="page2" name="Details">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="20" value="Database" style="shape=cylinder3;" vertex="1" parent="1">
                    <mxGeometry x="200" y="150" width="80" height="100" as="geometry"/>
                </mxCell>
                <mxCell id="21" value="Cache" style="fillColor=#f8cecc;" vertex="1" parent="1">
                    <mxGeometry x="400" y="150" width="100" height="60" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;

  const XML_WITH_LAYERS = `<mxfile host="app.diagrams.net">
    <diagram id="d1" name="Layered">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="network-layer" value="Network" style="" parent="0"/>
                <mxCell id="5" value="Server" style="fillColor=#dae8fc;" vertex="1" parent="1">
                    <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
                </mxCell>
                <mxCell id="6" value="Firewall" style="fillColor=#f8cecc;" vertex="1" parent="network-layer">
                    <mxGeometry x="300" y="100" width="120" height="60" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;

  const XML_WITH_GROUPS = `<mxfile host="app.diagrams.net">
    <diagram id="d1" name="Groups">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="g1" value="VNet" style="rounded=1;container=1;collapsible=0;" vertex="1" parent="1">
                    <mxGeometry x="50" y="50" width="400" height="300" as="geometry"/>
                </mxCell>
                <mxCell id="s1" value="Subnet A" style="fillColor=#dae8fc;" vertex="1" parent="g1">
                    <mxGeometry x="20" y="40" width="160" height="80" as="geometry"/>
                </mxCell>
                <mxCell id="s2" value="Subnet B" style="fillColor=#d5e8d4;" vertex="1" parent="g1">
                    <mxGeometry x="220" y="40" width="160" height="80" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;

  describe("single page import", () => {
    it("should import a single page diagram", () => {
      const result = model.importXml(SINGLE_PAGE_XML);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.pages).toBe(1);
        expect(result.cells).toBe(3); // 2 vertices + 1 edge
        expect(result.layers).toBe(1);
      }
    });

    it("should restore vertex cell properties", () => {
      model.importXml(SINGLE_PAGE_XML);
      const cell = model.getCell("2");
      expect(cell).toBeDefined();
      expect(cell!.value).toBe("Hello");
      expect(cell!.x).toBe(100);
      expect(cell!.y).toBe(200);
      expect(cell!.width).toBe(120);
      expect(cell!.height).toBe(60);
      expect(cell!.type).toBe("vertex");
    });

    it("should restore edge cell properties", () => {
      model.importXml(SINGLE_PAGE_XML);
      const edge = model.getCell("4");
      expect(edge).toBeDefined();
      expect(edge!.type).toBe("edge");
      expect(edge!.sourceId).toBe("2");
      expect(edge!.targetId).toBe("3");
      expect(edge!.value).toBe("link");
    });

    it("should set nextId high enough for new cells", () => {
      model.importXml(SINGLE_PAGE_XML);
      const newCell = model.addRectangle({ text: "New" });
      // nextId should be > 4 (highest ID in imported XML)
      expect(parseInt(newCell.id.replace("cell-", ""), 10)).toBeGreaterThan(4);
    });
  });

  describe("multi-page import", () => {
    it("should import multiple pages", () => {
      const result = model.importXml(MULTI_PAGE_XML);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.pages).toBe(2);
      }
    });

    it("should create pages with correct names", () => {
      model.importXml(MULTI_PAGE_XML);
      const pages = model.listPages();
      expect(pages).toHaveLength(2);
      expect(pages[0].name).toBe("Overview");
      expect(pages[1].name).toBe("Details");
    });

    it("should activate the first page", () => {
      model.importXml(MULTI_PAGE_XML);
      const active = model.getActivePage();
      expect(active.name).toBe("Overview");
    });

    it("should make first page cells accessible", () => {
      model.importXml(MULTI_PAGE_XML);
      const cells = model.listCells();
      expect(cells).toHaveLength(1);
      expect(cells[0].value).toBe("Web App");
    });

    it("should have second page cells after switching", () => {
      model.importXml(MULTI_PAGE_XML);
      model.setActivePage("page-2");
      const cells = model.listCells();
      expect(cells).toHaveLength(2);
      expect(cells.map(c => c.value)).toContain("Database");
      expect(cells.map(c => c.value)).toContain("Cache");
    });
  });

  describe("import with layers", () => {
    it("should import custom layers", () => {
      model.importXml(XML_WITH_LAYERS);
      const layers = model.listLayers();
      expect(layers).toHaveLength(2);
      expect(layers.find(l => l.name === "Network")).toBeDefined();
    });

    it("should assign cells to correct layers", () => {
      model.importXml(XML_WITH_LAYERS);
      const firewall = model.getCell("6");
      expect(firewall).toBeDefined();
      expect(firewall!.parent).toBe("network-layer");
    });
  });

  describe("import with groups", () => {
    it("should import group cells with isGroup flag", () => {
      model.importXml(XML_WITH_GROUPS);
      const group = model.getCell("g1");
      expect(group).toBeDefined();
      expect(group!.isGroup).toBe(true);
    });

    it("should populate group children", () => {
      model.importXml(XML_WITH_GROUPS);
      const group = model.getCell("g1");
      expect(group!.children).toContain("s1");
      expect(group!.children).toContain("s2");
    });

    it("should set child parent to group ID", () => {
      model.importXml(XML_WITH_GROUPS);
      const child = model.getCell("s1");
      expect(child!.parent).toBe("g1");
    });
  });

  describe("import edge without source/target", () => {
    it("should import edge with no source or target", () => {
      const xml = `<mxfile host="test">
    <diagram id="d1" name="Page">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="" style="edgeStyle=orthogonal;" edge="1" parent="1">
                    <mxGeometry relative="1" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      model.importXml(xml);
      const edge = model.getCell("2");
      expect(edge).toBeDefined();
      expect(edge!.type).toBe("edge");
      expect(edge!.sourceId).toBeUndefined();
      expect(edge!.targetId).toBeUndefined();
    });

    it("should roundtrip edge without source/target without 'undefined' in XML", () => {
      const xml = `<mxfile host="test">
    <diagram id="d1" name="Page">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="" style="edgeStyle=orthogonal;" edge="1" parent="1">
                    <mxGeometry relative="1" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      model.importXml(xml);
      const exported = model.toXml();
      expect(exported).not.toContain('source="undefined"');
      expect(exported).not.toContain('target="undefined"');
      expect(exported).toContain('edge="1"');
    });
  });

  describe("import cell without parent attribute", () => {
    it("should default parent to layer 1 for vertex", () => {
      const xml = `<mxfile host="test">
    <diagram id="d1" name="Page">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="Orphan" style="" vertex="1">
                    <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      model.importXml(xml);
      const cell = model.getCell("2");
      expect(cell).toBeDefined();
      expect(cell!.parent).toBe("1");
    });

    it("should default parent to layer 1 for edge", () => {
      const xml = `<mxfile host="test">
    <diagram id="d1" name="Page">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="" style="" edge="1">
                    <mxGeometry relative="1" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      model.importXml(xml);
      const edge = model.getCell("2");
      expect(edge).toBeDefined();
      expect(edge!.parent).toBe("1");
    });
  });

  describe("import layer without value attribute", () => {
    it("should use layer id as name when value is empty", () => {
      const xml = `<mxfile host="test">
    <diagram id="d1" name="Page">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="custom-layer" parent="0"/>
                <mxCell id="2" value="Box" style="" vertex="1" parent="custom-layer">
                    <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      model.importXml(xml);
      const layers = model.listLayers();
      const customLayer = layers.find(l => l.id === "custom-layer");
      expect(customLayer).toBeDefined();
      expect(customLayer!.name).toBe("custom-layer");
    });
  });

  describe("import cell without id attribute", () => {
    it("should skip cells with no id gracefully", () => {
      const xml = `<mxfile host="test">
    <diagram id="d1" name="Page">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell value="NoId" style="" vertex="1" parent="1">
                    <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
                </mxCell>
                <mxCell id="3" value="HasId" style="" vertex="1" parent="1">
                    <mxGeometry x="200" y="0" width="100" height="50" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      const result = model.importXml(xml);
      expect("error" in result).toBe(false);
      // The cell without id gets id="" which is still stored; the one with id="3" is valid
      const cell = model.getCell("3");
      expect(cell).toBeDefined();
      expect(cell!.value).toBe("HasId");
    });
  });

  describe("import error handling", () => {
    it("should return error for empty XML", () => {
      const result = model.importXml("");
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("EMPTY_XML");
      }
    });

    it("should return error for whitespace-only XML", () => {
      const result = model.importXml("   \n  ");
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("EMPTY_XML");
      }
    });

    it("should return error for non-Draw.io XML", () => {
      const result = model.importXml("<html><body>Not a diagram</body></html>");
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("INVALID_XML");
      }
    });

    it("should handle bare mxGraphModel without mxfile wrapper", () => {
      const bareXml = `<mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="Bare" style="whiteSpace=wrap;" vertex="1" parent="1">
                    <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>`;
      const result = model.importXml(bareXml);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.cells).toBe(1);
      }
    });

    it("should handle diagram element without id or name attributes", () => {
      const xml = `<mxfile host="test">
    <diagram >
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="Test" style="" vertex="1" parent="1">
                    <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      const result = model.importXml(xml);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.cells).toBe(1);
        expect(result.pages).toBe(1);
      }
      // Page should have auto-generated name
      const pages = model.listPages();
      expect(pages[0].name).toBe("Page-1");
    });
  });

  describe("import replaces existing state", () => {
    it("should clear existing cells before importing", () => {
      model.addRectangle({ text: "Existing" });
      expect(model.listCells()).toHaveLength(1);

      model.importXml(SINGLE_PAGE_XML);
      // Should have only imported cells, not existing ones
      const cells = model.listCells();
      expect(cells.find(c => c.value === "Existing")).toBeUndefined();
    });

    it("should clear existing pages before importing", () => {
      model.createPage("Old Page");
      expect(model.listPages()).toHaveLength(2);

      model.importXml(MULTI_PAGE_XML);
      expect(model.listPages()).toHaveLength(2);
      expect(model.listPages()[0].name).toBe("Overview");
    });
  });

  describe("roundtrip: export then import", () => {
    it("should preserve cells through export/import cycle", () => {
      model.addRectangle({ text: "A", x: 50, y: 60, width: 100, height: 80 });
      model.addRectangle({ text: "B", x: 200, y: 60, width: 100, height: 80 });

      const xml = model.toXml();

      // Import into a fresh model
      const model2 = new DiagramModel();
      const result = model2.importXml(xml);
      expect("error" in result).toBe(false);

      const cells = model2.listCells();
      expect(cells).toHaveLength(2);
      expect(cells.map(c => c.value).sort()).toEqual(["A", "B"]);
    });

    it("should preserve edges through export/import cycle", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id, text: "link" });

      const xml = model.toXml();
      const model2 = new DiagramModel();
      model2.importXml(xml);

      const edges = model2.listCells({ cellType: "edge" });
      expect(edges).toHaveLength(1);
      expect(edges[0].value).toBe("link");
    });

    it("should preserve multiple pages through export/import cycle", () => {
      model.addRectangle({ text: "P1" });
      const p2 = model.createPage("Second");
      model.setActivePage(p2.id);
      model.addRectangle({ text: "P2" });

      const xml = model.toXml();
      const model2 = new DiagramModel();
      model2.importXml(xml);

      const pages = model2.listPages();
      expect(pages).toHaveLength(2);

      // Check first page cells
      const p1Cells = model2.listCells();
      expect(p1Cells.map(c => c.value)).toContain("P1");

      // Switch to second page
      model2.setActivePage("page-2");
      const p2Cells = model2.listCells();
      expect(p2Cells.map(c => c.value)).toContain("P2");
    });

    it("should preserve groups through export/import cycle", () => {
      const group = model.createGroup({ text: "VNet", x: 10, y: 20 });
      const child = model.addRectangle({ text: "Subnet" });
      model.addCellToGroup(child.id, group.id);

      const xml = model.toXml();
      const model2 = new DiagramModel();
      model2.importXml(xml);

      const cells = model2.listCells();
      const importedGroup = cells.find(c => c.value === "VNet");
      expect(importedGroup).toBeDefined();
      expect(importedGroup!.isGroup).toBe(true);
      expect(importedGroup!.children).toContain(
        cells.find(c => c.value === "Subnet")!.id
      );
    });

    it("should preserve layers through export/import cycle", () => {
      model.createLayer("Custom");
      const xml = model.toXml();

      const model2 = new DiagramModel();
      model2.importXml(xml);

      const layers = model2.listLayers();
      expect(layers).toHaveLength(2);
      expect(layers.find(l => l.name === "Custom")).toBeDefined();
    });
  });

  describe("import XML with escaped characters", () => {
    it("should unescape XML entities in cell values", () => {
      const xml = `<mxfile host="test">
    <diagram id="d1" name="Test &amp; Page">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="Hello &amp; &lt;World&gt;" style="" vertex="1" parent="1">
                    <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
                </mxCell>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      model.importXml(xml);
      const cell = model.getCell("2");
      expect(cell!.value).toBe("Hello & <World>");

      const pages = model.listPages();
      expect(pages[0].name).toBe("Test & Page");
    });
  });

  describe("import diagram without geometry", () => {
    it("should use default dimensions for cells without mxGeometry", () => {
      const xml = `<mxfile host="test">
    <diagram id="d1" name="Page">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="NoGeo" style="" vertex="1" parent="1"/>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      model.importXml(xml);
      const cell = model.getCell("2");
      expect(cell).toBeDefined();
      expect(cell!.x).toBe(0);
      expect(cell!.y).toBe(0);
      expect(cell!.width).toBe(200);
      expect(cell!.height).toBe(100);
    });
  });

  describe("import with UserObject elements", () => {
    it("should parse UserObject elements as cells", () => {
      const xml = `<mxfile host="test">
    <diagram id="d1" name="Page">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <UserObject id="u1" value="Custom Data" style="fillColor=#dae8fc;" vertex="1" parent="1">
                    <mxCell>
                        <mxGeometry x="50" y="50" width="150" height="80" as="geometry"/>
                    </mxCell>
                </UserObject>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      model.importXml(xml);
      const cell = model.getCell("u1");
      expect(cell).toBeDefined();
      expect(cell!.value).toBe("Custom Data");
      expect(cell!.x).toBe(50);
      expect(cell!.width).toBe(150);
    });

    it("should handle UserObject with empty inner content", () => {
      const xml = `<mxfile host="test">
    <diagram id="d1" name="Page">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <UserObject id="u2" value="Empty" style="" vertex="1" parent="1"></UserObject>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      model.importXml(xml);
      const cell = model.getCell("u2");
      expect(cell).toBeDefined();
      expect(cell!.value).toBe("Empty");
      expect(cell!.x).toBe(0);
      expect(cell!.y).toBe(0);
      expect(cell!.width).toBe(200);
      expect(cell!.height).toBe(100);
    });

    it("should merge inner mxCell attributes onto UserObject when not present on outer element", () => {
      const xml = `<mxfile host="test">
    <diagram id="d1" name="Page">
        <mxGraphModel>
            <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <UserObject id="u3" label="Merged">
                    <mxCell style="fillColor=#f0f0f0;" vertex="1" parent="1">
                        <mxGeometry x="10" y="20" width="130" height="70" as="geometry"/>
                    </mxCell>
                </UserObject>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      model.importXml(xml);
      const cell = model.getCell("u3");
      expect(cell).toBeDefined();
      expect(cell!.value).toBe("Merged");
      expect(cell!.style).toBe("fillColor=#f0f0f0;");
      expect(cell!.type).toBe("vertex");
      expect(cell!.parent).toBe("1");
      expect(cell!.x).toBe(10);
      expect(cell!.y).toBe(20);
      expect(cell!.width).toBe(130);
      expect(cell!.height).toBe(70);
    });
  });

  describe("import group with existing container=1 in style", () => {
    it("should not duplicate container=1 when already present in style", () => {
      // Create a group whose style already has container=1
      model.importXml(XML_WITH_GROUPS); // g1 already has container=1
      const xml = model.toXml();
      // Ensure no "container=1;container=1;" duplication
      expect(xml).not.toContain("container=1;container=1;");
      expect(xml).toContain("container=1");
    });
  });

  describe("import root without mxCell elements", () => {
    it("should handle root containing only UserObject elements", () => {
      const xml = `<mxfile host="test">
    <diagram id="d1" name="Page">
        <mxGraphModel>
            <root>
                <UserObject id="u1" value="Only UO" style="fillColor=#dae8fc;" vertex="1" parent="1">
                    <mxCell>
                        <mxGeometry x="10" y="20" width="100" height="50" as="geometry"/>
                    </mxCell>
                </UserObject>
            </root>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      const result = model.importXml(xml);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.cells).toBe(1);
      }
      const cell = model.getCell("u1");
      expect(cell).toBeDefined();
      expect(cell!.value).toBe("Only UO");
    });
  });

  describe("import mxfile without diagram children", () => {
    it("should handle empty mxfile gracefully", () => {
      const xml = `<mxfile host="test"></mxfile>`;
      const result = model.importXml(xml);
      // Should not error — returns a page with zero cells
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.pages).toBe(1);
        expect(result.cells).toBe(0);
      }
    });
  });

  describe("import diagram without mxGraphModel root", () => {
    it("should handle diagram with no root element gracefully", () => {
      const xml = `<mxfile host="test">
    <diagram id="d1" name="Empty">
        <mxGraphModel>
        </mxGraphModel>
    </diagram>
</mxfile>`;
      const result = model.importXml(xml);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.pages).toBe(1);
        expect(result.cells).toBe(0);
        expect(result.layers).toBe(1);
      }
    });
  });

  describe("ID collision prevention", () => {
    it("should not produce duplicate page IDs after delete and create", () => {
      const p2 = model.createPage("Page 2");
      model.deletePage(p2.id);
      const p3 = model.createPage("Page 3");
      // p3 should NOT reuse p2's ID
      expect(p3.id).not.toBe(p2.id);
      const pages = model.listPages();
      const ids = pages.map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should not produce duplicate layer IDs after page switch and create", () => {
      const l1 = model.createLayer("Layer A");
      const l2 = model.createLayer("Layer B");
      // Switch to a new page and create layers there
      const p2 = model.createPage("Page 2");
      model.setActivePage(p2.id);
      const l3 = model.createLayer("Layer C");
      // All layer IDs should be unique
      expect(new Set([l1.id, l2.id, l3.id]).size).toBe(3);
    });
  });
});
