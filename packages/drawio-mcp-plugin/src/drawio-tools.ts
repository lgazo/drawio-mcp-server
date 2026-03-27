/**
 * Draw.io Tools Module
 *
 * Tool implementations that run inside the Draw.io plugin
 */

import { shapeLibrary } from "./shape-library.js";
import type { MxGraphIsLayer } from "./types.js";

export type CellId = string;
export type CellStyle = string;

export interface DrawioCellOptions {
  cell_id?: CellId;
  source_id?: CellId;
  target_id?: CellId;
  shape_name?: string;
  category_id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  style?: CellStyle;
  key?: string;
  value?: any;
  parent_id?: string;
  layer_id?: string;
  target_layer_id?: string;
  name?: string;
  page?: number;
  page_size?: number;
  filter?: any;
  points?: Array<{ x: number; y: number }>;
}

export interface TransformedCell {
  id: string;
  mxObjectId: string;
  value:
  | string
  | {
    attributes?: any;
    nodeName?: string;
    localName?: string;
    tagName?: string;
  };
  geometry?: any;
  style?: CellStyle;
  edge?: boolean;
  edges?: any[];
  parent?: any;
  source?: any;
  target?: any;
  layer?: {
    id: string;
    name: string;
  };
  tags?: string[];
}

function transform_NamedNodeMap_to_record(attributes: any) {
  const tstr = Object.prototype.toString.call(attributes);
  if (tstr !== "[object NamedNodeMap]") {
    return attributes;
  }

  if (attributes.length === undefined) {
    return attributes;
  }

  let transformed_attributes: Record<string, any> = {};
  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes[i];
    if (attr && attr.name && attr.value !== undefined) {
      transformed_attributes[attr.name] = attr.value;
    }
  }
  return transformed_attributes;
}

function transform_cells_NamedNodeMap_to_attributes(cell: any) {
  if (cell.value.attributes && typeof cell.value.attributes === "object") {
    const attributes = cell.value.attributes;
    return transform_NamedNodeMap_to_record(attributes);
  }
  return {};
}

