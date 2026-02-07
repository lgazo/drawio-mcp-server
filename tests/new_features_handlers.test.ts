import { describe, it, expect, beforeEach } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { handlers } from "../src/tools.js";
import { diagram } from "../src/diagram_model.js";

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

/** Create a group via create-groups and return the cell data. */
async function createGroup(args: { x?: number; y?: number; width?: number; height?: number; text?: string; style?: string } = {}) {
  const result = await handlers["create-groups"]({ groups: [args] });
  return parseResult(result).data.results[0].cell;
}

/** Add a cell to a group via add-cells-to-group. */
async function addCellToGroup(cellId: string, groupId: string) {
  const result = await handlers["add-cells-to-group"]({
    assignments: [{ cell_id: cellId, group_id: groupId }],
  });
  return parseResult(result).data.results[0];
}

beforeEach(() => {
  diagram.clear();
});

describe("multi-page tool handlers", () => {
  describe("create-page", () => {
    it("should create a new page", async () => {
      const result = await handlers["create-page"]({ name: "Details" });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.page.name).toBe("Details");
      expect(parsed.data.page.id).toBe("page-2");
    });
  });

  describe("list-pages", () => {
    it("should list all pages including active", async () => {
      await handlers["create-page"]({ name: "Extra" });
      const result = await handlers["list-pages"]();
      const parsed = parseResult(result);
      expect(parsed.data.pages).toHaveLength(2);
      expect(parsed.data.active_page.id).toBe("page-1");
    });
  });

  describe("get-active-page", () => {
    it("should return the active page", async () => {
      const result = await handlers["get-active-page"]();
      const parsed = parseResult(result);
      expect(parsed.data.page.name).toBe("Page-1");
    });
  });

  describe("set-active-page", () => {
    it("should switch pages", async () => {
      const createResult = await handlers["create-page"]({ name: "P2" });
      const pageId = parseResult(createResult).data.page.id;

      const result = await handlers["set-active-page"]({ page_id: pageId });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.page.name).toBe("P2");
    });

    it("should return error for non-existent page", async () => {
      const result = await handlers["set-active-page"]({ page_id: "nonexistent" });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("PAGE_NOT_FOUND");
    });

    it("should isolate cells between pages", async () => {
      await addVertex({ text: "P1 Cell" });

      const createResult = await handlers["create-page"]({ name: "P2" });
      const pageId = parseResult(createResult).data.page.id;
      await handlers["set-active-page"]({ page_id: pageId });

      // Page 2 should be empty
      const statsResult = await handlers["get-diagram-stats"]();
      const stats = parseResult(statsResult).data.stats;
      expect(stats.total_cells).toBe(0);

      // Add to page 2
      await addVertex({ text: "P2 Cell" });

      // Switch back to page 1
      await handlers["set-active-page"]({ page_id: "page-1" });
      const statsResult2 = await handlers["get-diagram-stats"]();
      const stats2 = parseResult(statsResult2).data.stats;
      expect(stats2.total_cells).toBe(1);
    });
  });

  describe("rename-page", () => {
    it("should rename a page", async () => {
      const result = await handlers["rename-page"]({ page_id: "page-1", name: "Overview" });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.page.name).toBe("Overview");
    });

    it("should return error for non-existent page", async () => {
      const result = await handlers["rename-page"]({ page_id: "nonexistent", name: "X" });
      expect(result.isError).toBe(true);
    });
  });

  describe("delete-page", () => {
    it("should delete a page", async () => {
      await handlers["create-page"]({ name: "Deletable" });
      const result = await handlers["delete-page"]({ page_id: "page-2" });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.deleted).toBe(true);
      expect(parsed.data.remaining_pages).toHaveLength(1);
    });

    it("should error when deleting the last page", async () => {
      const result = await handlers["delete-page"]({ page_id: "page-1" });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("CANNOT_DELETE_LAST_PAGE");
    });

    it("should error for non-existent page", async () => {
      await handlers["create-page"]({ name: "Extra" });
      const result = await handlers["delete-page"]({ page_id: "nonexistent" });
      expect(result.isError).toBe(true);
    });
  });
});

