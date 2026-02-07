import { describe, it, expect, beforeEach, vi } from "vitest";
import { DiagramModel } from "../src/diagram_model.js";
import { handlers, createHandlers } from "../src/tools.js";
import { diagram } from "../src/diagram_model.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

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

  // ─── compressXml / decompressXml static helpers ──────────────

  describe("compressXml and decompressXml", () => {
    it("should roundtrip a simple XML string", () => {
      const xml = '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>';
      const compressed = DiagramModel.compressXml(xml);
      const decompressed = DiagramModel.decompressXml(compressed);
      expect(decompressed).toBe(xml);
    });

    it("should produce a base64 string", () => {
      const xml = '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>';
      const compressed = DiagramModel.compressXml(xml);
      // base64 characters only
      expect(compressed).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it("should produce output different from the input", () => {
      const xml = '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>';
      const compressed = DiagramModel.compressXml(xml);
      expect(compressed).not.toBe(xml);
    });

    it("should roundtrip XML with special characters", () => {
      const xml = '<mxGraphModel><root><mxCell id="0" value="Hello &amp; &lt;World&gt; &quot;test&quot;"/></root></mxGraphModel>';
      const compressed = DiagramModel.compressXml(xml);
      const decompressed = DiagramModel.decompressXml(compressed);
      expect(decompressed).toBe(xml);
    });

    it("should roundtrip XML with unicode characters", () => {
      const xml = '<mxGraphModel><root><mxCell id="0" value="日本語テスト 🎨"/></root></mxGraphModel>';
      const compressed = DiagramModel.compressXml(xml);
      const decompressed = DiagramModel.decompressXml(compressed);
      expect(decompressed).toBe(xml);
    });

    it("should roundtrip an empty root", () => {
      const xml = "<mxGraphModel><root></root></mxGraphModel>";
      const compressed = DiagramModel.compressXml(xml);
      const decompressed = DiagramModel.decompressXml(compressed);
      expect(decompressed).toBe(xml);
    });

    it("should produce smaller output for large XML", () => {
      // Build a large XML string
      const cells = Array.from({ length: 100 }, (_, i) =>
        `<mxCell id="${i + 2}" value="Cell ${i}" style="fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="${i * 10}" y="${i * 10}" width="120" height="60" as="geometry"/></mxCell>`,
      ).join("");
      const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;
      const compressed = DiagramModel.compressXml(xml);
      expect(compressed.length).toBeLessThan(xml.length);
    });
  });

  // ─── toXml with compress option ──────────────────────────────

  describe("toXml with compress option", () => {
    it("should return plain XML when compress is false", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml({ compress: false });
      expect(xml).toContain("<mxGraphModel");
      expect(xml).toContain("<mxCell");
      expect(xml).toContain("Hello");
    });

    it("should return plain XML when compress is omitted", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml();
      expect(xml).toContain("<mxGraphModel");
      expect(xml).toContain("Hello");
    });

    it("should return plain XML when options is undefined", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml(undefined);
      expect(xml).toContain("<mxGraphModel");
    });

    it("should compress diagram content when compress is true", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml({ compress: true });
      // Should still have the mxfile and diagram wrapper
      expect(xml).toContain("<mxfile");
      expect(xml).toContain("<diagram");
      expect(xml).toContain("</diagram>");
      expect(xml).toContain("</mxfile>");
      // Should NOT contain raw mxGraphModel or mxCell (they are compressed)
      expect(xml).not.toContain("<mxGraphModel");
      expect(xml).not.toContain("<mxCell");
      expect(xml).not.toContain("Hello");
    });

    it("should preserve diagram id and name in compressed output", () => {
      model.addRectangle({ text: "Test" });
      const xml = model.toXml({ compress: true });
      expect(xml).toContain('id="page-1"');
      expect(xml).toContain('name="Page-1"');
    });

    it("should compress multi-page diagrams", () => {
      model.addRectangle({ text: "P1 Cell" });
      const page2 = model.createPage("Details");
      model.setActivePage(page2.id);
      model.addRectangle({ text: "P2 Cell" });

      const xml = model.toXml({ compress: true });
      // Both diagram elements present
      expect((xml.match(/<diagram /g) || []).length).toBe(2);
      expect(xml).toContain('name="Page-1"');
      expect(xml).toContain('name="Details"');
      // Raw content should be compressed
      expect(xml).not.toContain("P1 Cell");
      expect(xml).not.toContain("P2 Cell");
      expect(xml).not.toContain("<mxGraphModel");
    });

    it("should produce smaller output than uncompressed", () => {
      // Add enough content to make compression worthwhile
      for (let i = 0; i < 20; i++) {
        model.addRectangle({ text: `Cell ${i}`, x: i * 100, y: i * 50 });
      }
      const plain = model.toXml({ compress: false });
      const compressed = model.toXml({ compress: true });
      expect(compressed.length).toBeLessThan(plain.length);
    });

    it("should handle special characters in compressed output", () => {
      model.addRectangle({ text: '<strong>"Hello" & \'World\'</strong>' });
      const compressed = model.toXml({ compress: true });
      // Should still be valid — roundtrip through import
      const model2 = new DiagramModel();
      const result = model2.importXml(compressed);
      expect("error" in result).toBe(false);
      const cells = model2.listCells();
      expect(cells).toHaveLength(1);
      expect(cells[0].value).toBe('<strong>"Hello" & \'World\'</strong>');
    });
  });

  // ─── importXml with compressed content ───────────────────────

  describe("importXml with compressed diagrams", () => {
    it("should import a compressed single-page diagram", () => {
      model.addRectangle({ text: "Compressed Cell", x: 100, y: 200 });
      const compressed = model.toXml({ compress: true });

      const model2 = new DiagramModel();
      const result = model2.importXml(compressed);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.pages).toBe(1);
        expect(result.cells).toBe(1);
      }

      const cells = model2.listCells();
      expect(cells).toHaveLength(1);
      expect(cells[0].value).toBe("Compressed Cell");
    });

    it("should import a compressed multi-page diagram", () => {
      model.addRectangle({ text: "Page1" });
      const p2 = model.createPage("Second");
      model.setActivePage(p2.id);
      model.addRectangle({ text: "Page2" });

      const compressed = model.toXml({ compress: true });

      const model2 = new DiagramModel();
      const result = model2.importXml(compressed);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.pages).toBe(2);
      }

      // Check first page
      const p1Cells = model2.listCells();
      expect(p1Cells.map(c => c.value)).toContain("Page1");

      // Check second page
      model2.setActivePage("page-2");
      const p2Cells = model2.listCells();
      expect(p2Cells.map(c => c.value)).toContain("Page2");
    });

    it("should preserve edges through compressed roundtrip", () => {
      const a = model.addRectangle({ text: "A" });
      const b = model.addRectangle({ text: "B" });
      model.addEdge({ sourceId: a.id, targetId: b.id, text: "link" });

      const compressed = model.toXml({ compress: true });

      const model2 = new DiagramModel();
      model2.importXml(compressed);

      const edges = model2.listCells({ cellType: "edge" });
      expect(edges).toHaveLength(1);
      expect(edges[0].value).toBe("link");
    });

    it("should preserve layers through compressed roundtrip", () => {
      model.createLayer("Custom");
      const compressed = model.toXml({ compress: true });

      const model2 = new DiagramModel();
      model2.importXml(compressed);

      const layers = model2.listLayers();
      expect(layers.length).toBe(2);
      expect(layers.some(l => l.name === "Custom")).toBe(true);
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
      expect(importedGroup).toBeDefined();
      expect(importedGroup!.isGroup).toBe(true);
      expect(importedGroup!.children).toContain(
        cells.find(c => c.value === "Subnet")!.id,
      );
    });

    it("should still import uncompressed XML after feature is added", () => {
      // Ensure backward compatibility with plain XML
      const plainXml = `<mxfile host="test"><diagram id="d1" name="Page"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="Plain" style="" vertex="1" parent="1"><mxGeometry x="0" y="0" width="100" height="50" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`;
      const result = model.importXml(plainXml);
      expect("error" in result).toBe(false);
      const cells = model.listCells();
      expect(cells).toHaveLength(1);
      expect(cells[0].value).toBe("Plain");
    });
  });

  // ─── Compressed export/import roundtrip through handler ──────

  describe("export-diagram handler with compress", () => {
    beforeEach(() => {
      diagram.clear();
    });

    it("should return compressed XML when compress is true", async () => {
      await handlers["add-cells"]({ cells: [{ type: "vertex", text: "Test" }] });
      const result = await handlers["export-diagram"]({ compress: true });
      const parsed = parseResult(result);
      expect(parsed.data.xml).toContain("<mxfile");
      expect(parsed.data.xml).not.toContain("<mxGraphModel");
      expect(parsed.data.xml).not.toContain("Test");
      expect(parsed.data.stats.total_cells).toBe(1);
      expect(parsed.data.compression).toEqual({
        enabled: true,
        algorithm: "deflate-raw",
        encoding: "base64",
      });
    });

    it("should return plain XML when compress is false", async () => {
      await handlers["add-cells"]({ cells: [{ type: "vertex", text: "Test" }] });
      const result = await handlers["export-diagram"]({ compress: false });
      const parsed = parseResult(result);
      expect(parsed.data.xml).toContain("<mxGraphModel");
      expect(parsed.data.xml).toContain("Test");
      expect(parsed.data.compression).toEqual({ enabled: false });
    });

    it("should return plain XML when compress is not provided", async () => {
      await handlers["add-cells"]({ cells: [{ type: "vertex", text: "Test" }] });
      const result = await handlers["export-diagram"]({});
      const parsed = parseResult(result);
      expect(parsed.data.xml).toContain("<mxGraphModel");
      expect(parsed.data.xml).toContain("Test");
      expect(parsed.data.compression).toEqual({ enabled: false });
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
      expect(exported.data.compression).toEqual({
        enabled: true,
        algorithm: "deflate-raw",
        encoding: "base64",
      });

      // Import compressed output
      const importResult = await handlers["import-diagram"]({ xml: exported.data.xml });
      const imported = parseResult(importResult);
      expect(imported.data.pages).toBe(1);
      expect(imported.data.cells).toBe(3);
    });
  });

  // ─── Compression debug logging ──────────────────────────────

  describe("export-diagram compression debug logging", () => {
    let logSpy: { debug: ReturnType<typeof vi.fn> };
    let loggedHandlers: ReturnType<typeof createHandlers>;

    beforeEach(() => {
      diagram.clear();
      logSpy = { debug: vi.fn() };
      loggedHandlers = createHandlers(logSpy);
    });

    it("should log original size and reduction when compress is true", async () => {
      await loggedHandlers["add-cells"]({ cells: [{ type: "vertex", text: "Compression Log Test" }] });
      await loggedHandlers["export-diagram"]({ compress: true });

      const debugCalls = logSpy.debug.mock.calls.map(c => c[0]);
      const originalSizeLog = debugCalls.find((msg: string) => msg.includes("original size:"));
      const reductionLog = debugCalls.find((msg: string) => msg.includes("compression reduced size by"));

      expect(originalSizeLog).toBeDefined();
      expect(originalSizeLog).toMatch(/^\d{4}-\d{2}-\d{2}T.*\[tool:export-diagram\]\s+original size: [\d.]+ KB$/);

      expect(reductionLog).toBeDefined();
      expect(reductionLog).toMatch(/^\d{4}-\d{2}-\d{2}T.*\[tool:export-diagram\]\s+compression reduced size by -?\d+\.\d{2}%/);
      expect(reductionLog).toContain("\u2192");
    });

    it("should not log compression details when compress is false", async () => {
      await loggedHandlers["add-cells"]({ cells: [{ type: "vertex", text: "No Compress" }] });
      await loggedHandlers["export-diagram"]({ compress: false });

      const debugCalls = logSpy.debug.mock.calls.map(c => c[0]);
      const compressionLogs = debugCalls.filter((msg: string) =>
        msg.includes("original size:") || msg.includes("compression reduced size by")
      );
      expect(compressionLogs).toHaveLength(0);
    });

    it("should not log compression details when compress is omitted", async () => {
      await loggedHandlers["add-cells"]({ cells: [{ type: "vertex", text: "Default" }] });
      await loggedHandlers["export-diagram"]({});

      const debugCalls = logSpy.debug.mock.calls.map(c => c[0]);
      const compressionLogs = debugCalls.filter((msg: string) =>
        msg.includes("original size:") || msg.includes("compression reduced size by")
      );
      expect(compressionLogs).toHaveLength(0);
    });
  });
});
