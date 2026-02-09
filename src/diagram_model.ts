/**
 * Draw.io diagram model that generates XML without requiring
 * the browser extension or Draw.io application.
 *
 * Compression uses `node:zlib` (Deno Node-compat) for raw deflate
 * because the Web Compression API does not expose a synchronous API.
 * Encoding uses `@std/encoding/base64` and standard `TextEncoder` /
 * `TextDecoder` — no Node.js `Buffer` dependency.
 *
 * Known optimization opportunities (deferred):
 * - INCREMENTAL STATS: `getStats()` rebuilds cell counts on every call. An
 *   incremental approach (maintaining counters on add/delete/move) would give
 *   O(1) stats but touches many methods and risks subtle bugs.
 * - EDGE REVERSE-INDEX: `deleteCell` linearly scans all cells for edge cascade.
 *   A `Map<string, Set<string>>` mapping vertex→edges would enable O(1) lookups
 *   but requires per-page storage and updates across add/delete/edit/import.
 * - ASYNC COMPRESSION: `deflateRawSync` blocks the event loop. Using the async
 *   `deflateRaw` would require making `toXml` async, rippling through handlers.
 */

import { deflateRawSync, inflateRawSync } from "node:zlib";
import { encodeBase64, decodeBase64 } from "@std/encoding/base64";
import { XMLParser } from "fast-xml-parser";

/** Shared XML parser instance for importing Draw.io XML */
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (name: string) => name === "diagram" || name === "mxCell" || name === "UserObject",
  processEntities: true,
});

export interface StructuredError {
  code: string;
  message: string;
  cell_id?: string;
  index?: number;
  suggestion?: string;
}

export interface Cell {
  id: string;
  type: "vertex" | "edge";
  value: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  style?: string;
  sourceId?: string;
  targetId?: string;
  parent?: string;
  /** When true, this vertex acts as a container/group for other cells */
  isGroup?: boolean;
  /** IDs of child cells contained in this group */
  children?: string[];
}

export interface Layer {
  id: string;
  name: string;
}

/** Normalised attributes extracted from an mxCell or UserObject XML element */
interface ParsedCellAttrs {
  id: string;
  value: string;
  style: string;
  parent: string;
  source?: string;
  target?: string;
  isVertex: boolean;
  isEdge: boolean;
  geometry?: Record<string, unknown>;
}

export class DiagramModel {
  private cells: Map<string, Cell> = new Map();
  private layers: Layer[] = [{ id: "1", name: "Default Layer" }];
  private activeLayerId: string = "1";
  private nextId: number = 2;
  /** Monotonic counter for layer IDs — prevents collisions after deletions */
  private nextLayerId: number = 2;

  private generateId(): string {
    return `cell-${this.nextId++}`;
  }