export function remove_circular_dependencies<T>(
  obj: T,
  visited: WeakSet<object> = new WeakSet(),
  path: string[] = [],
): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    if (visited.has(obj)) {
      return `[Circular ${path.join(".")}]` as unknown as T;
    }

    visited.add(obj);
    return obj.map((item, index) =>
      remove_circular_dependencies(item, visited, [...path, `[${index}]`]),
    ) as unknown as T;
  }

  const tstr = Object.prototype.toString.call(obj);
  if (tstr === "[object NamedNodeMap]") {
    return transform_NamedNodeMap_to_record(obj) as T;
  }
  if (tstr !== "[object Object]" && tstr !== "[object Element]") {
    return obj;
  }

  if (visited.has(obj)) {
    return `[Circular ${path.join(".")}]` as unknown as T;
  }

  visited.add(obj);
  const result: Record<string, any> = {};

  for (const key in obj) {
    const value = (obj as Record<string, any>)[key];

    if (
      typeof value !== "function" &&
      key !== "children" &&
      key !== "edges" &&
      !key.startsWith("aria") &&
      key !== "ownerDocument" &&
      key !== "part" &&
      key !== "classList" &&
      key !== "childNodes" &&
      key !== "shadowRoot" &&
      key !== "innerHTML" &&
      key !== "outerHTML" &&
      key !== "scrollTop" &&
      key !== "scrollLeft" &&
      key !== "scrollWidth" &&
      key !== "scrollHeight" &&
      key !== "clientTop" &&
      key !== "clientLeft" &&
      key !== "clientWidth" &&
      key !== "clientHeight" &&
      key !== "onbeforecopy" &&
      key !== "onbeforecut" &&
      key !== "onbeforepaste" &&
      key !== "onsearch" &&
      key !== "elementTiming" &&
      key !== "onfullscreenchange" &&
      key !== "onfullscreenerror" &&
      key !== "onwebkitfullscreenchange" &&
      key !== "onwebkitfullscreenerror" &&
      key !== "firstElementChild" &&
      key !== "lastElementChild" &&
      key !== "childElementCount" &&
      key !== "previousElementSibling" &&
      key !== "nextElementSibling" &&
      key !== "currentCSSZoom" &&
      key !== "parentNode" &&
      key !== "parentElement" &&
      key !== "firstChild" &&
      key !== "lastChild" &&
      key !== "previousSibling" &&
      key !== "nextSibling" &&
      key !== "nodeValue" &&
      key !== "textContent" &&
      key !== "ELEMENT_NODE" &&
      key !== "ATTRIBUTE_NODE" &&
      key !== "TEXT_NODE" &&
      key !== "CDATA_SECTION_NODE" &&
      key !== "ENTITY_REFERENCE_NODE" &&
      key !== "ENTITY_NODE" &&
      key !== "PROCESSING_INSTRUCTION_NODE" &&
      key !== "COMMENT_NODE" &&
      key !== "DOCUMENT_NODE" &&
      key !== "DOCUMENT_TYPE_NODE" &&
      key !== "DOCUMENT_FRAGMENT_NODE" &&
      key !== "NOTATION_NODE" &&
      key !== "DOCUMENT_POSITION_DISCONNECTED" &&
      key !== "DOCUMENT_POSITION_PRECEDING" &&
      key !== "DOCUMENT_POSITION_FOLLOWING" &&
      key !== "DOCUMENT_POSITION_CONTAINS" &&
      key !== "DOCUMENT_POSITION_CONTAINED_BY" &&
      key !== "DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC"
    ) {
      let stripped_value = {};

      if (
        (key === "parent" || key === "source" || key === "target") &&
        value !== undefined &&
        value !== null
      ) {
        stripped_value = {
          id: value.id,
        };
      } else {
        stripped_value = value;
      }
      result[key] = remove_circular_dependencies(stripped_value, visited, [
        ...path,
        key,
      ]);
    }
  }

  return result as T;
}

/**
 * Transforms a cell object to retain only essential fields and sanitize data
 */
export function transform_cell_for_display(
  cell: any,
): TransformedCell | null {
  if (!cell || typeof cell !== "object") {
    return null;
  }

  const transformed: TransformedCell = {
    id: cell.id || "",
    mxObjectId: cell.mxObjectId || "",
    value: "",
    geometry: cell.geometry,
    style: cell.style,
    edge: cell.edge,
    edges: cell.edges,
    parent: cell.parent,
    source: cell.source,
    target: cell.target,
  };

  if (cell.value !== null && cell.value !== undefined) {
    if (typeof cell.value === "string") {
      transformed.value = cell.value;
    } else if (typeof cell.value === "object") {
      const transformed_attributes = transform_cells_NamedNodeMap_to_attributes(cell);

      transformed.value = {
        attributes: transformed_attributes,
        nodeName: cell.value.nodeName,
        localName: cell.value.localName,
        tagName: cell.value.tagName,
      };
    }
  }

  return transformed;
}

/**
 * Gets the layer information for a given cell
 */
export function get_cell_layer(
  graph: any,
  cell: any,
): { id: string; name: string } | null {
  if (!cell || !graph) {
    return null;
  }

  try {
    const layer = graph.getLayerForCell(cell);
    if (layer) {
      return {
        id: layer.id || "",
        name: layer.value || "Default Layer",
      };
    }
  } catch (error) {
    console.warn("Could not get layer for cell:", error);
  }

  return null;
}

/**
 * Gets the tags for a given cell
 */
export function get_cell_tags(graph: any, cell: any): string[] {
  if (!cell || !graph) {
    return [];
  }

  try {
    const tags = graph.getTagsForCell(cell);
    return tags || [];
  } catch (error) {
    console.warn("Could not get tags for cell:", error);
    return [];
  }
}

