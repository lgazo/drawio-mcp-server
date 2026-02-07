import { describe, it, beforeEach } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { DiagramModel } from "../src/diagram_model.ts";

describe("DiagramModel multi-page", () => {
  let model: DiagramModel;

  beforeEach(() => {
    model = new DiagramModel();
  });

  describe("createPage", () => {
    it("should create a new page with the given name", () => {
      const page = model.createPage("Details");
      assertEquals(page.id, "page-2");
      assertEquals(page.name, "Details");
    });

    it("should create multiple pages with sequential IDs", () => {
      const p2 = model.createPage("Page 2");
      const p3 = model.createPage("Page 3");
      assertEquals(p2.id, "page-2");
      assertEquals(p3.id, "page-3");
    });
  });

  describe("listPages", () => {
    it("should list the default page initially", () => {
      const pages = model.listPages();
      assertEquals(pages.length, 1);
      assertEquals(pages[0].name, "Page-1");
    });

    it("should include all created pages", () => {
      model.createPage("Network");
      model.createPage("Security");
      const pages = model.listPages();
      assertEquals(pages.length, 3);
      assertEquals(pages.map(p => p.name), ["Page-1", "Network", "Security"]);
    });
  });

  describe("getActivePage", () => {
    it("should return the default page initially", () => {
      const page = model.getActivePage();
      assertEquals(page.id, "page-1");
      assertEquals(page.name, "Page-1");
    });
  });

  describe("setActivePage", () => {
    it("should switch to the specified page", () => {
      const page2 = model.createPage("Details");
      const result = model.setActivePage(page2.id);
      assertEquals("error" in result, false);
      assertEquals(model.getActivePage().id, page2.id);
    });

    it("should return error for non-existent page", () => {
      const result = model.setActivePage("nonexistent");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "PAGE_NOT_FOUND");
      }
    });

    it("should return the page when already active (no-op)", () => {
      const result = model.setActivePage("page-1");
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.id, "page-1");
      }
    });

    it("should preserve cells per page", () => {
      model.addRectangle({ text: "Page1 Cell" });
      assertEquals(model.listCells().length, 1);
      const page2 = model.createPage("Page 2");
      model.setActivePage(page2.id);
      assertEquals(model.listCells().length, 0);
      model.addRectangle({ text: "Page2 Cell" });
      assertEquals(model.listCells().length, 1);
      model.setActivePage("page-1");
      assertEquals(model.listCells().length, 1);
      assertEquals(model.listCells()[0].value, "Page1 Cell");
    });

    it("should preserve layers per page", () => {
      model.createLayer("Custom Layer");
      assertEquals(model.listLayers().length, 2);
      const page2 = model.createPage("Page 2");
      model.setActivePage(page2.id);
      assertEquals(model.listLayers().length, 1);
      model.setActivePage("page-1");
      assertEquals(model.listLayers().length, 2);
    });

    it("should preserve nextId per page", () => {
      model.addRectangle({ text: "A" });
      model.addRectangle({ text: "B" });
      const page2 = model.createPage("P2");
      model.setActivePage(page2.id);
      const cell = model.addRectangle({ text: "P2 First" });
      assertEquals(cell.id, "cell-2");
      model.setActivePage("page-1");
      const cellP1 = model.addRectangle({ text: "C" });
      assertEquals(cellP1.id, "cell-4");
    });
  });

  describe("renamePage", () => {
    it("should rename an existing page", () => {
      const result = model.renamePage("page-1", "Overview");
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.name, "Overview");
      }
    });

    it("should return error for non-existent page", () => {
      const result = model.renamePage("nonexistent", "X");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "PAGE_NOT_FOUND");
      }
    });
  });

  describe("deletePage", () => {
    it("should delete an existing page", () => {
      model.createPage("ToDelete");
      const result = model.deletePage("page-2");
      assertEquals(result.deleted, true);
      assertEquals(model.listPages().length, 1);
    });

    it("should not delete the last page", () => {
      const result = model.deletePage("page-1");
      assertEquals(result.deleted, false);
      assertEquals(result.error?.code, "CANNOT_DELETE_LAST_PAGE");
    });

    it("should return error for non-existent page", () => {
      model.createPage("Extra");
      const result = model.deletePage("nonexistent");
      assertEquals(result.deleted, false);
      assertEquals(result.error?.code, "PAGE_NOT_FOUND");
    });

    it("should switch to first page when deleting the active page", () => {
      const page2 = model.createPage("Active");
      model.setActivePage(page2.id);
      assertEquals(model.getActivePage().id, page2.id);
      model.deletePage(page2.id);
      assertEquals(model.getActivePage().id, "page-1");
    });

    it("should not switch pages when deleting a non-active page", () => {
      model.createPage("Other");
      assertEquals(model.getActivePage().id, "page-1");
      model.deletePage("page-2");
      assertEquals(model.getActivePage().id, "page-1");
    });
  });

  describe("toXml multi-page", () => {
    it("should export a single page diagram", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml();
      assert(xml.includes('<diagram id="page-1" name="Page-1">'));
      assert(xml.includes("Hello"));
      assertEquals((xml.match(/<diagram /g) || []).length, 1);
    });

    it("should export multiple pages", () => {
      model.addRectangle({ text: "P1 Cell" });
      const page2 = model.createPage("Details");
      model.setActivePage(page2.id);
      model.addRectangle({ text: "P2 Cell" });
      const xml = model.toXml();
      assertEquals((xml.match(/<diagram /g) || []).length, 2);
      assert(xml.includes('name="Page-1"'));
      assert(xml.includes('name="Details"'));
      assert(xml.includes("P1 Cell"));
      assert(xml.includes("P2 Cell"));
    });

    it("should include layers per page in XML output", () => {
      model.createLayer("Network");
      const page2 = model.createPage("Page 2");
      model.setActivePage(page2.id);
      model.createLayer("Security");
      const xml = model.toXml();
      assert(xml.includes("Network"));
      assert(xml.includes("Security"));
    });
  });

  describe("clear resets pages", () => {
    it("should reset to a single page after clear", () => {
      model.createPage("Extra");
      model.addRectangle({ text: "A" });
      model.clear();
      assertEquals(model.listPages().length, 1);
      assertEquals(model.getActivePage().name, "Page-1");
      assertEquals(model.listCells().length, 0);
    });

    it("should count cells across all pages when clearing", () => {
      model.addRectangle({ text: "P1" });
      const page2 = model.createPage("P2");
      model.setActivePage(page2.id);
      model.addRectangle({ text: "P2a" });
      model.addRectangle({ text: "P2b" });
      const cleared = model.clear();
      assertEquals(cleared.vertices, 3);
      assertEquals(cleared.edges, 0);
    });
  });

  describe("getStats includes page info", () => {
    it("should report page count and active page", () => {
      model.createPage("P2");
      const stats = model.getStats();
      assertEquals(stats.pages, 2);
      assertEquals(stats.active_page, "page-1");
    });
  });
});