describe("group tool handlers", () => {
  describe("create-groups", () => {
    it("should create a single group with defaults", async () => {
      const result = await handlers["create-groups"]({ groups: [{}] });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.summary.succeeded).toBe(1);
      expect(parsed.data.results[0].cell.isGroup).toBe(true);
      expect(parsed.data.results[0].cell.width).toBe(400);
      expect(parsed.data.results[0].cell.height).toBe(300);
    });

    it("should create a single group with custom properties", async () => {
      const result = await handlers["create-groups"]({
        groups: [{
          x: 50, y: 75, width: 600, height: 400,
          text: "VNet", style: "fillColor=#e6f2fa;",
        }],
      });
      const parsed = parseResult(result);
      expect(parsed.data.results[0].cell.value).toBe("VNet");
      expect(parsed.data.results[0].cell.width).toBe(600);
    });

    it("should create multiple groups in one call", async () => {
      const result = await handlers["create-groups"]({
        groups: [
          { text: "VNet", width: 600, height: 400, temp_id: "vnet" },
          { text: "Subnet A", x: 50, y: 50, width: 250, height: 200, temp_id: "subnet-a" },
          { text: "Subnet B", x: 320, y: 50, width: 250, height: 200, temp_id: "subnet-b" },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.summary.total).toBe(3);
      expect(parsed.data.summary.succeeded).toBe(3);
      expect(parsed.data.summary.failed).toBe(0);
      expect(parsed.data.results).toHaveLength(3);
      expect(parsed.data.results[0].cell.isGroup).toBe(true);
      expect(parsed.data.results[0].cell.value).toBe("VNet");
      expect(parsed.data.results[0].temp_id).toBe("vnet");
      expect(parsed.data.results[1].temp_id).toBe("subnet-a");
    });

    it("should return error for empty groups array", async () => {
      const result = await handlers["create-groups"]({ groups: [] });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("INVALID_INPUT");
    });
  });

  describe("add-cells-to-group", () => {
    it("should add a single cell to a group", async () => {
      const group = await createGroup({ text: "VNet" });
      const cell = await addVertex({ text: "Subnet" });

      const result = await handlers["add-cells-to-group"]({
        assignments: [{ cell_id: cell.id, group_id: group.id }],
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.summary.succeeded).toBe(1);
      expect(parsed.data.results[0].cell.parent).toBe(group.id);
    });

    it("should assign multiple cells to groups in one call", async () => {
      const g1 = await createGroup({ text: "Group 1" });
      const g2 = await createGroup({ text: "Group 2" });
      const c1 = await addVertex({ text: "A" });
      const c2 = await addVertex({ text: "B" });
      const c3 = await addVertex({ text: "C" });

      const result = await handlers["add-cells-to-group"]({
        assignments: [
          { cell_id: c1.id, group_id: g1.id },
          { cell_id: c2.id, group_id: g1.id },
          { cell_id: c3.id, group_id: g2.id },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.summary.total).toBe(3);
      expect(parsed.data.summary.succeeded).toBe(3);
      expect(parsed.data.summary.failed).toBe(0);
      expect(parsed.data.results[0].cell.parent).toBe(g1.id);
      expect(parsed.data.results[2].cell.parent).toBe(g2.id);
    });

    it("should return error for empty assignments array", async () => {
      const result = await handlers["add-cells-to-group"]({ assignments: [] });
      expect(result.isError).toBe(true);
      const parsed = parseResult(result);
      expect(parsed.error.code).toBe("INVALID_INPUT");
    });

    it("should handle mixed success and failure", async () => {
      const group = await createGroup({ text: "Group" });
      const cell = await addVertex({ text: "A" });

      const result = await handlers["add-cells-to-group"]({
        assignments: [
          { cell_id: cell.id, group_id: group.id },
          { cell_id: "nonexistent", group_id: group.id },
        ],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.succeeded).toBe(1);
      expect(parsed.data.summary.failed).toBe(1);
      expect(parsed.data.results[0].success).toBe(true);
      expect(parsed.data.results[1].success).toBe(false);
      expect(parsed.data.results[1].error.code).toBe("CELL_NOT_FOUND");
    });

    it("should report cell_id and group_id in results", async () => {
      const group = await createGroup({ text: "G" });
      const cell = await addVertex({ text: "A" });

      const result = await handlers["add-cells-to-group"]({
        assignments: [{ cell_id: cell.id, group_id: group.id }],
      });
      const parsed = parseResult(result);
      expect(parsed.data.results[0].cell_id).toBe(cell.id);
      expect(parsed.data.results[0].group_id).toBe(group.id);
    });

    it("should error for non-existent group", async () => {
      const cell = await addVertex({ text: "A" });

      const result = await handlers["add-cells-to-group"]({
        assignments: [{ cell_id: cell.id, group_id: "nonexistent" }],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.failed).toBe(1);
      expect(parsed.data.results[0].error.code).toBe("GROUP_NOT_FOUND");
    });

    it("should error when target is not a group", async () => {
      const c1 = await addVertex({ text: "A" });
      const c2 = await addVertex({ text: "B" });

      const result = await handlers["add-cells-to-group"]({
        assignments: [{ cell_id: c1.id, group_id: c2.id }],
      });
      const parsed = parseResult(result);
      expect(parsed.data.summary.failed).toBe(1);
      expect(parsed.data.results[0].error.code).toBe("NOT_A_GROUP");
    });
  });

  describe("remove-cell-from-group", () => {
    it("should remove a cell from its group", async () => {
      const group = await createGroup({ text: "G" });
      const cell = await addVertex({ text: "C" });
      await addCellToGroup(cell.id, group.id);

      const result = await handlers["remove-cell-from-group"]({ cell_id: cell.id });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.cell.parent).toBe("1"); // Back to default layer
    });

    it("should error for non-existent cell", async () => {
      const result = await handlers["remove-cell-from-group"]({ cell_id: "nonexistent" });
      expect(result.isError).toBe(true);
    });

    it("should error when cell is not in a group", async () => {
      const cell = await addVertex({ text: "A" });

      const result = await handlers["remove-cell-from-group"]({ cell_id: cell.id });
      expect(result.isError).toBe(true);
    });
  });

  describe("list-group-children", () => {
    it("should list children of a group", async () => {
      const group = await createGroup({ text: "G" });
      const c1 = await addVertex({ text: "A" });
      const c2 = await addVertex({ text: "B" });
      await addCellToGroup(c1.id, group.id);
      await addCellToGroup(c2.id, group.id);

      const result = await handlers["list-group-children"]({ group_id: group.id });
      const parsed = parseResult(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.total).toBe(2);
      expect(parsed.data.children).toHaveLength(2);
    });

    it("should error for non-existent group", async () => {
      const result = await handlers["list-group-children"]({ group_id: "nonexistent" });
      expect(result.isError).toBe(true);
    });

    it("should error when cell is not a group", async () => {
      const cell = await addVertex({ text: "A" });

      const result = await handlers["list-group-children"]({ group_id: cell.id });
      expect(result.isError).toBe(true);
    });
  });
});

describe("import-diagram handler", () => {
  it("should import valid Draw.io XML", async () => {
    const xml = `<mxfile host="test">
    <diagram id="d1" name="Test">
        <mxGraphModel><root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="2" value="Imported" style="" vertex="1" parent="1">
                <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
            </mxCell>
        </root></mxGraphModel>
    </diagram>
</mxfile>`;

    const result = await handlers["import-diagram"]({ xml });
    const parsed = parseResult(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data.pages).toBe(1);
    expect(parsed.data.cells).toBe(1);
    expect(parsed.data.message).toContain("Imported");
  });

  it("should return error for empty XML", async () => {
    const result = await handlers["import-diagram"]({ xml: "" });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error.code).toBe("EMPTY_XML");
  });

  it("should return error for invalid XML", async () => {
    const result = await handlers["import-diagram"]({ xml: "<html></html>" });
    expect(result.isError).toBe(true);
    const parsed = parseResult(result);
    expect(parsed.error.code).toBe("INVALID_XML");
  });

  it("should import multi-page XML", async () => {
    const xml = `<mxfile host="test">
    <diagram id="p1" name="Overview">
        <mxGraphModel><root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="10" value="A" style="" vertex="1" parent="1">
                <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
            </mxCell>
        </root></mxGraphModel>
    </diagram>
    <diagram id="p2" name="Details">
        <mxGraphModel><root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="20" value="B" style="" vertex="1" parent="1">
                <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
            </mxCell>
        </root></mxGraphModel>
    </diagram>
</mxfile>`;

    const result = await handlers["import-diagram"]({ xml });
    const parsed = parseResult(result);
    expect(parsed.data.pages).toBe(2);
    expect(parsed.data.cells).toBe(2);
  });

  it("should allow modifications after import", async () => {
    const xml = `<mxfile host="test">
    <diagram id="d1" name="Test">
        <mxGraphModel><root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="2" value="Existing" style="" vertex="1" parent="1">
                <mxGeometry x="0" y="0" width="100" height="50" as="geometry"/>
            </mxCell>
        </root></mxGraphModel>
    </diagram>
</mxfile>`;

    await handlers["import-diagram"]({ xml });

    // Should be able to add new cells after import
    const cell = await addVertex({ text: "New Cell" });
    expect(cell.type).toBe("vertex");

    // Should now have 2 cells
    const statsResult = await handlers["get-diagram-stats"]();
    const stats = parseResult(statsResult).data.stats;
    expect(stats.total_cells).toBe(2);
  });
});
