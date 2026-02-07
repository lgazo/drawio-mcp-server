/**
 * Tool handlers that generate Draw.io XML directly
 * without requiring the browser extension.
 */

import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { diagram, StructuredError } from "./diagram_model.js";
import {
  getAzureCategories,
  getShapesInCategory,
  getAzureShapeByName,
  searchAzureIcons,
} from "./shapes/azure_icon_library.js";
import { BASIC_SHAPES, BASIC_SHAPE_CATEGORIES, getBasicShape } from "./shapes/basic_shapes.js";
import type { ToolLogger } from "./tool_handler.js";
import { formatBytes, timestamp } from "./tool_handler.js";

/**
 * Resolved shape with unified dimensions and style, regardless of source (basic or Azure).
 */
interface ResolvedShape {
  name: string;
  style: string;
  width: number;
  height: number;
  source: "basic" | "azure-exact" | "azure-fuzzy";
  score?: number;
}

/**
 * Resolve a shape name to its definition by checking:
 * 1. Basic shapes (exact match, case-insensitive)
 * 2. Azure icon library (exact match by title/ID)
 * 3. Azure icon library (fuzzy search, top result)
 *
 * Returns undefined if no match is found.
 */
function resolveShape(shapeName: string): ResolvedShape | undefined {
  // 1. Basic shapes first (prevents fuzzy search from hijacking names like 'start', 'end')
  const basic = getBasicShape(shapeName);
  if (basic) {
    return {
      name: basic.name,
      style: basic.style,
      width: basic.defaultWidth,
      height: basic.defaultHeight,
      source: "basic",
    };
  }

  // 2. Azure exact match by title or ID
  const azureExact = getAzureShapeByName(shapeName);
  if (azureExact) {
    return {
      name: azureExact.title,
      style: azureExact.style ?? "",
      width: azureExact.width,
      height: azureExact.height,
      source: "azure-exact",
    };
  }

  // 3. Azure fuzzy search as last resort
  const searchResults = searchAzureIcons(shapeName, 1);
  if (searchResults.length > 0) {
    const shape = searchResults[0];
    return {
      name: shape.title,
      style: shape.style ?? "",
      width: shape.width,
      height: shape.height,
      source: "azure-fuzzy",
      score: shape.score,
    };
  }

  return undefined;
}

function successResult(data: any): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ success: true, data }) }],
  };
}

function errorResult(error: StructuredError): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ success: false, error }) }],
    isError: true,
  };
}