function mx_isRoot(root_cell: any) {
  return function (cell: any): boolean {
    return null != cell && cell == root_cell;
  };
}

function mx_isLayer(root_cell: any) {
  return function (cell: any): boolean {
    return mx_isRoot(root_cell)(cell.getParent());
  };
}

function resolve_parent(graph: any, parent_id?: string): any {
  if (parent_id) {
    const model = graph.getModel();
    const parent = model.getCell(parent_id);
    if (!parent) {
      throw new Error(`Parent cell '${parent_id}' not found`);
    }
    return parent;
  }
  return graph.getDefaultParent();
}

export function add_new_rectangle(ui: any, options: DrawioCellOptions) {
  const { editor } = ui;
  const { graph } = editor;

  const x = options.x || 100;
  const y = options.y || 100;
  const width = options.width || 120;
  const height = options.height || 60;
  const text = options.text || "";
  const style =
    options.style ||
    "whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;";
  const parent = resolve_parent(graph, options.parent_id);

  graph.getModel().beginUpdate();
  try {
    const vertex = graph.insertVertex(
      parent,
      null,
      text,
      x,
      y,
      width,
      height,
      style,
    );
    return vertex;
  } finally {
    graph.getModel().endUpdate();
  }
}

export function delete_cell_by_id(
  ui: any,
  options: DrawioCellOptions,
): boolean {
  const { editor } = ui;
  const { graph } = editor;

  const cell_id = options.cell_id as CellId;
  const cell = graph.getModel().getCell(cell_id);

  if (!cell) {
    return false;
  }

  graph.getModel().beginUpdate();
  try {
    graph.removeCells([cell]);
    return true;
  } finally {
    graph.getModel().endUpdate();
  }
}

const SELF_CONNECTOR_DEFAULT_STYLE =
  "edgeStyle=loopEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=classic;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0.5;entryY=1;entryDx=0;entryDy=0;";

export function add_edge(ui: any, options: DrawioCellOptions): any | null {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();

  const source = model.getCell(options.source_id);
  const target = model.getCell(options.target_id);

  if (!source || !target) {
    return null;
  }

  const isSelfConnector = options.source_id === options.target_id;

  const defaultStyle = isSelfConnector
    ? SELF_CONNECTOR_DEFAULT_STYLE
    : "endArrow=classic;html=1;rounded=0;";
  const style = options.style || defaultStyle;
  const text = options.text || "";
  const parent = resolve_parent(graph, options.parent_id);

  model.beginUpdate();
  try {
    const edge = graph.insertEdge(
      parent,
      null,
      text,
      source,
      target,
      style,
    );

    if (options.points && options.points.length > 0) {
      const geo = edge.getGeometry();
      const mxPoint = (window as any).mxPoint;
      geo.points = options.points.map((p) => new mxPoint(p.x, p.y));
      model.setGeometry(edge, geo);
    }

    return edge;
  } finally {
    model.endUpdate();
  }
}

export function edit_cell(ui: any, options: DrawioCellOptions): any {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();

  const cell_id = options.cell_id as CellId;
  if (!cell_id) {
    throw new Error("edit_cell requires a cell_id");
  }

  const cell = model.getCell(cell_id);
  if (!cell) {
    throw new Error(`edit_cell could not find cell with id '${cell_id}'`);
  }

  model.beginUpdate();
  try {
    const has_position_change =
      options.x !== undefined || options.y !== undefined;
    const has_size_change =
      options.width !== undefined || options.height !== undefined;

    if (has_position_change || has_size_change) {
      const geometry = cell.geometry ? cell.geometry.clone() : null;
      if (!geometry) {
        throw new Error(
          `Cell '${cell_id}' does not support geometry updates (missing geometry)`,
        );
      }

      if (options.x !== undefined) geometry.x = options.x as number;
      if (options.y !== undefined) geometry.y = options.y as number;
      if (options.width !== undefined) geometry.width = options.width as number;
      if (options.height !== undefined)
        geometry.height = options.height as number;

      model.setGeometry(cell, geometry);
    }

    if (options.text !== undefined) {
      graph.cellLabelChanged(cell, options.text, false);
    }

    if (options.style !== undefined) {
      graph.setCellStyle(options.style as CellStyle, [cell]);
    }
  } finally {
    model.endUpdate();
  }

  return cell;
}

