import { describe, it, beforeEach } from "@std/testing/bdd";
import { assertEquals, assert, assertExists, assertNotEquals } from "@std/assert";
import { DiagramModel } from "../src/diagram_model.ts";

describe("DiagramModel groups", () => {
  let model: DiagramModel;

  beforeEach(() => {
    model = new DiagramModel();
  });

  describe("createGroup", () => {
    it("should create a group with default properties", () => {
      const group = model.createGroup({});
      assertEquals(group.type, "vertex");
      assertEquals(group.isGroup, true);
      assertEquals(group.children, []);
      assertEquals(group.width, 400);
      assertEquals(group.height, 300);
      assert(group.style!.includes("container=1"));
    });

    it("should create a group with custom properties", () => {
      const group = model.createGroup({
        x: 50,
        y: 75,
        width: 600,
        height: 400,
        text: "VNet",
        style: "fillColor=#e6f2fa;strokeColor=#0078d4;",
      });
      assertEquals(group.x, 50);
      assertEquals(group.y, 75);
      assertEquals(group.width, 600);
      assertEquals(group.height, 400);
      assertEquals(group.value, "VNet");
      assertEquals(group.style, "fillColor=#e6f2fa;strokeColor=#0078d4;");
    });

    it("should be retrievable as a regular cell", () => {
      const group = model.createGroup({ text: "My Group" });
      const cell = model.getCell(group.id);
      assertExists(cell);
      assertEquals(cell!.isGroup, true);
    });

    it("should appear in listCells", () => {
      model.createGroup({ text: "G1" });
      model.addRectangle({ text: "R1" });
      const cells = model.listCells();
      assertEquals(cells.length, 2);
    });
  });

  describe("addCellToGroup", () => {
    it("should add a cell to a group", () => {
      const group = model.createGroup({ text: "VNet" });
      const cell = model.addRectangle({ text: "Subnet" });

      const result = model.addCellToGroup(cell.id, group.id);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.parent, group.id);
      }
    });

    it("should add cell ID to group's children list", () => {
      const group = model.createGroup({ text: "VNet" });
      const cell = model.addRectangle({ text: "Subnet" });

      model.addCellToGroup(cell.id, group.id);
      assert(group.children!.includes(cell.id));
    });

    it("should not duplicate child IDs", () => {
      const group = model.createGroup({ text: "VNet" });
      const cell = model.addRectangle({ text: "Subnet" });

      model.addCellToGroup(cell.id, group.id);
      model.addCellToGroup(cell.id, group.id); // duplicate
      assertEquals(group.children!.filter(id => id === cell.id).length, 1);
    });

    it("should return error for non-existent cell", () => {
      const group = model.createGroup({ text: "G" });
      const result = model.addCellToGroup("nonexistent", group.id);
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "CELL_NOT_FOUND");
      }
    });

    it("should return error for non-existent group", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.addCellToGroup(cell.id, "nonexistent");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "GROUP_NOT_FOUND");
      }
    });

    it("should return error when target is not a group", () => {
      const cell1 = model.addRectangle({ text: "A" });
      const cell2 = model.addRectangle({ text: "B" });
      const result = model.addCellToGroup(cell1.id, cell2.id);
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "NOT_A_GROUP");
      }
    });

    it("should return error when adding group to itself", () => {
      const group = model.createGroup({ text: "G" });
      const result = model.addCellToGroup(group.id, group.id);
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "SELF_REFERENCE");
      }
    });

    it("should initialize children array when it is undefined", () => {
      const group = model.createGroup({ text: "G" });
      // Manually delete the children array to test the defensive branch
      delete (group as any).children;
      const cell = model.addRectangle({ text: "A" });

      const result = model.addCellToGroup(cell.id, group.id);
      assertEquals("error" in result, false);
      // children should have been re-created
      assert(group.children!.includes(cell.id));
    });
  });

  describe("removeCellFromGroup", () => {
    it("should remove a cell from its group", () => {
      const group = model.createGroup({ text: "VNet" });
      const cell = model.addRectangle({ text: "Subnet" });
      model.addCellToGroup(cell.id, group.id);

      const result = model.removeCellFromGroup(cell.id);
      assertEquals("error" in result, false);
      if (!("error" in result)) {
        assertEquals(result.parent, "1"); // Back to default layer
      }
      assert(!group.children!.includes(cell.id));
    });

    it("should return error for non-existent cell", () => {
      const result = model.removeCellFromGroup("nonexistent");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "CELL_NOT_FOUND");
      }
    });

    it("should return error when cell is not in a group", () => {
      const cell = model.addRectangle({ text: "A" });
      const result = model.removeCellFromGroup(cell.id);
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "NOT_IN_GROUP");
      }
    });
  });

  describe("listGroupChildren", () => {
    it("should list children of a group", () => {
      const group = model.createGroup({ text: "VNet" });
      const c1 = model.addRectangle({ text: "Subnet A" });
      const c2 = model.addRectangle({ text: "Subnet B" });
      model.addCellToGroup(c1.id, group.id);
      model.addCellToGroup(c2.id, group.id);

      const result = model.listGroupChildren(group.id);
      assertEquals(Array.isArray(result), true);
      if (Array.isArray(result)) {
        assertEquals(result.length, 2);
        assert(result.map(c => c.value).includes("Subnet A"));
        assert(result.map(c => c.value).includes("Subnet B"));
      }
    });

    it("should return empty array for group with no children", () => {
      const group = model.createGroup({ text: "Empty" });
      const result = model.listGroupChildren(group.id);
      assertEquals(Array.isArray(result), true);
      if (Array.isArray(result)) {
        assertEquals(result.length, 0);
      }
    });

    it("should return error for non-existent group", () => {
      const result = model.listGroupChildren("nonexistent");
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "GROUP_NOT_FOUND");
      }
    });

    it("should return error when cell is not a group", () => {
      const cell = model.addRectangle({ text: "Not a group" });
      const result = model.listGroupChildren(cell.id);
      assertEquals("error" in result, true);
      if ("error" in result) {
        assertEquals(result.error.code, "NOT_A_GROUP");
      }
    });

    it("should handle removed children gracefully", () => {
      const group = model.createGroup({ text: "G" });
      const cell = model.addRectangle({ text: "C" });
      model.addCellToGroup(cell.id, group.id);
      // Delete the child cell directly
      model.deleteCell(cell.id);

      const result = model.listGroupChildren(group.id);
      assertEquals(Array.isArray(result), true);
      if (Array.isArray(result)) {
        assertEquals(result.length, 0);
      }
    });
  });

  describe("toXml with groups", () => {
    it("should render group cells with connectable attribute", () => {
      const group = model.createGroup({ text: "Container" });
      model.addRectangle({ text: "Child" });

      const xml = model.toXml();
      assert(xml.includes(`id="${group.id}"`));
      assert(xml.includes('connectable="0"'));
      assert(xml.includes("container=1"));
    });

    it("should render children with group as parent", () => {
      const group = model.createGroup({ text: "VNet" });
      const child = model.addRectangle({ text: "Subnet" });
      model.addCellToGroup(child.id, group.id);

      const xml = model.toXml();
      assert(xml.includes(`parent="${group.id}"`));
    });

    it("should not duplicate container=1 in style if already present", () => {
      const group = model.createGroup({}); // default style includes container=1
      const xml = model.toXml();
      const styleMatch = xml.match(new RegExp(`id="${group.id}"[^>]*style="([^"]*)"`));
      assertNotEquals(styleMatch, null);
      if (styleMatch) {
        const occurrences = (styleMatch[1].match(/container=1/g) || []).length;
        assertEquals(occurrences, 1);
      }
    });

    it("should append container=1 to group style if not present", () => {
      model.createGroup({ text: "VNet", style: "fillColor=#e6f2fa;strokeColor=#0078d4;" });
      const xml = model.toXml();
      assert(xml.includes("fillColor=#e6f2fa;strokeColor=#0078d4;container=1;"));
    });
  });

  describe("getStats includes group count", () => {
    it("should report group count", () => {
      model.createGroup({ text: "G1" });
      model.createGroup({ text: "G2" });
      model.addRectangle({ text: "R1" });

      const stats = model.getStats();
      assertEquals(stats.groups, 2);
      assertEquals(stats.vertices, 3); // Groups are also vertices
    });
  });

  describe("batchCreateGroups", () => {
    it("should create multiple groups in one call", () => {
      const results = model.batchCreateGroups([
        { text: "VNet", width: 600, height: 400, tempId: "vnet" },
        { text: "Subnet A", x: 50, y: 50, width: 250, height: 200, tempId: "subnet-a" },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[0].success, true);
      assertEquals(results[0].cell.isGroup, true);
      assertEquals(results[0].cell.value, "VNet");
      assertEquals(results[0].tempId, "vnet");
      assertEquals(results[1].cell.value, "Subnet A");
      assertEquals(results[1].tempId, "subnet-a");
    });

    it("should create groups with defaults when no params given", () => {
      const results = model.batchCreateGroups([{}]);
      assertEquals(results.length, 1);
      assertEquals(results[0].cell.width, 400);
      assertEquals(results[0].cell.height, 300);
    });

    it("should create groups that appear in listCells", () => {
      model.batchCreateGroups([{ text: "G1" }, { text: "G2" }]);
      const cells = model.listCells();
      assertEquals(cells.length, 2);
      assertEquals(cells.every(c => c.isGroup), true);
    });

    it("should create multiple groups", () => {
      const results = model.batchCreateGroups([
        { text: "G1", x: 0, y: 0 },
        { text: "G2", x: 500, y: 0 },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[0].success, true);
      assertEquals(results[0].cell.isGroup, true);
      assertEquals(results[0].cell.value, "G1");
      assertEquals(results[1].cell.value, "G2");
    });

    it("should preserve tempId in results", () => {
      const results = model.batchCreateGroups([
        { text: "G1", tempId: "tmp-1" },
        { text: "G2", tempId: "tmp-2" },
      ]);
      assertEquals(results[0].tempId, "tmp-1");
      assertEquals(results[1].tempId, "tmp-2");
    });

    it("should handle single group", () => {
      const results = model.batchCreateGroups([{ text: "Solo" }]);
      assertEquals(results.length, 1);
      assertEquals(results[0].cell.value, "Solo");
    });
  });

  describe("batchAddCellsToGroup", () => {
    it("should assign multiple cells to groups in one call", () => {
      const g1 = model.createGroup({ text: "Group 1" });
      const g2 = model.createGroup({ text: "Group 2" });
      const c1 = model.addRectangle({ text: "A" });
      const c2 = model.addRectangle({ text: "B" });
      const c3 = model.addRectangle({ text: "C" });

      const results = model.batchAddCellsToGroup([
        { cellId: c1.id, groupId: g1.id },
        { cellId: c2.id, groupId: g1.id },
        { cellId: c3.id, groupId: g2.id },
      ]);
      assertEquals(results.length, 3);
      assertEquals(results.every(r => r.success), true);
      assertEquals(results[0].cell!.parent, g1.id);
      assertEquals(results[2].cell!.parent, g2.id);
      assert(g1.children!.includes(c1.id));
      assert(g1.children!.includes(c2.id));
      assert(g2.children!.includes(c3.id));
    });

    it("should handle mixed success and failure", () => {
      const g = model.createGroup({ text: "G" });
      const c = model.addRectangle({ text: "A" });

      const results = model.batchAddCellsToGroup([
        { cellId: c.id, groupId: g.id },
        { cellId: "nonexistent", groupId: g.id },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[0].success, true);
      assertEquals(results[1].success, false);
      assertEquals(results[1].error!.code, "CELL_NOT_FOUND");
    });

    it("should report cellId and groupId in results", () => {
      const g = model.createGroup({ text: "G" });
      const c = model.addRectangle({ text: "A" });

      const results = model.batchAddCellsToGroup([
        { cellId: c.id, groupId: g.id },
      ]);
      assertEquals(results[0].cellId, c.id);
      assertEquals(results[0].groupId, g.id);
    });

    it("should add multiple cells to a group", () => {
      const group = model.createGroup({ text: "G" });
      const cell1 = model.addRectangle({ text: "A" });
      const cell2 = model.addRectangle({ text: "B" });

      const results = model.batchAddCellsToGroup([
        { cellId: cell1.id, groupId: group.id },
        { cellId: cell2.id, groupId: group.id },
      ]);
      assertEquals(results.length, 2);
      assertEquals(results[0].success, true);
      assertEquals(results[0].cell!.parent, group.id);
      assertEquals(results[1].success, true);
    });

    it("should report errors for invalid assignments", () => {
      const group = model.createGroup({ text: "G" });

      const results = model.batchAddCellsToGroup([
        { cellId: "nonexistent", groupId: group.id },
      ]);
      assertEquals(results[0].success, false);
      assertEquals(results[0].error!.code, "CELL_NOT_FOUND");
      assertEquals(results[0].cellId, "nonexistent");
      assertEquals(results[0].groupId, group.id);
    });

    it("should handle mixed success and failure alt", () => {
      const group = model.createGroup({ text: "G" });
      const cell1 = model.addRectangle({ text: "A" });

      const results = model.batchAddCellsToGroup([
        { cellId: cell1.id, groupId: group.id },
        { cellId: "nonexistent", groupId: group.id },
      ]);
      assertEquals(results[0].success, true);
      assertEquals(results[1].success, false);
    });
  });
});
