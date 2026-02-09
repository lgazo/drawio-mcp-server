import { describe, it, beforeEach } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { handlers } from "../src/tools.ts";
import { diagram } from "../src/diagram_model.ts";

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

describe("group tool handlers", () => {
  describe("create-groups", () => {
    it("should create a single group with defaults", async () => {
      const result = await handlers["create-groups"]({ groups: [{}] });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.summary.succeeded, 1);
      assertEquals(parsed.data.results[0].cell.isGroup, true);
      assertEquals(parsed.data.results[0].cell.width, 400);
      assertEquals(parsed.data.results[0].cell.height, 300);
    });

    it("should create a single group with custom properties", async () => {
      const result = await handlers["create-groups"]({
        groups: [{
          x: 50, y: 75, width: 600, height: 400,
          text: "VNet", style: "fillColor=#e6f2fa;",
        }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.results[0].cell.value, "VNet");
      assertEquals(parsed.data.results[0].cell.width, 600);
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
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.summary.total, 3);
      assertEquals(parsed.data.summary.succeeded, 3);
      assertEquals(parsed.data.summary.failed, 0);
      assertEquals(parsed.data.results.length, 3);
      assertEquals(parsed.data.results[0].cell.isGroup, true);
      assertEquals(parsed.data.results[0].cell.value, "VNet");
      assertEquals(parsed.data.results[0].temp_id, "vnet");
      assertEquals(parsed.data.results[1].temp_id, "subnet-a");
    });

    it("should return error for empty groups array", async () => {
      const result = await handlers["create-groups"]({ groups: [] });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "INVALID_INPUT");
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
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.summary.succeeded, 1);
      assertEquals(parsed.data.results[0].cell.parent, group.id);
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
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.summary.total, 3);
      assertEquals(parsed.data.summary.succeeded, 3);
      assertEquals(parsed.data.summary.failed, 0);
      assertEquals(parsed.data.results[0].cell.parent, g1.id);
      assertEquals(parsed.data.results[2].cell.parent, g2.id);
    });

    it("should return error for empty assignments array", async () => {
      const result = await handlers["add-cells-to-group"]({ assignments: [] });
      assertEquals(result.isError, true);
      const parsed = parseResult(result);
      assertEquals(parsed.error.code, "INVALID_INPUT");
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
      assertEquals(parsed.data.summary.succeeded, 1);
      assertEquals(parsed.data.summary.failed, 1);
      assertEquals(parsed.data.results[0].success, true);
      assertEquals(parsed.data.results[1].success, false);
      assertEquals(parsed.data.results[1].error.code, "CELL_NOT_FOUND");
    });

    it("should report cell_id and group_id in results", async () => {
      const group = await createGroup({ text: "G" });
      const cell = await addVertex({ text: "A" });
      const result = await handlers["add-cells-to-group"]({
        assignments: [{ cell_id: cell.id, group_id: group.id }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.results[0].cell_id, cell.id);
      assertEquals(parsed.data.results[0].group_id, group.id);
    });

    it("should error for non-existent group", async () => {
      const cell = await addVertex({ text: "A" });
      const result = await handlers["add-cells-to-group"]({
        assignments: [{ cell_id: cell.id, group_id: "nonexistent" }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.failed, 1);
      assertEquals(parsed.data.results[0].error.code, "GROUP_NOT_FOUND");
    });

    it("should error when target is not a group", async () => {
      const c1 = await addVertex({ text: "A" });
      const c2 = await addVertex({ text: "B" });
      const result = await handlers["add-cells-to-group"]({
        assignments: [{ cell_id: c1.id, group_id: c2.id }],
      });
      const parsed = parseResult(result);
      assertEquals(parsed.data.summary.failed, 1);
      assertEquals(parsed.data.results[0].error.code, "NOT_A_GROUP");
    });
  });

  describe("remove-cell-from-group", () => {
    it("should remove a cell from its group", async () => {
      const group = await createGroup({ text: "G" });
      const cell = await addVertex({ text: "C" });
      await addCellToGroup(cell.id, group.id);
      const result = await handlers["remove-cell-from-group"]({ cell_id: cell.id });
      const parsed = parseResult(result);
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.cell.parent, "1");
    });

    it("should error for non-existent cell", async () => {
      const result = await handlers["remove-cell-from-group"]({ cell_id: "nonexistent" });
      assertEquals(result.isError, true);
    });

    it("should error when cell is not in a group", async () => {
      const cell = await addVertex({ text: "A" });
      const result = await handlers["remove-cell-from-group"]({ cell_id: cell.id });
      assertEquals(result.isError, true);
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
      assertEquals(parsed.success, true);
      assertEquals(parsed.data.total, 2);
      assertEquals(parsed.data.children.length, 2);
    });

    it("should error for non-existent group", async () => {
      const result = await handlers["list-group-children"]({ group_id: "nonexistent" });
      assertEquals(result.isError, true);
    });

    it("should error when cell is not a group", async () => {
      const cell = await addVertex({ text: "A" });
      const result = await handlers["list-group-children"]({ group_id: cell.id });
      assertEquals(result.isError, true);
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
    assertEquals(parsed.success, true);
    assertEquals(parsed.data.pages, 1);
    assertEquals(parsed.data.cells, 1);
    assert(parsed.data.message.includes("Imported"));
  });

  it("should return error for empty XML", async () => {
    const result = await handlers["import-diagram"]({ xml: "" });
    assertEquals(result.isError, true);
    const parsed = parseResult(result);
    assertEquals(parsed.error.code, "EMPTY_XML");
  });

  it("should return error for invalid XML", async () => {
    const result = await handlers["import-diagram"]({ xml: "<html></html>" });
    assertEquals(result.isError, true);
    const parsed = parseResult(result);
    assertEquals(parsed.error.code, "INVALID_XML");
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
    assertEquals(parsed.data.pages, 2);
    assertEquals(parsed.data.cells, 2);
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
    const cell = await addVertex({ text: "New Cell" });
    assertEquals(cell.type, "vertex");
    const statsResult = await handlers["get-diagram-stats"]();
    const stats = parseResult(statsResult).data.stats;
    assertEquals(stats.total_cells, 2);
  });
});