export function edit_edge(ui: any, options: DrawioCellOptions): any {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();

  const cell_id = options.cell_id as CellId;
  if (!cell_id) {
    throw new Error("edit_edge requires a cell_id");
  }

  const edge = model.getCell(cell_id);
  if (!edge) {
    throw new Error(`edit_edge could not find edge with id '${cell_id}'`);
  }

  if (!edge.edge) {
    throw new Error(`Cell '${cell_id}' is not an edge`);
  }

  model.beginUpdate();
  try {
    if (options.source_id !== undefined) {
      const newSource = model.getCell(options.source_id as CellId);
      if (!newSource) {
        throw new Error(
          `edit_edge could not find source cell '${options.source_id}'`,
        );
      }
      model.setTerminal(edge, newSource, true);
    }

    if (options.target_id !== undefined) {
      const newTarget = model.getCell(options.target_id as CellId);
      if (!newTarget) {
        throw new Error(
          `edit_edge could not find target cell '${options.target_id}'`,
        );
      }
      model.setTerminal(edge, newTarget, false);
    }

    if (options.text !== undefined) {
      graph.cellLabelChanged(edge, options.text, false);
    }

    if (options.style !== undefined) {
      graph.setCellStyle(options.style as CellStyle, [edge]);
    }

    if (options.points !== undefined) {
      const geo = edge.getGeometry().clone();
      const mxPoint = (window as any).mxPoint;
      geo.points = options.points.map((p) => new mxPoint(p.x, p.y));
      model.setGeometry(edge, geo);
    }
  } finally {
    model.endUpdate();
  }

  return edge;
}

export function set_cell_shape(ui: any, options: DrawioCellOptions) {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();

  const cell_id = options.cell_id as CellId;
  const shape_name = options.shape_name as string;

  if (!cell_id) {
    throw new Error("set_cell_shape requires a cell_id");
  }
  if (!shape_name) {
    throw new Error("set_cell_shape requires a shape_name");
  }

  const cell = model.getCell(cell_id);
  if (!cell) {
    throw new Error(`set_cell_shape could not find cell with id '${cell_id}'`);
  }
  if (cell.edge) {
    throw new Error(
      `Cell '${cell_id}' is an edge; set_cell_shape expects a vertex`,
    );
  }

  const style = shapeLibrary?.[shape_name]?.style;
  if (!style) {
    throw new Error(
      `set_cell_shape could not find a shape named '${shape_name}'`,
    );
  }

  model.beginUpdate();
  try {
    graph.setCellStyle(style, [cell]);
  } finally {
    model.endUpdate();
  }

  return cell;
}

export function set_cell_data(ui: any, options: DrawioCellOptions) {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();
  const mxUtils = (window as any).mxUtils;

  const cell_id = options.cell_id as CellId;
  const key = options.key as string;
  const value = options.value;

  if (!cell_id) {
    throw new Error("set_cell_data requires a cell_id");
  }
  if (!key) {
    throw new Error("set_cell_data requires a key");
  }
  if (value === undefined) {
    throw new Error("set_cell_data requires a value");
  }

  const cell = model.getCell(cell_id);
  if (!cell) {
    throw new Error(`set_cell_data could not find cell with id '${cell_id}'`);
  }

  model.beginUpdate();
  try {
    let d = graph.getModel().getValue(cell);
    if (!mxUtils.isNode(d)) {
      var h = mxUtils.createXmlDocument().createElement("object");
      h.setAttribute("label", d || "");
      d = h;
    }

    d = d.cloneNode(!0);
    d.setAttribute(key, value);
    graph.getModel().setValue(cell, d);
  } catch (e) {
    console.error(`[set-cell-data] error`, e);
  } finally {
    model.endUpdate();
  }

  return cell;
}

