/**
 * Tests for DiagramModel XML compression/decompression (deflate-raw + base64),
 * the `toXml({ compress: true })` option, and roundtrip through handlers.
 */
import { describe, it, beforeEach } from "@std/testing/bdd";
import { assertEquals, assert, assertExists } from "@std/assert";
import { spy } from "@std/testing/mock";
import { DiagramModel } from "../src/diagram_model.ts";
import { handlers, createHandlers } from "../src/tools.ts";
import { diagram } from "../src/diagram_model.ts";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Parse the JSON payload out of a handler result. */
function parseResult(result: CallToolResult): any {
  const content = result.content[0];
  if (content.type !== "text") {
    throw new Error(`Expected text content, got ${content.type}`);
  }
  return JSON.parse(content.text);
}

describe("DiagramModel compression", () => {
  let model: DiagramModel;

  beforeEach(() => {
    model = new DiagramModel();
  });

  // ——— compressXml / decompressXml static helpers ——————————————

  describe("compressXml and decompressXml", () => {
    it("should roundtrip a simple XML string", () => {
      const xml = '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>';
      const compressed = DiagramModel.compressXml(xml);
      const decompressed = DiagramModel.decompressXml(compressed);
      assertEquals(decompressed, xml);
    });

    it("should produce a base64 string", () => {
      const xml = '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>';
      const compressed = DiagramModel.compressXml(xml);
      // base64 characters only
      assert(/^[A-Za-z0-9+/=]+$/.test(compressed));
    });

    it("should produce output different from the input", () => {
      const xml = '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>';
      const compressed = DiagramModel.compressXml(xml);
      assert(compressed !== xml);
    });

    it("should roundtrip XML with special characters", () => {
      const xml = '<mxGraphModel><root><mxCell id="0" value="Hello &amp; &lt;World&gt; &quot;test&quot;"/></root></mxGraphModel>';
      const compressed = DiagramModel.compressXml(xml);
      const decompressed = DiagramModel.decompressXml(compressed);
      assertEquals(decompressed, xml);
    });

    it("should roundtrip XML with unicode characters", () => {
      const xml = '<mxGraphModel><root><mxCell id="0" value="日本語テスト 🎿"/></root></mxGraphModel>';
      const compressed = DiagramModel.compressXml(xml);
      const decompressed = DiagramModel.decompressXml(compressed);
      assertEquals(decompressed, xml);
    });

    it("should roundtrip an empty root", () => {
      const xml = "<mxGraphModel><root></root></mxGraphModel>";
      const compressed = DiagramModel.compressXml(xml);
      const decompressed = DiagramModel.decompressXml(compressed);
      assertEquals(decompressed, xml);
    });

    it("should produce smaller output for large XML", () => {
      // Build a large XML string
      const cells = Array.from({ length: 100 }, (_, i) =>
        `<mxCell id="${i + 2}" value="Cell ${i}" style="fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="${i * 10}" y="${i * 10}" width="120" height="60" as="geometry"/></mxCell>`,
      ).join("");
      const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;
      const compressed = DiagramModel.compressXml(xml);
      assert(compressed.length < xml.length);
    });
  });

  // ——— toXml with compress option ——————————————————————————————

  describe("toXml with compress option", () => {
    it("should return plain XML when compress is false", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml({ compress: false });
      assert(xml.includes("<mxGraphModel"));
      assert(xml.includes("<mxCell"));
      assert(xml.includes("Hello"));
    });

    it("should return plain XML when compress is omitted", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml();
      assert(xml.includes("<mxGraphModel"));
      assert(xml.includes("Hello"));
    });

    it("should return plain XML when options is undefined", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml(undefined);
      assert(xml.includes("<mxGraphModel"));
    });

    it("should compress diagram content when compress is true", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml({ compress: true });
      // Should still have the mxfile and diagram wrapper
      assert(xml.includes("<mxfile"));
      assert(xml.includes("<diagram"));
      assert(xml.includes("</diagram>"));
      assert(xml.includes("</mxfile>"));
      // Should NOT contain raw mxGraphModel or mxCell (they are compressed)
      assert(!xml.includes("<mxGraphModel"));
      assert(!xml.includes("<mxCell"));
      assert(!xml.includes("Hello"));
    });

    it("should preserve diagram id and name in compressed output", () => {
      model.addRectangle({ text: "Test" });
      const xml = model.toXml({ compress: true });
      assert(xml.includes('id="page-1"'));
      assert(xml.includes('name="Page-1"'));
    });

    it("should produce smaller output than uncompressed", () => {
      // Add enough content to make compression worthwhile
      for (let i = 0; i < 20; i++) {
        model.addRectangle({ text: `Cell ${i}`, x: i * 100, y: i * 50 });
      }
      const plain = model.toXml({ compress: false });
      const compressed = model.toXml({ compress: true });
      assert(compressed.length < plain.length);
    });

    it("should handle special characters in compressed output", () => {
      model.addRectangle({ text: '<strong>"Hello" & \'World\'</strong>' });
      const compressed = model.toXml({ compress: true });
      // Should still be valid — roundtrip through import
      const model2 = new DiagramModel();
      const result = model2.importXml(compressed);
      assertEquals("error" in result, false);
      const cells = model2.listCells();
      assertEquals(cells.length, 1);
      assertEquals(cells[0].value, '<strong>"Hello" & \'World\'</strong>');
    });
  });

  // ——— importXml with compressed content ———————————————————————

  describe("importXml with compressed diagrams", () => {
    it("should import a compressed single-page diagram", () => {
      model.addRectangle({ text: "Compressed Cell", x: 100, y: 200 });
      const compressed = model.toXml({ compress: true });

      const model2 = new DiagramModel();
      const result = model2.importXml(compressed);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.pages, 1);
        assertEquals(result.cells, 1);
      }

      const cells = model2.listCells();
      assertEquals(cells.length, 1);
      assertEquals(cells[0].value, "Compressed Cell");
    });

    it("should import a compressed multi-page diagram and merge cells", () => {
      // Manually construct a 2-page compressed XML
      const page1Xml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="10" value="Page1" style="" vertex="1" parent="1"><mxGeometry x="0" y="0" width="100" height="50" as="geometry"/></mxCell></root></mxGraphModel>';
      const page2Xml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="20" value="Page2" style="" vertex="1" parent="1"><mxGeometry x="0" y="0" width="100" height="50" as="geometry"/></mxCell></root></mxGraphModel>';

      const xml = `<mxfile host="test"><diagram id="p1" name="Page-1">${DiagramModel.compressXml(page1Xml)}</diagram><diagram id="p2" name="Second">${DiagramModel.compressXml(page2Xml)}</diagram></mxfile>`;

      const model2 = new DiagramModel();
      const result = model2.importXml(xml);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.pages, 2);
      }

      // Both pages' cells merged into single model
      const cells = model2.listCells();
      assertEquals(cells.length, 2);
      assert(cells.some(c => c.value === "Page1"));
      assert(cells.some(c => c.value === "Page2"));
    });

    it("should preserve edges through compressed roundtrip", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id, text: "link" });

      const compressed = model.toXml({ compress: true });

      const model2 = new DiagramModel();
      model2.importXml(compressed);

      const edges = model2.listCells({ cellType: "edge" });
      assertEquals(edges.length, 1);
      assertEquals(edges[0].value, "link");
    });

    it("should preserve layers through compressed roundtrip", () => {
      model.createLayer("Custom");
      const compressed = model.toXml({ compress: true });

      const model2 = new DiagramModel();
      model2.importXml(compressed);

      const layers = model2.listLayers();
      assertEquals(layers.length, 2);
      assert(layers.some(l => l.name === "Custom"));
    });

    it("should preserve groups through compressed roundtrip", () => {
      const group = model.createGroup({ text: "VNet", x: 10, y: 20 });
      const child = model.addRectangle({ text: "Subnet" });
      model.addCellToGroup(child.id, group.id);

      const compressed = model.toXml({ compress: true });

      const model2 = new DiagramModel();
      model2.importXml(compressed);

      const cells = model2.listCells();
      const importedGroup = cells.find(c => c.value === "VNet");
      assertExists(importedGroup);
      assertEquals(importedGroup!.isGroup, true);
      assert(importedGroup!.children!.includes(
        cells.find(c => c.value === "Subnet")!.id,
      ));
    });

    it("should still import uncompressed XML after feature is added", () => {
      // Ensure backward compatibility with plain XML
      const plainXml = `<mxfile host="test"><diagram id="d1" name="Page"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="Plain" style="" vertex="1" parent="1"><mxGeometry x="0" y="0" width="100" height="50" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`;
      const result = model.importXml(plainXml);
      assertEquals("error" in result, false);
      const cells = model.listCells();
      assertEquals(cells.length, 1);
      assertEquals(cells[0].value, "Plain");
    });
  });

  // ——— Compressed export/import roundtrip through handler ——————

  describe("export-diagram handler with compress", () => {
    beforeEach(() => {
      diagram.clear();
    });

    it("should return compressed XML when compress is true", async () => {
      await handlers["add-cells"]({ cells: [{ type: "vertex", text: "Test" }] });
      const result = await handlers["export-diagram"]({ compress: true });
      const parsed = parseResult(result);
      assert(parsed.data.xml.includes("<mxfile"));
      assert(!parsed.data.xml.includes("<mxGraphModel"));
      assert(!parsed.data.xml.includes("Test"));
      assertEquals(parsed.data.stats.total_cells, 1);
      assertEquals(parsed.data.compression, {
        enabled: true,
        algorithm: "deflate-raw",
        encoding: "base64",
      });
    });

    it("should return plain XML when compress is false", async () => {
      await handlers["add-cells"]({ cells: [{ type: "vertex", text: "Test" }] });
      const result = await handlers["export-diagram"]({ compress: false });
      const parsed = parseResult(result);
      assert(parsed.data.xml.includes("<mxGraphModel"));
      assert(parsed.data.xml.includes("Test"));
      assertEquals(parsed.data.compression, { enabled: false });
    });

    it("should return plain XML when compress is not provided", async () => {
      await handlers["add-cells"]({ cells: [{ type: "vertex", text: "Test" }] });
      const result = await handlers["export-diagram"]({});
      const parsed = parseResult(result);
      assert(parsed.data.xml.includes("<mxGraphModel"));
      assert(parsed.data.xml.includes("Test"));
      assertEquals(parsed.data.compression, { enabled: false });
    });

    it("should produce importable compressed output via handler", async () => {
      await handlers["add-cells"]({
        cells: [
          { type: "vertex", text: "A", temp_id: "a" },
          { type: "vertex", text: "B", temp_id: "b" },
          { type: "edge", source_id: "a", target_id: "b", text: "link" },
        ],
      });
      const exportResult = await handlers["export-diagram"]({ compress: true });
      const exported = parseResult(exportResult);
      assertEquals(exported.data.compression, {
        enabled: true,
        algorithm: "deflate-raw",
        encoding: "base64",
      });

      // Import compressed output
      const importResult = await handlers["import-diagram"]({ xml: exported.data.xml });
      const imported = parseResult(importResult);
      assertEquals(imported.data.pages, 1);
      assertEquals(imported.data.cells, 3);
    });
  });

  // ——— Compression debug logging ——————————————————————————————

  describe("export-diagram compression debug logging", () => {
    beforeEach(() => {
      diagram.clear();
    });

    it("should log compressed size when compress is true", async () => {
      const debugSpy = spy((_msg: string) => {});
      const logSpy = { debug: debugSpy };
      const loggedHandlers = createHandlers(logSpy);

      await loggedHandlers["add-cells"]({ cells: [{ type: "vertex", text: "Compression Log Test" }] });
      await loggedHandlers["export-diagram"]({ compress: true });

      const debugCalls = debugSpy.calls.map(c => c.args[0] as string);
      const compressedSizeLog = debugCalls.find((msg: string) => msg.includes("compressed size:"));

      assertExists(compressedSizeLog);
      assert(/^\d{4}-\d{2}-\d{2}T.*\[tool:export-diagram\]\s+compressed size: [\d.]+ KB$/.test(compressedSizeLog!));
    });

    it("should not log compression details when compress is false", async () => {
      const debugSpy = spy((_msg: string) => {});
      const logSpy = { debug: debugSpy };
      const loggedHandlers = createHandlers(logSpy);

      await loggedHandlers["add-cells"]({ cells: [{ type: "vertex", text: "No Compress" }] });
      await loggedHandlers["export-diagram"]({ compress: false });

      const debugCalls = debugSpy.calls.map(c => c.args[0] as string);
      const compressionLogs = debugCalls.filter((msg: string) =>
        msg.includes("compressed size:")
      );
      assertEquals(compressionLogs.length, 0);
    });

    it("should not log compression details when compress is omitted", async () => {
      const debugSpy = spy((_msg: string) => {});
      const logSpy = { debug: debugSpy };
      const loggedHandlers = createHandlers(logSpy);

      await loggedHandlers["add-cells"]({ cells: [{ type: "vertex", text: "Default" }] });
      await loggedHandlers["export-diagram"]({});

      const debugCalls = debugSpy.calls.map(c => c.args[0] as string);
      const compressionLogs = debugCalls.filter((msg: string) =>
        msg.includes("compressed size:")
      );
      assertEquals(compressionLogs.length, 0);
    });
  });
});