export function createHandlers(log: ToolLogger) {
  return {
  "delete-cell-by-id": async (args: {
    cell_id: string;
  }): Promise<CallToolResult> => {
    const { deleted, cascadedEdgeIds } = diagram.deleteCell(args.cell_id);
    if (!deleted) {
      return errorResult({
        code: "CELL_NOT_FOUND",
        message: `Cell '${args.cell_id}' not found`,
        cell_id: args.cell_id,
        suggestion: "Use list-paged-model to see available cells",
      });
    }
    const stats = diagram.getStats();
    return successResult({
      deleted: args.cell_id,
      ...(cascadedEdgeIds.length > 0 && { cascaded_edges: cascadedEdgeIds }),
      remaining: { total_cells: stats.total_cells, vertices: stats.vertices, edges: stats.edges },
    });
  },

  "delete-edge": async (args: {
    cell_id: string;
  }): Promise<CallToolResult> => {
    const cell = diagram.getCell(args.cell_id);
    if (!cell) {
      return errorResult({
        code: "CELL_NOT_FOUND",
        message: `Edge '${args.cell_id}' not found`,
        cell_id: args.cell_id,
        suggestion: "Use list-paged-model with filter {cell_type: 'edge'} to see available edges",
      });
    }
    if (cell.type !== "edge") {
      return errorResult({
        code: "NOT_AN_EDGE",
        message: `Cell '${args.cell_id}' is a ${cell.type}, not an edge`,
        cell_id: args.cell_id,
        suggestion: "Use delete-cell-by-id to delete vertices",
      });
    }
    diagram.deleteCell(args.cell_id);
    const stats = diagram.getStats();
    return successResult({
      deleted: args.cell_id,
      remaining: { total_cells: stats.total_cells, vertices: stats.vertices, edges: stats.edges },
    });
  },

  "edit-edge": async (args: {
    cell_id: string;
    text?: string;
    source_id?: string;
    target_id?: string;
    style?: string;
  }): Promise<CallToolResult> => {
    const result = diagram.editEdge(args.cell_id, {
      text: args.text,
      sourceId: args.source_id,
      targetId: args.target_id,
      style: args.style,
    });
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ cell: result });
  },

  "list-paged-model": async (args: {
    page?: number;
    page_size?: number;
    filter?: { cell_type?: string };
  }): Promise<CallToolResult> => {
    const page = args.page ?? 0;
    const pageSize = args.page_size ?? 50;

    let cells = diagram.listCells();

    // Apply filter
    if (args.filter?.cell_type === "vertex") {
      cells = cells.filter(c => c.type === "vertex");
    } else if (args.filter?.cell_type === "edge") {
      cells = cells.filter(c => c.type === "edge");
    }

    // Paginate
    const start = page * pageSize;
    const pagedCells = cells.slice(start, start + pageSize);

    return successResult({
      page,
      pageSize,
      totalCells: cells.length,
      totalPages: Math.ceil(cells.length / pageSize),
      active_page: diagram.getActivePage(),
      active_layer: diagram.getActiveLayer(),
      cells: pagedCells,
    });
  },

  "list-layers": async (): Promise<CallToolResult> => {
    return successResult({
      layers: diagram.listLayers(),
      active_layer_id: diagram.getActiveLayer().id,
    });
  },

  "get-active-layer": async (): Promise<CallToolResult> => {
    return successResult({ layer: diagram.getActiveLayer() });
  },

  "set-active-layer": async (args: {
    layer_id: string;
  }): Promise<CallToolResult> => {
    const result = diagram.setActiveLayer(args.layer_id);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ layer: result });
  },

  "create-layer": async (args: { name: string }): Promise<CallToolResult> => {
    const layer = diagram.createLayer(args.name);
    return successResult({ layer, total_layers: diagram.listLayers().length });
  },

  "move-cell-to-layer": async (args: {
    cell_id: string;
    target_layer_id: string;
  }): Promise<CallToolResult> => {
    const result = diagram.moveCellToLayer(args.cell_id, args.target_layer_id);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ cell: result });
  },

  "export-diagram": async (args: { compress?: boolean }): Promise<CallToolResult> => {
    const compressed = args?.compress ?? false;
    const xml = diagram.toXml({ compress: compressed });
    const stats = diagram.getStats();

    if (compressed) {
      const prefix = "[tool:export-diagram]".padEnd(30);
      const originalXml = diagram.toXml({ compress: false });
      const originalSize = Buffer.byteLength(originalXml, "utf-8");
      const compressedSize = Buffer.byteLength(xml, "utf-8");
      const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(2);
      log.debug(`${timestamp()} ${prefix} original size: ${formatBytes(originalSize)}`);
      log.debug(`${timestamp()} ${prefix} compression reduced size by ${reduction}% (${formatBytes(originalSize)} → ${formatBytes(compressedSize)})`);
    }

    return successResult({
      xml,
      stats,
      compression: compressed
        ? { enabled: true, algorithm: "deflate-raw", encoding: "base64" }
        : { enabled: false },
    });
  },

  "get-diagram-stats": async (): Promise<CallToolResult> => {
    const stats = diagram.getStats();
    return successResult({ stats });
  },

  "clear-diagram": async (): Promise<CallToolResult> => {
    const cleared = diagram.clear();
    return successResult({ message: "Diagram cleared", cleared });
  },

  // ─── Multi-Page Handlers ────────────────────────────────────────

  "create-page": async (args: { name: string }): Promise<CallToolResult> => {
    const page = diagram.createPage(args.name);
    return successResult({ page, total_pages: diagram.listPages().length });
  },

  "list-pages": async (): Promise<CallToolResult> => {
    return successResult({
      pages: diagram.listPages(),
      active_page: diagram.getActivePage(),
    });
  },

  "get-active-page": async (): Promise<CallToolResult> => {
    return successResult({ page: diagram.getActivePage() });
  },

  "set-active-page": async (args: { page_id: string }): Promise<CallToolResult> => {
    const result = diagram.setActivePage(args.page_id);
    if ("error" in result) {
      return errorResult(result.error);
    }
    const stats = diagram.getStats();
    return successResult({
      page: result,
      cells: stats.total_cells,
      vertices: stats.vertices,
      edges: stats.edges,
      layers: stats.layers,
    });
  },

  "rename-page": async (args: { page_id: string; name: string }): Promise<CallToolResult> => {
    const result = diagram.renamePage(args.page_id, args.name);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ page: result });
  },

  "delete-page": async (args: { page_id: string }): Promise<CallToolResult> => {
    const result = diagram.deletePage(args.page_id);
    if (!result.deleted) {
      return errorResult(result.error!);
    }
    return successResult({ deleted: true, remaining_pages: diagram.listPages() });
  },

  // ─── Group / Container Handlers ─────────────────────────────────

  "create-groups": async (args: {
    groups: Array<{
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      text?: string;
      style?: string;
      temp_id?: string;
    }>;
  }): Promise<CallToolResult> => {
    if (!args.groups || args.groups.length === 0) {
      return errorResult({
        code: "INVALID_INPUT",
        message: "Must provide a non-empty 'groups' array",
      });
    }

    const items = args.groups.map((g) => ({
      x: g.x,
      y: g.y,
      width: g.width,
      height: g.height,
      text: g.text,
      style: g.style,
      tempId: g.temp_id,
    }));
    const results = diagram.batchCreateGroups(items);
    return successResult({
      summary: { total: results.length, succeeded: results.length, failed: 0 },
      results: results.map((r) => ({
        success: r.success,
        cell: r.cell,
        temp_id: r.tempId,
      })),
    });
  },

  "add-cells-to-group": async (args: {
    assignments: Array<{
      cell_id: string;
      group_id: string;
    }>;
  }): Promise<CallToolResult> => {
    if (!args.assignments || args.assignments.length === 0) {
      return errorResult({
        code: "INVALID_INPUT",
        message: "Must provide a non-empty 'assignments' array",
      });
    }

    const items = args.assignments.map((a) => ({
      cellId: a.cell_id,
      groupId: a.group_id,
    }));
    const results = diagram.batchAddCellsToGroup(items);
    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;
    return successResult({
      summary: { total: results.length, succeeded: successCount, failed: errorCount },
      results: results.map((r) => ({
        success: r.success,
        cell_id: r.cellId,
        group_id: r.groupId,
        ...(r.cell && { cell: r.cell }),
        ...(r.error && { error: r.error }),
      })),
    });
  },

  "remove-cell-from-group": async (args: {
    cell_id: string;
  }): Promise<CallToolResult> => {
    const result = diagram.removeCellFromGroup(args.cell_id);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ cell: result });
  },

  "list-group-children": async (args: {
    group_id: string;
  }): Promise<CallToolResult> => {
    const result = diagram.listGroupChildren(args.group_id);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({ children: result, total: result.length });
  },

  // ─── Import Handler ─────────────────────────────────────────────

  "import-diagram": async (args: {
    xml: string;
  }): Promise<CallToolResult> => {
    const result = diagram.importXml(args.xml);
    if ("error" in result) {
      return errorResult(result.error);
    }
    return successResult({
      message: `Imported ${result.pages} page(s) with ${result.cells} cell(s) and ${result.layers} layer(s)`,
      ...result,
    });
  },

  "get-shape-categories": async (): Promise<CallToolResult> => {
    const basicCategories = [
      { id: "general", name: "General" },
      { id: "flowchart", name: "Flowchart" },
    ];
    const azureCategories = getAzureCategories().map((cat) => ({
      id: cat.toLowerCase().replace(/\s+/g, "-"),
      name: cat,
    }));

    return successResult({
      categories: [...basicCategories, ...azureCategories],
      info: "Includes basic shapes and 700+ Azure architecture icons from dwarfered/azure-architecture-icons-for-drawio.",
    });
  },

  "get-shapes-in-category": async (args: {
    category_id: string;
  }): Promise<CallToolResult> => {
    const categoryId = args.category_id.toLowerCase();

    // Check basic shape categories first
    const basicShapeNames = BASIC_SHAPE_CATEGORIES[categoryId];
    if (basicShapeNames) {
      const shapes = basicShapeNames
        .map((name) => BASIC_SHAPES[name])
        .filter(Boolean)
        .map((s) => ({ name: s.name, style: s.style, width: s.defaultWidth, height: s.defaultHeight }));
      return successResult({ category: categoryId, shapes, total: shapes.length });
    }

    // Check Azure categories
    const azureCategories = getAzureCategories();
    const matchingCategory = azureCategories.find(
      (cat) => cat.toLowerCase().replace(/\s+/g, "-") === categoryId
    );

    if (matchingCategory) {
      const shapes = getShapesInCategory(matchingCategory);
      return successResult({
        category: categoryId,
        shapes: shapes.map((shape) => ({
          name: shape.title,
          id: shape.id,
          width: shape.width,
          height: shape.height,
        })),
        total: shapes.length,
      });
    }

    return errorResult({
      code: "CATEGORY_NOT_FOUND",
      message: `Category '${args.category_id}' not found`,
      suggestion: "Use get-shape-categories to list available categories",
    });
  },

  "get-shape-by-name": async (args: {
    shape_name: string;
  }): Promise<CallToolResult> => {
    const resolved = resolveShape(args.shape_name);
    if (resolved) {
      return successResult({
        shape: {
          name: resolved.name,
          style: resolved.style,
          width: resolved.width,
          height: resolved.height,
          source: resolved.source,
          ...(resolved.score !== undefined && { confidence: parseFloat(resolved.score.toFixed(3)) }),
        },
      });
    }
    return errorResult({
      code: "SHAPE_NOT_FOUND",
      message: `Shape '${args.shape_name}' not found`,
      suggestion: "Use search-shapes to find available shapes",
    });
  },

  "add-cells-of-shape": async (args: {
    cells: Array<{
      shape_name: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      text?: string;
      style?: string;
      temp_id?: string;
    }>;
  }): Promise<CallToolResult> => {
    if (!args.cells || args.cells.length === 0) {
      return errorResult({
        code: "INVALID_INPUT",
        message: "Must provide a non-empty 'cells' array",
      });
    }

    const results = args.cells.map((item) => {
      const resolved = resolveShape(item.shape_name);
      if (!resolved) {
        return {
          success: false,
          temp_id: item.temp_id,
          shape_name: item.shape_name,
          error: {
            code: "SHAPE_NOT_FOUND",
            message: `Unknown shape '${item.shape_name}'`,
            suggestion: "Use search-shapes to find available shapes",
          },
        };
      }

      const cell = diagram.addRectangle({
        x: item.x,
        y: item.y,
        width: item.width ?? resolved.width,
        height: item.height ?? resolved.height,
        text: item.text ?? (resolved.source !== "basic" ? resolved.name : undefined),
        style: item.style ?? resolved.style,
      });

      return {
        success: true,
        cell,
        temp_id: item.temp_id,
        ...(resolved.source === "azure-exact" && { info: `Added Azure icon: ${resolved.name}` }),
        ...(resolved.source === "azure-fuzzy" && {
          info: `Added Azure icon (matched from search): ${resolved.name}`,
          confidence: parseFloat(resolved.score!.toFixed(3)),
        }),
      };
    });

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    return successResult({
      success: errorCount === 0,
      summary: {
        total: results.length,
        succeeded: successCount,
        failed: errorCount,
      },
      results,
    });
  },

  "set-cell-shape": async (args: {
    cells: Array<{ cell_id: string; shape_name: string }>;
  }): Promise<CallToolResult> => {
    if (!args.cells || args.cells.length === 0) {
      return errorResult({
        code: "INVALID_INPUT",
        message: "Must provide a non-empty 'cells' array",
      });
    }

    const getShapeStyle = (shapeName: string): string | null => {
      const resolved = resolveShape(shapeName);
      return resolved ? resolved.style : null;
    };

    const results = args.cells.map((item) => {
      const style = getShapeStyle(item.shape_name);
      if (!style) {
        return {
          success: false,
          cell_id: item.cell_id,
          shape_name: item.shape_name,
          error: {
            code: "SHAPE_NOT_FOUND",
            message: `Unknown shape '${item.shape_name}'`,
            suggestion: "Use search-shapes to find available shapes",
          },
        };
      }

      const result = diagram.editCell(item.cell_id, { style });
      if ("error" in result) {
        return {
          success: false,
          cell_id: item.cell_id,
          shape_name: item.shape_name,
          error: result.error,
        };
      }

      return {
        success: true,
        cell_id: item.cell_id,
        shape_name: item.shape_name,
        cell: result,
      };
    });

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    return successResult({
      summary: {
        total: results.length,
        succeeded: successCount,
        failed: errorCount,
      },
      results,
    });
  },

  "add-cells": async (args: {
    cells: Array<{
      type: "vertex" | "edge";
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      text?: string;
      style?: string;
      source_id?: string;
      target_id?: string;
      temp_id?: string;
    }>;
    dry_run?: boolean;
  }): Promise<CallToolResult> => {
    const items = args.cells.map(c => ({
      type: c.type,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      text: c.text,
      style: c.style,
      sourceId: c.source_id,
      targetId: c.target_id,
      tempId: c.temp_id,
    }));
    const results = diagram.batchAddCells(items, { dryRun: args.dry_run });
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    return successResult({
      summary: { total: results.length, succeeded: successCount, failed: errorCount },
      results,
      dry_run: args.dry_run ?? false,
    });
  },

  "edit-cells": async (args: {
    cells: Array<{
      cell_id: string;
      text?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      style?: string;
    }>;
  }): Promise<CallToolResult> => {
    const results = diagram.batchEditCells(args.cells);
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    return successResult({
      summary: { total: results.length, succeeded: successCount, failed: errorCount },
      results,
    });
  },

  "get-style-presets": async (): Promise<CallToolResult> => {
    const presets = {
      azure: {
        primary: "fillColor=#0078D4;strokeColor=#0078D4;fontColor=#ffffff;",
        secondary: "fillColor=#50E6FF;strokeColor=#0078D4;fontColor=#000000;",
        container: "fillColor=#E6F2FA;strokeColor=#0078D4;rounded=1;dashed=1;",
      },
      flowchart: {
        process: "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
        decision: "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
        start: "ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;",
        end: "ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;",
        data: "shape=parallelogram;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;",
      },
      general: {
        blue: "fillColor=#dae8fc;strokeColor=#6c8ebf;",
        green: "fillColor=#d5e8d4;strokeColor=#82b366;",
        orange: "fillColor=#ffe6cc;strokeColor=#d79b00;",
        red: "fillColor=#f8cecc;strokeColor=#b85450;",
        purple: "fillColor=#e1d5e7;strokeColor=#9673a6;",
        yellow: "fillColor=#fff2cc;strokeColor=#d6b656;",
        gray: "fillColor=#f5f5f5;strokeColor=#666666;",
      },
      edges: {
        solid: "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;",
        dashed: "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;dashed=1;",
        curved: "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;",
        arrow: "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;endFill=1;",
      },
    };
    return successResult({ presets });
  },

  "search-shapes": async (args: {
    queries: string[];
    limit?: number;
  }): Promise<CallToolResult> => {
    const limit = args.limit ?? 10;

    if (!args.queries || args.queries.length === 0) {
      return errorResult({
        code: "INVALID_INPUT",
        message: "Must provide a non-empty 'queries' array",
      });
    }

    const results = args.queries.map(q => {
      // Check basic shapes first (exact, case-insensitive)
      const basicMatches = Object.values(BASIC_SHAPES)
        .filter(s => s.name.toLowerCase().includes(q.toLowerCase()))
        .map(s => ({
          name: s.name,
          id: s.name,
          category: "basic",
          width: s.defaultWidth,
          height: s.defaultHeight,
          confidence: s.name.toLowerCase() === q.toLowerCase() ? 1.0 : 0.8,
        }));

      // Then search Azure icons
      const azureMatches = searchAzureIcons(q, limit).map(r => ({
        name: r.title,
        id: r.id,
        category: r.category,
        width: r.width,
        height: r.height,
        confidence: parseFloat(r.score.toFixed(3)),
      }));

      // Combine: basic shapes first (higher priority), then Azure, respect limit
      const matches = [...basicMatches, ...azureMatches].slice(0, limit);

      return {
        query: q,
        matches,
        total: matches.length,
      };
    });

    return successResult({
      results,
      totalQueries: args.queries.length,
    });
  },
};
}

/** Default handlers instance with a no-op logger, for backward compatibility in tests. */
export const handlers = createHandlers({ debug: () => {} });