export function get_shape_categories(ui: any) {
  const shapes = shapeLibrary;
  const categories = new Set<string>();
  for (const shape of Object.values(shapes)) {
    categories.add((shape as any).category || "General");
  }
  return [...categories];
}

export function get_shapes_in_category(ui: any, options: DrawioCellOptions) {
  const shapes = shapeLibrary;
  return Object.entries(shapes)
    .filter(([_, shape]: [string, any]) => {
      return shape.category === options.category_id;
    })
    .map(([shape_key, shape_value]: [string, any]) => {
      return {
        id: shape_key,
        title: shape_value.title || shape_key,
      };
    });
}

export function get_shape_by_name(
  ui: any,
  options: DrawioCellOptions,
): any | null {
  const shapes = shapeLibrary;
  const shape = shapes[options.shape_name as string];
  if (!shape) return null;
  return {
    id: options.shape_name,
    ...shape,
  };
}

export function add_cell_of_shape(ui: any, options: DrawioCellOptions) {
  const { editor } = ui;
  const { graph } = editor;

  const shape_name = options.shape_name || "rectangle";
  const x = options.x || 100;
  const y = options.y || 100;
  const width = options.width || 120;
  const height = options.height || 80;
  const text = options.text || "";
  const style = (options.style || "") as CellStyle;
  const parent = resolve_parent(graph, options.parent_id);

  const shape_entry = get_shape_by_name(ui, { shape_name });

  if (!shape_entry) return null;

  graph.getModel().beginUpdate();
  try {
    const cell = graph.insertVertex(
      parent,
      null,
      text,
      x,
      y,
      width,
      height,
      `${shape_entry.style};${style}`,
      false,
    );
    return cell;
  } finally {
    graph.getModel().endUpdate();
  }
}