  addRectangle(params: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    style?: string;
  }): Cell {
    const id = this.generateId();
    const cell: Cell = {
      id,
      type: "vertex",
      value: params.text ?? "New Cell",
      x: params.x ?? 100,
      y: params.y ?? 100,
      width: Math.max(1, params.width ?? 200),
      height: Math.max(1, params.height ?? 100),
      style: params.style ?? "whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;",
      parent: this.activeLayerId,
    };
    this.cells.set(id, cell);
    return cell;
  }

  addEdge(params: {
    sourceId: string;
    targetId: string;
    text?: string;
    style?: string;
  }): Cell | { error: StructuredError } {
    // Validate source and target exist
    if (!this.cells.has(params.sourceId)) {
      return {
        error: {
          code: "SOURCE_NOT_FOUND",
          message: `Source cell '${params.sourceId}' not found`,
          cell_id: params.sourceId,
          suggestion: "Use list-paged-model to see available cells",
        },
      };
    }
    if (!this.cells.has(params.targetId)) {
      return {
        error: {
          code: "TARGET_NOT_FOUND",
          message: `Target cell '${params.targetId}' not found`,
          cell_id: params.targetId,
          suggestion: "Use list-paged-model to see available cells",
        },
      };
    }

    const id = this.generateId();
    const cell: Cell = {
      id,
      type: "edge",
      value: params.text ?? "",
      style: params.style ?? "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;",
      sourceId: params.sourceId,
      targetId: params.targetId,
      parent: this.activeLayerId,
    };
    this.cells.set(id, cell);
    return cell;
  }

  deleteCell(cellId: string): { deleted: boolean; cascadedEdgeIds: string[] } {
    const cell = this.cells.get(cellId);
    if (!cell) return { deleted: false, cascadedEdgeIds: [] };

    // If deleting a vertex, also remove any edges that reference it
    const cascadedEdgeIds: string[] = [];
    if (cell.type === "vertex") {
      for (const [id, c] of this.cells) {
        if (c.type === "edge" && (c.sourceId === cellId || c.targetId === cellId)) {
          cascadedEdgeIds.push(id);
        }
      }
      for (const id of cascadedEdgeIds) {
        this.cells.delete(id);
      }
    }

    this.cells.delete(cellId);
    return { deleted: true, cascadedEdgeIds };
  }

  editCell(cellId: string, params: {
    text?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    style?: string;
  }): Cell | { error: StructuredError } {
    const cell = this.cells.get(cellId);
    if (!cell) {
      return {
        error: {
          code: "CELL_NOT_FOUND",
          message: `Cell '${cellId}' not found`,
          cell_id: cellId,
          suggestion: "Use list-paged-model to see available cells",
        },
      };
    }
    if (cell.type !== "vertex") {
      return {
        error: {
          code: "WRONG_CELL_TYPE",
          message: `Cell '${cellId}' is not a vertex`,
          cell_id: cellId,
          suggestion: `This cell is a ${cell.type}. Use edit-edge for edge cells.`,
        },
      };
    }

    if (params.text !== undefined) cell.value = params.text;
    if (params.x !== undefined) cell.x = params.x;
    if (params.y !== undefined) cell.y = params.y;
    if (params.width !== undefined) cell.width = params.width;
    if (params.height !== undefined) cell.height = params.height;
    if (params.style !== undefined) cell.style = params.style;

    return cell;
  }

  editEdge(cellId: string, params: {
    text?: string;
    sourceId?: string;
    targetId?: string;
    style?: string;
  }): Cell | { error: StructuredError } {
    const cell = this.cells.get(cellId);
    if (!cell) {
      return {
        error: {
          code: "CELL_NOT_FOUND",
          message: `Edge '${cellId}' not found`,
          cell_id: cellId,
          suggestion: "Use list-paged-model to see available cells",
        },
      };
    }
    if (cell.type !== "edge") {
      return {
        error: {
          code: "WRONG_CELL_TYPE",
          message: `Cell '${cellId}' is not an edge`,
          cell_id: cellId,
          suggestion: `This cell is a ${cell.type}. Use edit-cell for vertex cells.`,
        },
      };
    }

    if (params.text !== undefined) cell.value = params.text;
    if (params.sourceId !== undefined) {
      if (!this.cells.has(params.sourceId)) {
        return {
          error: {
            code: "SOURCE_NOT_FOUND",
            message: `Source cell '${params.sourceId}' not found`,
            cell_id: params.sourceId,
            suggestion: "Use list-paged-model to see available cells",
          },
        };
      }
      cell.sourceId = params.sourceId;
    }
    if (params.targetId !== undefined) {
      if (!this.cells.has(params.targetId)) {
        return {
          error: {
            code: "TARGET_NOT_FOUND",
            message: `Target cell '${params.targetId}' not found`,
            cell_id: params.targetId,
            suggestion: "Use list-paged-model to see available cells",
          },
        };
      }
      cell.targetId = params.targetId;
    }
    if (params.style !== undefined) cell.style = params.style;

    return cell;
  }

  getCell(cellId: string): Cell | undefined {
    return this.cells.get(cellId);
  }

  listCells(filter?: { cellType?: "vertex" | "edge" }): Cell[] {
    let cells = Array.from(this.cells.values());
    if (filter?.cellType) {
      cells = cells.filter(c => c.type === filter.cellType);
    }
    return cells;
  }

  createLayer(name: string): Layer {
    const id = `layer-${this.nextLayerId++}`;
    const layer: Layer = { id, name };
    this.layers.push(layer);
    return layer;
  }

  listLayers(): Layer[] {
    return [...this.layers];
  }

  setActiveLayer(layerId: string): Layer | { error: StructuredError } {
    const layer = this.layers.find(l => l.id === layerId);
    if (!layer) {
      return {
        error: {
          code: "LAYER_NOT_FOUND",
          message: `Layer '${layerId}' not found`,
          suggestion: "Use list-layers to see available layers",
        },
      };
    }
    this.activeLayerId = layerId;
    return layer;
  }

  getActiveLayer(): Layer {
    return this.layers.find(l => l.id === this.activeLayerId)!;
  }

  moveCellToLayer(cellId: string, targetLayerId: string): Cell | { error: StructuredError } {
    const cell = this.cells.get(cellId);
    if (!cell) {
      return {
        error: {
          code: "CELL_NOT_FOUND",
          message: `Cell '${cellId}' not found`,
          cell_id: cellId,
          suggestion: "Use list-paged-model to see available cells",
        },
      };
    }
    const layer = this.layers.find(l => l.id === targetLayerId);
    if (!layer) {
      return {
        error: {
          code: "LAYER_NOT_FOUND",
          message: `Layer '${targetLayerId}' not found`,
          suggestion: "Use list-layers to see available layers",
        },
      };
    }
    cell.parent = targetLayerId;
    return cell;
  }

  // ─── Group / Container Support ───────────────────────────────────

  /**
   * Create a group (container) cell that can hold child cells.
   */
  createGroup(params: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    style?: string;
  }): Cell {
    const id = this.generateId();
    const cell: Cell = {
      id,
      type: "vertex",
      value: params.text ?? "",
      x: params.x ?? 0,
      y: params.y ?? 0,
      width: params.width ?? 400,
      height: params.height ?? 300,
      style: params.style ?? "rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;dashed=1;container=1;collapsible=0;",
      parent: this.activeLayerId,
      isGroup: true,
      children: [],
    };
    this.cells.set(id, cell);
    return cell;
  }

  /**
   * Batch create multiple groups in a single operation.
   */
  batchCreateGroups(
    groups: Array<{
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      text?: string;
      style?: string;
      tempId?: string;
    }>,
  ): Array<{ success: boolean; cell: Cell; tempId?: string }> {
    return groups.map((g) => {
      const cell = this.createGroup(g);
      return { success: true, cell, tempId: g.tempId };
    });
  }

  /**
   * Add a cell to a group. The child cell's parent is set to the group.
   */
  addCellToGroup(cellId: string, groupId: string): Cell | { error: StructuredError } {
    const cell = this.cells.get(cellId);
    if (!cell) {
      return {
        error: {
          code: "CELL_NOT_FOUND",
          message: `Cell '${cellId}' not found`,
          cell_id: cellId,
          suggestion: "Use list-paged-model to see available cells",
        },
      };
    }
    const group = this.cells.get(groupId);
    if (!group) {
      return {
        error: {
          code: "GROUP_NOT_FOUND",
          message: `Group '${groupId}' not found`,
          cell_id: groupId,
          suggestion: "Use list-paged-model to see available groups",
        },
      };
    }
    if (!group.isGroup) {
      return {
        error: {
          code: "NOT_A_GROUP",
          message: `Cell '${groupId}' is not a group/container`,
          cell_id: groupId,
          suggestion: "Use create-group to create a group first",
        },
      };
    }
    if (cellId === groupId) {
      return {
        error: {
          code: "SELF_REFERENCE",
          message: "Cannot add a group to itself",
          cell_id: cellId,
          suggestion: "Provide a different cell_id and group_id",
        },
      };
    }
    cell.parent = groupId;
    if (!group.children) {
      group.children = [];
    }
    if (!group.children.includes(cellId)) {
      group.children.push(cellId);
    }
    return cell;
  }

  /**
   * Batch add multiple cells to groups in a single operation.
   */
  batchAddCellsToGroup(
    assignments: Array<{ cellId: string; groupId: string }>,
  ): Array<{ success: boolean; cell?: Cell; error?: StructuredError; cellId: string; groupId: string }> {
    return assignments.map((a) => {
      const result = this.addCellToGroup(a.cellId, a.groupId);
      if ("error" in result) {
        return { success: false, error: result.error, cellId: a.cellId, groupId: a.groupId };
      }
      return { success: true, cell: result, cellId: a.cellId, groupId: a.groupId };
    });
  }

  /**
   * Remove a cell from its group, returning it to the active layer.
   */
  removeCellFromGroup(cellId: string): Cell | { error: StructuredError } {
    const cell = this.cells.get(cellId);
    if (!cell) {
      return {
        error: {
          code: "CELL_NOT_FOUND",
          message: `Cell '${cellId}' not found`,
          cell_id: cellId,
          suggestion: "Use list-paged-model to see available cells",
        },
      };
    }
    // Check if the cell is currently in a group (parent is a cell, not a layer)
    const parentCell = this.cells.get(cell.parent!);
    if (!parentCell || !parentCell.isGroup) {
      return {
        error: {
          code: "NOT_IN_GROUP",
          message: `Cell '${cellId}' is not inside a group`,
          cell_id: cellId,
          suggestion: "Cell is already at the layer level",
        },
      };
    }
    // Remove from parent's children list
    if (parentCell.children) {
      parentCell.children = parentCell.children.filter(id => id !== cellId);
    }
    // Return to the active layer
    cell.parent = this.activeLayerId;
    return cell;
  }

  /**
   * List the children of a group.
   */
  listGroupChildren(groupId: string): Cell[] | { error: StructuredError } {
    const group = this.cells.get(groupId);
    if (!group) {
      return {
        error: {
          code: "GROUP_NOT_FOUND",
          message: `Group '${groupId}' not found`,
          cell_id: groupId,
          suggestion: "Use list-paged-model to see available groups",
        },
      };
    }
    if (!group.isGroup) {
      return {
        error: {
          code: "NOT_A_GROUP",
          message: `Cell '${groupId}' is not a group/container`,
          cell_id: groupId,
          suggestion: "Use create-group to create a group first",
        },
      };
    }
    return group.children!
      .map(id => this.cells.get(id))
      .filter((c): c is Cell => c !== undefined);
  }

  // ─── Import / Load XML ───────────────────────────────────────────

  /**
   * Import a Draw.io XML string, replacing the current diagram state.
   * Supports single-page and multi-page documents. When multiple pages are
   * present, all cells and layers are merged into a single flat model.
   * Returns the number of source pages, merged cells, and merged layers.
   */
  importXml(xml: string): { pages: number; cells: number; layers: number } | { error: StructuredError } {
    // Basic validation
    if (!xml || !xml.trim()) {
      return {
        error: {
          code: "EMPTY_XML",
          message: "XML string is empty",
          suggestion: "Provide a valid Draw.io XML string",
        },
      };
    }

    if (!xml.includes("<mxfile") && !xml.includes("<mxGraphModel")) {
      return {
        error: {
          code: "INVALID_XML",
          message: "XML does not appear to be a Draw.io file",
          suggestion: "Provide XML that contains <mxfile> or <mxGraphModel> elements",
        },
      };
    }

    const parsed = xmlParser.parse(xml) as Record<string, unknown>;

    // Extract diagram elements
    let diagramElements: Array<Record<string, unknown>> = [];

    const mxfile = parsed.mxfile as Record<string, unknown> | undefined;
    if (mxfile?.diagram) {
      diagramElements = mxfile.diagram as Array<Record<string, unknown>>;
    } else if (parsed.mxGraphModel) {
      // Bare mxGraphModel without mxfile wrapper — wrap it as a single diagram
      diagramElements = [{ mxGraphModel: parsed.mxGraphModel }];
    } else {
      // mxfile without diagram children (e.g., <mxfile></mxfile>)
      diagramElements = [parsed];
    }

    // Reset state entirely
    this.cells = new Map();
    this.layers = [{ id: "1", name: "Default Layer" }];
    this.activeLayerId = "1";
    this.nextId = 2;
    this.nextLayerId = 2;

    for (let di = 0; di < diagramElements.length; di++) {
      let diag = diagramElements[di];

      // Detect compressed diagram content: when the diagram element has a text
      // node instead of an mxGraphModel child, it contains deflate+base64 data.
      if (!diag.mxGraphModel && typeof diag["#text"] === "string") {
        const decompressedXml = DiagramModel.decompressXml(diag["#text"]);
        const innerParsed = xmlParser.parse(decompressedXml) as Record<string, unknown>;
        diag = { ...diag, mxGraphModel: innerParsed.mxGraphModel };
      }

      const { cells, layers, nextId } = this.parseMxGraphContent(diag);

      // Merge cells into the model
      for (const [id, cell] of cells) {
        this.cells.set(id, cell);
      }

      // Merge layers (skip default layer already present)
      for (const layer of layers) {
        if (layer.id !== "1" && !this.layers.some(l => l.id === layer.id)) {
          this.layers.push(layer);
        }
      }

      // Track the highest nextId across all pages
      if (nextId > this.nextId) {
        this.nextId = nextId;
      }
    }

    return {
      pages: diagramElements.length,
      cells: this.cells.size,
      layers: this.layers.length,
    };
  }

  /**
   * Extract attributes common to mxCell / UserObject elements.
   */
  private extractCellAttrs(
    obj: Record<string, unknown>,
    geometry: Record<string, unknown> | undefined,
  ): ParsedCellAttrs {
    return {
      id: String(obj.id ?? ""),
      value: String(obj.value ?? obj.label ?? ""),
      style: String(obj.style ?? ""),
      parent: String(obj.parent ?? ""),
      source: obj.source !== undefined ? String(obj.source) : undefined,
      target: obj.target !== undefined ? String(obj.target) : undefined,
      isVertex: String(obj.vertex) === "1",
      isEdge: String(obj.edge) === "1",
      geometry,
    };
  }

  /**
   * Parse mxGraphModel content from a parsed XML object and extract cells and layers.
   */
  private parseMxGraphContent(diagramObj: Record<string, unknown>): { cells: Map<string, Cell>; layers: Layer[]; nextId: number } {
    const cells = new Map<string, Cell>();
    const layers: Layer[] = [{ id: "1", name: "Default Layer" }];
    let maxId = 1;

    // Navigate to root element: diagramObj.mxGraphModel.root
    const mxGraphModel = diagramObj.mxGraphModel as Record<string, unknown> | undefined;
    const root = mxGraphModel?.root as Record<string, unknown> | undefined;
    if (!root) {
      return { cells, layers, nextId: maxId + 1 };
    }

    // Collect normalised cell entries from mxCell and UserObject arrays
    const rawElements: ParsedCellAttrs[] = [];

    // Process mxCell elements
    const mxCells = (root.mxCell ?? []) as Array<Record<string, unknown>>;
    for (const cell of mxCells) {
      rawElements.push(
        this.extractCellAttrs(cell, cell.mxGeometry as Record<string, unknown> | undefined),
      );
    }

    // Process UserObject elements
    const userObjects = (root.UserObject ?? []) as Array<Record<string, unknown>>;
    for (const uo of userObjects) {
      // Geometry may live on the nested mxCell child
      let geometry: Record<string, unknown> | undefined;
      const innerCells = uo.mxCell as Array<Record<string, unknown>> | undefined;
      if (innerCells && innerCells.length > 0) {
        const innerCell = innerCells[0];
        geometry = innerCell.mxGeometry as Record<string, unknown> | undefined;
        // Merge inner mxCell attributes that weren't set on the UserObject itself
        for (const key of ["style", "vertex", "edge", "parent", "source", "target"]) {
          if (innerCell[key] !== undefined && uo[key] === undefined) {
            uo[key] = innerCell[key];
          }
        }
      }
      rawElements.push(this.extractCellAttrs(uo, geometry));
    }

    // Process all collected elements
    for (const elem of rawElements) {
      // Skip root cells (id=0 or id=1 with parent=0)
      if (elem.id === "0") continue;
      if (elem.id === "1" && elem.parent === "0") continue;

      // Track numeric IDs for nextId
      const numMatch = elem.id.match(/\d+/);
      if (numMatch) {
        maxId = Math.max(maxId, parseInt(numMatch[0], 10));
      }

      // Layer detection: parent="0", not a vertex or edge
      if (elem.parent === "0" && !elem.isVertex && !elem.isEdge) {
        if (elem.id !== "1") {
          layers.push({ id: elem.id, name: elem.value || elem.id });
        }
        continue;
      }

      // Parse geometry
      let x: number | undefined;
      let y: number | undefined;
      let width: number | undefined;
      let height: number | undefined;

      if (elem.geometry) {
        const geo = elem.geometry;
        if (geo.x !== undefined) x = parseFloat(String(geo.x));
        if (geo.y !== undefined) y = parseFloat(String(geo.y));
        if (geo.width !== undefined) width = parseFloat(String(geo.width));
        if (geo.height !== undefined) height = parseFloat(String(geo.height));
      }

      // Determine if it's a group/container
      const isGroup = elem.style.includes("container=1") || /swimlane/i.test(elem.style);

      if (elem.isEdge) {
        const cell: Cell = {
          id: elem.id,
          type: "edge",
          value: elem.value,
          style: elem.style,
          sourceId: elem.source,
          targetId: elem.target,
          parent: elem.parent || "1",
        };
        cells.set(elem.id, cell);
      } else {
        const cell: Cell = {
          id: elem.id,
          type: "vertex",
          value: elem.value,
          x: x ?? 0,
          y: y ?? 0,
          width: width ?? 200,
          height: height ?? 100,
          style: elem.style,
          parent: elem.parent || "1",
          ...(isGroup && { isGroup: true, children: [] }),
        };
        cells.set(elem.id, cell);
      }
    }

    // Post-process: populate children arrays for groups
    for (const cell of cells.values()) {
      if (cell.parent && cells.has(cell.parent)) {
        const parentCell = cells.get(cell.parent)!;
        if (parentCell.isGroup) {
          parentCell.children!.push(cell.id);
        }
      }
    }

    return { cells, layers, nextId: maxId + 1 };
  }

  /**
   * Export the diagram as Draw.io XML format (single page).
   *
   * @param options.compress - If `true`, deflate-compress and base64-encode the
   *   `<mxGraphModel>` content inside the `<diagram>` element. This matches the
   *   format used by the Draw.io desktop application and typically achieves 60-80%
   *   size reduction. Defaults to `false` (plain XML).
   */
  toXml(options?: { compress?: boolean }): string {
    const compress = options?.compress ?? false;

    const pageXml = this.renderPageXml(this.cells, this.layers);
    const graphModelXml = `<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${pageXml}</root></mxGraphModel>`;
    const diagramContent = compress ? DiagramModel.compressXml(graphModelXml) : graphModelXml;

    return `<mxfile host="drawio-mcp-server"><diagram id="page-1" name="Page-1">${diagramContent}</diagram></mxfile>`;
  }

  /**
   * Compress an XML string using the Draw.io format:
   * encodeURIComponent(xml) → deflateRaw → base64.
   *
   * This matches Draw.io's `Graph.compress` which URL-encodes the XML first,
   * then deflates the URL-encoded bytes, then base64-encodes the result.
   */
  static compressXml(xml: string): string {
    const encoder = new TextEncoder();
    const uriEncoded = encodeURIComponent(xml);
    const deflated = deflateRawSync(encoder.encode(uriEncoded));
    return encodeBase64(deflated);
  }

  /**
   * Decompress a Draw.io compressed diagram string:
   * base64 → inflateRaw → decodeURIComponent.
   *
   * This matches Draw.io's `Graph.decompress` which base64-decodes the input,
   * inflates the raw deflate stream, then URL-decodes the result to recover
   * the original XML.
   */
  static decompressXml(compressed: string): string {
    const deflated = decodeBase64(compressed);
    const inflated = inflateRawSync(deflated);
    const decoder = new TextDecoder();
    return decodeURIComponent(decoder.decode(inflated));
  }

  /**
   * Render cells and layers for a single page.
   */
  private renderPageXml(cells: Map<string, Cell>, layers: Layer[]): string {
    // Emit custom layer cells (skip the default layer id="1" which is always present)
    const layerCellsXml = layers
      .filter(l => l.id !== "1")
      .map(l => `<mxCell id="${this.escapeXml(l.id)}" value="${this.escapeXml(l.name)}" style="" parent="0"/>`)
      .join("");

    const cellsXml = Array.from(cells.values())
      .map(cell => {
        if (cell.type === "vertex") {
          const groupAttrs = cell.isGroup ? ' connectable="0"' : '';
          const containerStyle = cell.isGroup && cell.style && !cell.style.includes("container=1")
            ? cell.style + "container=1;"
            : cell.style;
          return `<mxCell id="${this.escapeXml(cell.id)}" value="${this.escapeXml(cell.value)}" style="${this.escapeXml(containerStyle!)}" vertex="1"${groupAttrs} parent="${cell.parent!}"><mxGeometry x="${cell.x!}" y="${cell.y!}" width="${cell.width!}" height="${cell.height!}" as="geometry"/></mxCell>`;
        } else {
          const sourceAttr = cell.sourceId ? ` source="${cell.sourceId}"` : "";
          const targetAttr = cell.targetId ? ` target="${cell.targetId}"` : "";
          return `<mxCell id="${this.escapeXml(cell.id)}" value="${this.escapeXml(cell.value)}" style="${this.escapeXml(cell.style!)}" edge="1" parent="${cell.parent!}"${sourceAttr}${targetAttr}><mxGeometry relative="1" as="geometry"/></mxCell>`;
        }
      })
      .join("");

    return `${layerCellsXml}${cellsXml}`;
  }

  /** Lookup map for single-pass XML escaping */
  private static readonly XML_ESCAPE_MAP: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  };

  private escapeXml(str: string): string {
    return str.replace(/[&<>"']/g, ch => DiagramModel.XML_ESCAPE_MAP[ch]);
  }

  /**
   * Clear all cells and reset the diagram to its initial empty state.
   */
  clear(): { vertices: number; edges: number } {
    let vertices = 0;
    let edges = 0;
    for (const c of this.cells.values()) {
      if (c.type === "vertex") vertices++;
      else edges++;
    }

    this.cells = new Map();
    this.layers = [{ id: "1", name: "Default Layer" }];
    this.activeLayerId = "1";
    this.nextId = 2;
    this.nextLayerId = 2;
    return { vertices, edges };
  }

  /**
   * Get statistics about the current diagram (active page)
   */
  getStats(): {
    total_cells: number;
    vertices: number;
    edges: number;
    groups: number;
    layers: number;
    bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
    cells_with_text: number;
    cells_without_text: number;
    cells_by_layer: Record<string, number>;
  } {
    // Single-pass collection of all statistics
    let vertexCount = 0;
    let edgeCount = 0;
    let groupCount = 0;
    let cellsWithText = 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasPositions = false;
    const cellsByLayer: Record<string, number> = {};

    for (const cell of this.cells.values()) {
      // Type counts
      if (cell.type === "vertex") {
        vertexCount++;
        if (cell.isGroup) groupCount++;
        // Bounding box (vertices only)
        if (cell.x !== undefined && cell.y !== undefined) {
          hasPositions = true;
          if (cell.x < minX) minX = cell.x;
          if (cell.y < minY) minY = cell.y;
          const right = cell.x + cell.width!;
          const bottom = cell.y + cell.height!;
          if (right > maxX) maxX = right;
          if (bottom > maxY) maxY = bottom;
        }
      } else {
        edgeCount++;
      }

      // Text counts
      if (cell.value && cell.value.trim().length > 0) cellsWithText++;

      // Layer counts
      const layer = cell.parent!;
      cellsByLayer[layer] = (cellsByLayer[layer] ?? 0) + 1;
    }

    const totalCells = vertexCount + edgeCount;

    return {
      total_cells: totalCells,
      vertices: vertexCount,
      edges: edgeCount,
      groups: groupCount,
      layers: this.layers.length,
      bounds: hasPositions ? { minX, minY, maxX, maxY } : null,
      cells_with_text: cellsWithText,
      cells_without_text: totalCells - cellsWithText,
      cells_by_layer: cellsByLayer,
    };
  }

/**
 * Batch add multiple cells (vertices and edges) in a single operation.
 * Validates entire batch before executing to fail fast.
 * Returns an array of results with created cells or errors.
 */
batchAddCells(
  items: Array<{
    type: "vertex" | "edge";
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    style?: string;
    sourceId?: string;
    targetId?: string;
    tempId?: string;
  }>,
  options?: { dryRun?: boolean },
): Array<{ success: boolean; cell?: Cell; error?: StructuredError; tempId?: string }> {
  // Pre-validate entire batch
  const validationErrors = this.validateBatchCells(items);
  if (validationErrors.length > 0) {
    return validationErrors;
  }

  // If dry-run, return success without persisting
  if (options?.dryRun) {
    return items.map((item, index) => ({
      success: true,
      tempId: item.tempId,
      cell: {
        id: `temp-cell-${index}`,
        type: item.type,
        value: item.text ?? "",
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        style: item.style,
        sourceId: item.sourceId,
        targetId: item.targetId,
      } as Cell,
    }));
  }

  // Execute batch operations
  const results: Array<{ success: boolean; cell?: Cell; error?: StructuredError; tempId?: string }> =
    [];
  const tempIdMap = new Map<string, string>();

  for (const item of items) {
    if (item.type === "vertex") {
      const cell = this.addRectangle({
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        text: item.text,
        style: item.style,
      });
      if (item.tempId) {
        tempIdMap.set(item.tempId, cell.id);
      }
      results.push({ success: true, cell, tempId: item.tempId });
    } else if (item.type === "edge") {
      // Validation guarantees sourceId/targetId are truthy for edges
      const sourceId = tempIdMap.get(item.sourceId!) ?? item.sourceId!;
      const targetId = tempIdMap.get(item.targetId!) ?? item.targetId!;

      const result = this.addEdge({
        sourceId,
        targetId,
        text: item.text,
        style: item.style,
      });

      // Validation guarantees addEdge succeeds — cast safely
      const edge = result as Cell;
      if (item.tempId) {
        tempIdMap.set(item.tempId, edge.id);
      }
      results.push({ success: true, cell: edge, tempId: item.tempId });
    }
  }

  return results;
}

private validateBatchCells(
  items: Array<{
    type: "vertex" | "edge";
    sourceId?: string;
    targetId?: string;
    tempId?: string;
  }>,
): Array<{ success: boolean; error: StructuredError; tempId?: string }> {
  const errors: Array<{ success: boolean; error: StructuredError; tempId?: string }> = [];
  const createdTempIds = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.type === "edge") {
      // Validate source exists (check temp IDs from earlier items and existing cells)
      const sourceExists =
        !!(item.sourceId && (createdTempIds.has(item.sourceId) || this.cells.has(item.sourceId)));
      if (!sourceExists) {
        errors.push({
          success: false,
          tempId: item.tempId,
          error: {
            code: "INVALID_SOURCE",
            message: `Edge at index ${i}: source cell '${item.sourceId}' not found`,
            index: i,
            suggestion: "Ensure source_id references an existing cell or a temp_id defined earlier in the batch",
          },
        });
      }

      // Validate target exists
      const targetExists =
        !!(item.targetId && (createdTempIds.has(item.targetId) || this.cells.has(item.targetId)));
      if (!targetExists) {
        errors.push({
          success: false,
          tempId: item.tempId,
          error: {
            code: "INVALID_TARGET",
            message: `Edge at index ${i}: target cell '${item.targetId}' not found`,
            index: i,
            suggestion:
              "Ensure target_id references an existing cell or a temp_id defined earlier in the batch",
          },
        });
      }
    }

    // Track temp IDs for validation
    if (item.tempId) {
      createdTempIds.add(item.tempId);
    }
  }

  return errors;
}

