import { DiagramModel } from "../src/diagram_model.js";

describe("DiagramModel multi-page", () => {
  let model: DiagramModel;

  beforeEach(() => {
    model = new DiagramModel();
  });

  describe("createPage", () => {
    it("should create a new page with the given name", () => {
      const page = model.createPage("Details");
      expect(page.id).toBe("page-2");
      expect(page.name).toBe("Details");
    });

    it("should create multiple pages with sequential IDs", () => {
      const p2 = model.createPage("Page 2");
      const p3 = model.createPage("Page 3");
      expect(p2.id).toBe("page-2");
      expect(p3.id).toBe("page-3");
    });
  });

  describe("listPages", () => {
    it("should list the default page initially", () => {
      const pages = model.listPages();
      expect(pages).toHaveLength(1);
      expect(pages[0].name).toBe("Page-1");
    });

    it("should include all created pages", () => {
      model.createPage("Network");
      model.createPage("Security");
      const pages = model.listPages();
      expect(pages).toHaveLength(3);
      expect(pages.map(p => p.name)).toEqual(["Page-1", "Network", "Security"]);
    });
  });

  describe("getActivePage", () => {
    it("should return the default page initially", () => {
      const page = model.getActivePage();
      expect(page.id).toBe("page-1");
      expect(page.name).toBe("Page-1");
    });
  });

  describe("setActivePage", () => {
    it("should switch to the specified page", () => {
      const page2 = model.createPage("Details");
      const result = model.setActivePage(page2.id);
      expect("error" in result).toBe(false);
      expect(model.getActivePage().id).toBe(page2.id);
    });

    it("should return error for non-existent page", () => {
      const result = model.setActivePage("nonexistent");
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("PAGE_NOT_FOUND");
      }
    });

    it("should return the page when already active (no-op)", () => {
      const result = model.setActivePage("page-1");
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.id).toBe("page-1");
      }
    });

    it("should preserve cells per page", () => {
      // Add cells to page 1
      model.addRectangle({ text: "Page1 Cell" });
      expect(model.listCells()).toHaveLength(1);

      // Switch to page 2
      const page2 = model.createPage("Page 2");
      model.setActivePage(page2.id);

      // Page 2 should be empty
      expect(model.listCells()).toHaveLength(0);

      // Add cell to page 2
      model.addRectangle({ text: "Page2 Cell" });
      expect(model.listCells()).toHaveLength(1);

      // Switch back to page 1
      model.setActivePage("page-1");
      expect(model.listCells()).toHaveLength(1);
      expect(model.listCells()[0].value).toBe("Page1 Cell");
    });

    it("should preserve layers per page", () => {
      model.createLayer("Custom Layer");
      expect(model.listLayers()).toHaveLength(2);

      const page2 = model.createPage("Page 2");
      model.setActivePage(page2.id);

      // Page 2 has only its default layer
      expect(model.listLayers()).toHaveLength(1);

      // Switch back
      model.setActivePage("page-1");
      expect(model.listLayers()).toHaveLength(2);
    });

    it("should preserve nextId per page", () => {
      model.addRectangle({ text: "A" }); // cell-2
      model.addRectangle({ text: "B" }); // cell-3

      const page2 = model.createPage("P2");
      model.setActivePage(page2.id);

      const cell = model.addRectangle({ text: "P2 First" });
      expect(cell.id).toBe("cell-2"); // Independent ID space

      model.setActivePage("page-1");
      const cellP1 = model.addRectangle({ text: "C" });
      expect(cellP1.id).toBe("cell-4"); // Continues from page 1
    });
  });

  describe("renamePage", () => {
    it("should rename an existing page", () => {
      const result = model.renamePage("page-1", "Overview");
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.name).toBe("Overview");
      }
    });

    it("should return error for non-existent page", () => {
      const result = model.renamePage("nonexistent", "X");
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.code).toBe("PAGE_NOT_FOUND");
      }
    });
  });

  describe("deletePage", () => {
    it("should delete an existing page", () => {
      model.createPage("ToDelete");
      const result = model.deletePage("page-2");
      expect(result.deleted).toBe(true);
      expect(model.listPages()).toHaveLength(1);
    });

    it("should not delete the last page", () => {
      const result = model.deletePage("page-1");
      expect(result.deleted).toBe(false);
      expect(result.error?.code).toBe("CANNOT_DELETE_LAST_PAGE");
    });

    it("should return error for non-existent page", () => {
      model.createPage("Extra"); // need 2 pages to avoid last-page guard
      const result = model.deletePage("nonexistent");
      expect(result.deleted).toBe(false);
      expect(result.error?.code).toBe("PAGE_NOT_FOUND");
    });

    it("should switch to first page when deleting the active page", () => {
      const page2 = model.createPage("Active");
      model.setActivePage(page2.id);
      expect(model.getActivePage().id).toBe(page2.id);

      model.deletePage(page2.id);
      expect(model.getActivePage().id).toBe("page-1");
    });

    it("should not switch pages when deleting a non-active page", () => {
      model.createPage("Other");
      expect(model.getActivePage().id).toBe("page-1");

      model.deletePage("page-2");
      expect(model.getActivePage().id).toBe("page-1");
    });
  });

  describe("toXml multi-page", () => {
    it("should export a single page diagram", () => {
      model.addRectangle({ text: "Hello" });
      const xml = model.toXml();
      expect(xml).toContain('<diagram id="page-1" name="Page-1">');
      expect(xml).toContain("Hello");
      // Should only have one <diagram> element
      expect((xml.match(/<diagram /g) || []).length).toBe(1);
    });

    it("should export multiple pages", () => {
      model.addRectangle({ text: "P1 Cell" });

      const page2 = model.createPage("Details");
      model.setActivePage(page2.id);
      model.addRectangle({ text: "P2 Cell" });

      const xml = model.toXml();
      expect((xml.match(/<diagram /g) || []).length).toBe(2);
      expect(xml).toContain('name="Page-1"');
      expect(xml).toContain('name="Details"');
      expect(xml).toContain("P1 Cell");
      expect(xml).toContain("P2 Cell");
    });

    it("should include layers per page in XML output", () => {
      model.createLayer("Network");
      const page2 = model.createPage("Page 2");
      model.setActivePage(page2.id);
      model.createLayer("Security");

      const xml = model.toXml();
      expect(xml).toContain("Network");
      expect(xml).toContain("Security");
    });
  });

  describe("clear resets pages", () => {
    it("should reset to a single page after clear", () => {
      model.createPage("Extra");
      model.addRectangle({ text: "A" });
      model.clear();
      expect(model.listPages()).toHaveLength(1);
      expect(model.getActivePage().name).toBe("Page-1");
      expect(model.listCells()).toHaveLength(0);
    });

    it("should count cells across all pages when clearing", () => {
      model.addRectangle({ text: "P1" });
      const page2 = model.createPage("P2");
      model.setActivePage(page2.id);
      model.addRectangle({ text: "P2a" });
      model.addRectangle({ text: "P2b" });

      const cleared = model.clear();
      expect(cleared.vertices).toBe(3);
      expect(cleared.edges).toBe(0);
    });
  });

  describe("getStats includes page info", () => {
    it("should report page count and active page", () => {
      model.createPage("P2");
      const stats = model.getStats();
      expect(stats.pages).toBe(2);
      expect(stats.active_page).toBe("page-1");
    });
  });
});