export function list_paged_model(
  ui: any,
  options: {
    page?: number;
    page_size?: number;
    filter?: {
      cell_type?: "edge" | "node" | "object" | "layer";
      parent_ids?: string[];
      layer_ids?: string[];
      ids?: string[];
      attributes?: any[];
    };
  } = {},
): TransformedCell[] {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();
  const cells = model.cells;

  if (!cells) {
    return [];
  }

  function parse_style_attributes(style: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    if (!style) return attributes;

    const pairs = style.split(";");
    for (const pair of pairs) {
      const [key, ...valueParts] = pair.split("=");
      if (key && valueParts.length > 0) {
        attributes[key.trim()] = valueParts.join("=").trim();
      }
    }
    return attributes;
  }

  function extract_cell_attributes(cell: any): Record<string, any> {
    const attributes: Record<string, any> = {};
    attributes.id = cell.id || "";
    attributes.edge = cell.edge || false;

    if (cell.style) {
      Object.assign(attributes, parse_style_attributes(cell.style));
    }

    if (cell.value && typeof cell.value === "object" && cell.value.attributes) {
      const transformed_attributes =
        transform_cells_NamedNodeMap_to_attributes(cell);
      Object.assign(attributes, transformed_attributes);
    }

    if (cell.value && typeof cell.value === "string") {
      attributes.text = cell.value;
    }

    return attributes;
  }

  function evaluate_filter_expression(
    expression: any[],
    attributes: Record<string, any>,
  ): boolean {
    if (!Array.isArray(expression) || expression.length === 0) {
      return true;
    }

    const [operator, ...operands] = expression;

    switch (operator) {
      case "and":
        return operands.every((op) =>
          evaluate_filter_expression(op, attributes),
        );
      case "or":
        return operands.some((op) =>
          evaluate_filter_expression(op, attributes),
        );
      case "equal":
        if (operands.length !== 2) return false;
        const [key, value] = operands;
        return attributes[key] === value;
      default:
        return true;
    }
  }

  function matches_cell_type(
    cell: any,
    cell_type: string,
    isLayer: MxGraphIsLayer,
  ): boolean {
    switch (cell_type) {
      case "edge":
        return cell.edge === true || cell.edge === 1;
      case "vertex":
        return cell.edge === false;
      case "object":
        return cell.value?.nodeName === "object";
      case "group":
        return cell.style === "group";
      case "layer":
        return isLayer(cell);
      default:
        return true;
    }
  }

  let filtered_cells: any[] = Object.values(cells);

  if (options.filter) {
    const filter = options.filter;
    const allParentIds = [
      ...(filter.parent_ids || []),
      ...(filter.layer_ids || []),
    ];

    filtered_cells = filtered_cells.filter((cell) => {
      if (
        options.filter?.cell_type &&
        !matches_cell_type(
          cell,
          options.filter.cell_type,
          mx_isLayer(model.root),
        )
      ) {
        return false;
      }

      if (options.filter?.attributes && options.filter.attributes.length > 0) {
        const cellAttributes = extract_cell_attributes(cell);
        if (
          !evaluate_filter_expression(options.filter.attributes, cellAttributes)
        ) {
          return false;
        }
      }

      if (allParentIds.length > 0) {
        const parent = cell.parent;
        if (!parent || !parent.id || !allParentIds.includes(parent.id)) {
          return false;
        }
      }

      if (filter.ids && filter.ids.length > 0) {
        if (!filter.ids.includes(cell.id)) {
          return false;
        }
      }

      return true;
    });
  }

  const page = Math.max(0, options.page || 0);
  const page_size = Math.max(1, options.page_size || 50);
  const start_index = page * page_size;

  const cell_ids = filtered_cells.map((cell) => cell.id);
  const paginated_ids = cell_ids.slice(start_index, start_index + page_size);

  const transformed_cells: TransformedCell[] = [];

  for (const cell_id of paginated_ids) {
    const cell = cells[cell_id];
    if (cell) {
      const sanitized_cell = remove_circular_dependencies(cell);
      const transformed_cell = transform_cell_for_display(sanitized_cell);

      if (transformed_cell) {
        const layer_info = get_cell_layer(graph, cell);
        if (layer_info) {
          transformed_cell.layer = layer_info;
        }

        const tags_info = get_cell_tags(graph, cell);
        if (tags_info && tags_info.length > 0) {
          transformed_cell.tags = tags_info;
        }
        transformed_cells.push(transformed_cell);
      }
    }
  }

  return transformed_cells;
}

export function list_layers(ui: any) {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();
  const root = model.getRoot();
  const layers = [];

  for (let i = 0; i < model.getChildCount(root); i++) {
    const layer = model.getChildAt(root, i);
    if (layer) {
      layers.push({
        id: layer.getId(),
        name: layer.getValue() || `Layer ${i}`,
        visible: layer.isVisible(),
        locked: !layer.isConnectable(),
      });
    }
  }

  return layers;
}

export function set_active_layer(ui: any, options: DrawioCellOptions) {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();
  const layer = model.getCell(options.layer_id);

  if (!layer) {
    throw new Error(`Layer with ID ${options.layer_id} not found`);
  }

  graph.setDefaultParent(layer);

  return {
    id: layer.getId(),
    name: layer.getValue() || "Unnamed Layer",
  };
}

export function move_cell_to_layer(ui: any, options: DrawioCellOptions) {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();

  const cell = model.getCell(options.cell_id);
  const targetLayer = model.getCell(options.target_layer_id);

  if (!cell) {
    throw new Error(`Cell with ID ${options.cell_id} not found`);
  }

  if (!targetLayer) {
    throw new Error(
      `Target layer with ID ${options.target_layer_id} not found`,
    );
  }

  model.beginUpdate();
  try {
    model.add(targetLayer, cell);
  } finally {
    model.endUpdate();
  }

  return {
    moved_cell: options.cell_id,
    to_layer: options.target_layer_id,
  };
}