/**
 * Batch edit multiple edges in a single operation.
 */
batchEditEdges(
  updates: Array<{
    cell_id: string;
    text?: string;
    source_id?: string;
    target_id?: string;
    style?: string;
  }>,
): Array<{ success: boolean; cell?: Cell; error?: StructuredError; cell_id: string }> {
  return updates.map((update) => {
    const result = this.editEdge(update.cell_id, {
      text: update.text,
      sourceId: update.source_id,
      targetId: update.target_id,
      style: update.style,
    });

    if ("error" in result) {
      return {
        success: false,
        cell_id: update.cell_id,
        error: result.error,
      };
    }

    return {
      success: true,
      cell_id: update.cell_id,
      cell: result,
    };
  });
}

/**
 * Batch edit multiple cells in a single operation.
 */
batchEditCells(
  updates: Array<{
    cell_id: string;
    text?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    style?: string;
  }>,
): Array<{ success: boolean; cell?: Cell; error?: StructuredError; cell_id: string }> {
  return updates.map((update) => {
    const result = this.editCell(update.cell_id, {
      text: update.text,
      x: update.x,
      y: update.y,
      width: update.width,
      height: update.height,
      style: update.style,
    });

    if ("error" in result) {
      return {
        success: false,
        cell_id: update.cell_id,
        error: result.error,
      };
    }

    return {
      success: true,
      cell_id: update.cell_id,
      cell: result,
    };
  });
}
}

// Singleton instance for the diagram
export const diagram = new DiagramModel();