export function set_cell_parent(ui: any, options: DrawioCellOptions) {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();

  const cell = model.getCell(options.cell_id);
  if (!cell) {
    throw new Error(`Cell with ID ${options.cell_id} not found`);
  }

  const parent = model.getCell(options.parent_id);
  if (!parent) {
    throw new Error(`Parent cell with ID ${options.parent_id} not found`);
  }

  model.beginUpdate();
  try {
    model.add(parent, cell);
  } finally {
    model.endUpdate();
  }

  return {
    cell_id: options.cell_id,
    parent_id: options.parent_id,
  };
}

export function get_active_layer(ui: any) {
  const { editor } = ui;
  const { graph } = editor;
  const activeLayer = graph.getDefaultParent();

  return {
    id: activeLayer.getId(),
    name: activeLayer.getValue() || "Default Layer",
  };
}

export function create_layer(ui: any, options: DrawioCellOptions) {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();
  const root = model.getRoot();

  model.beginUpdate();
  let newLayer;
  try {
    newLayer = new (window as any).mxCell(options.name);
    newLayer.setId(null);
    model.add(root, newLayer);
  } finally {
    model.endUpdate();
  }

  return {
    id: newLayer.getId(),
    name: options.name,
  };
}

export interface ExportOptions {
  format?: "svg" | "png" | "xml";
  scale?: number;
  border?: number;
  background?: string;
  shadow?: boolean;
  crop?: boolean;
  selection_only?: boolean;
  transparent?: boolean;
  dpi?: number;
  embed_xml?: boolean;
  size?: "selection" | "page" | "diagram";
}

export interface ExportResult {
  format: string;
  mimeType: string;
  data: string;
  width?: number;
  height?: number;
  warning?: string;
}

const PNG_SIZE_WARNING_THRESHOLD = 5 * 1024 * 1024;

export function export_diagram(ui: any, options: ExportOptions): ExportResult | Promise<ExportResult> {
  const format = options.format || "xml";
  const scale = options.scale ?? 1;
  const border = options.border ?? 0;
  const background = options.transparent ? null : (options.background ?? null);
  const includeShadow = options.shadow ?? false;
  const cropToDiagram = options.crop ?? true;
  const selectionOnly = options.selection_only ?? false;
  const embedXml = options.embed_xml ?? false;
  const size = options.size ?? "diagram";
  const dpi = options.dpi ?? 96;

  switch (format) {
    case "xml":
      return export_xml(ui, { selectionOnly, size });
    case "svg":
      return export_svg(ui, { scale, border, background, includeShadow, cropToDiagram, selectionOnly, embedXml, size });
    case "png":
      return export_png(ui, { scale, border, background, includeShadow, cropToDiagram, selectionOnly, embedXml, size, dpi });
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

interface XmlExportParams {
  selectionOnly: boolean;
  size: "selection" | "page" | "diagram";
}

function export_xml(ui: any, params: XmlExportParams): ExportResult {
  const mxUtils = (window as any).mxUtils;
  const { selectionOnly, size } = params;

  const ignoreSelection = !selectionOnly;
  const currentPage = size === "page" || size === "selection";
  const uncompressed = true;

  let xml: string;
  if (size === "selection" && selectionOnly) {
    const enc = new (window as any).mxCodec();
    const node = enc.encode(ui.editor.graph.getModel());
    xml = mxUtils.getXml(node);
  } else {
    const node = ui.getXmlFileData(ignoreSelection, currentPage, uncompressed);
    xml = mxUtils.getXml(node);
  }

  return {
    format: "xml",
    mimeType: "application/xml",
    data: xml,
  };
}

interface SvgExportParams {
  scale: number;
  border: number;
  background: string | null;
  includeShadow: boolean;
  cropToDiagram: boolean;
  selectionOnly: boolean;
  embedXml: boolean;
  size: "selection" | "page" | "diagram";
}

function export_svg(ui: any, params: SvgExportParams): ExportResult {
  const mxUtils = (window as any).mxUtils;
  const Graph = (window as any).Graph;
  const { scale, border, background, includeShadow, selectionOnly, embedXml, size } = params;

  const graph = ui.editor.graph;
  const ignoreSelection = !selectionOnly && size !== "selection";
  const bg = background !== "none" ? background : null;

  if (embedXml) {
    const currentPage = size === "page" || size === "selection";
    const svgString = ui.getFileData(false, true, null, null, ignoreSelection, currentPage);
    const bounds = graph.getGraphBounds();
    const w = Math.ceil(bounds.width * scale + bounds.x * scale + 2 * border);
    const h = Math.ceil(bounds.height * scale + bounds.y * scale + 2 * border);

    return {
      format: "svg",
      mimeType: "image/svg+xml",
      data: svgString,
      width: w,
      height: h,
    };
  }

  const svgRoot = graph.getSvg(
    bg,
    scale,
    border,
    !params.cropToDiagram,
    null,
    ignoreSelection,
  );

  if (graph.shadowVisible || includeShadow) {
    graph.addSvgShadow(svgRoot, null, null, border === 0);
  }

  const svgString = (Graph.xmlDeclaration || '<?xml version="1.0" encoding="UTF-8"?>') +
    '\n' + (Graph.svgDoctype || '') + '\n' + mxUtils.getXml(svgRoot);

  const w = parseInt(svgRoot.getAttribute("width")) || 0;
  const h = parseInt(svgRoot.getAttribute("height")) || 0;

  return {
    format: "svg",
    mimeType: "image/svg+xml",
    data: svgString,
    width: w,
    height: h,
  };
}

interface PngExportParams {
  scale: number;
  border: number;
  background: string | null;
  includeShadow: boolean;
  cropToDiagram: boolean;
  selectionOnly: boolean;
  embedXml: boolean;
  size: "selection" | "page" | "diagram";
  dpi: number;
}

function export_png(ui: any, params: PngExportParams): Promise<ExportResult> {
  return new Promise((resolve, reject) => {
    const { scale, border, background, includeShadow, selectionOnly, embedXml, size, dpi, cropToDiagram } = params;

    const imageCache: Record<string, any> = {};
    const ignoreSelection = !selectionOnly && size !== "selection";

    let xml: string | null = null;
    if (embedXml) {
      xml = ui.getFileData(true, null, null, null, ignoreSelection, size === "page" || size === "selection");
    }

    ui.exportToCanvas(
      (canvas: HTMLCanvasElement) => {
        try {
          let dataUrl: string;
          if (xml != null) {
            dataUrl = ui.createImageDataUri(canvas, xml, "png", dpi);
          } else {
            dataUrl = canvas.toDataURL("image/png");
          }

          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");

          const result: ExportResult = {
            format: "png",
            mimeType: "image/png",
            data: base64Data,
            width: canvas.width,
            height: canvas.height,
          };

          if (base64Data.length > PNG_SIZE_WARNING_THRESHOLD) {
            const sizeMB = (base64Data.length / (1024 * 1024)).toFixed(1);
            result.warning = `PNG export is large (${sizeMB} MB). Consider using SVG or reducing scale to reduce size.`;
          }

          resolve(result);
        } catch (err) {
          reject(err);
        }
      },
      null,
      imageCache,
      background,
      (err: any) => reject(err),
      null,
      ignoreSelection,
      scale,
      background === null,
      includeShadow,
      null,
      null,
      border,
      !cropToDiagram,
      false,
      null,
    );
  });
}
