/**
 * Draw.io Tools Module
 *
 * Tool implementations that run inside the Draw.io plugin
 */

import { shapeLibrary } from "./shape-library.js";

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
  layer_id?: string;
  target_layer_id?: string;
  name?: string;
  page?: number;
  page_size?: number;
  filter?: any;
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
      key !== "textContent"
    ) {
      let stripped_value = {};

      if (
        (
          key === "parent"
          || key === "source"
          || key === "target"
        ) &&
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

export function add_new_rectangle(
  ui: any,
  options: DrawioCellOptions,
) {
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

  graph.getModel().beginUpdate();
  try {
    const vertex = graph.insertVertex(
      graph.getDefaultParent(),
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

export function add_edge(ui: any, options: DrawioCellOptions): any | null {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();

  const source = model.getCell(options.source_id);
  const target = model.getCell(options.target_id);

  if (!source || !target) {
    return null;
  }

  const defaultStyle = "endArrow=classic;html=1;rounded=0;";
  const style = options.style || defaultStyle;
  const text = options.text || "";

  model.beginUpdate();
  try {
    const edge = graph.insertEdge(
      graph.getDefaultParent(),
      null,
      text,
      source,
      target,
      style,
    );
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
    throw new Error(`Cell '${cell_id}' is an edge; set_cell_shape expects a vertex`);
  }

  const style = shapeLibrary?.[shape_name]?.style;
  if (!style) {
    throw new Error(`set_cell_shape could not find a shape named '${shape_name}'`);
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

export function get_shape_by_name(ui: any, options: DrawioCellOptions): any | null {
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

  const shape_entry = get_shape_by_name(ui, { shape_name });

  if (!shape_entry) return null;

  graph.getModel().beginUpdate();
  try {
    const cell = graph.insertVertex(
      graph.getDefaultParent(),
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
  options: DrawioCellOptions = {},
) {
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
      const transformed_attributes = transform_cells_NamedNodeMap_to_attributes(cell);
      Object.assign(attributes, transformed_attributes);
    }

    if (cell.value && typeof cell.value === "string") {
      attributes.text = cell.value;
    }

    return attributes;
  }

  function matches_cell_type(cell: any, cell_type: string): boolean {
    switch (cell_type) {
      case "edge":
        return cell.edge === true || cell.edge === 1;
      case "vertex":
        return cell.edge === false;
      case "object":
        return cell.value?.nodeName === "object";
      case "group":
        return cell.style === "group";
      default:
        return true;
    }
  }

  let filtered_cells = Object.values(cells);

  if (options.filter) {
    const filter = options.filter;

    if (filter.cell_type) {
      filtered_cells = filtered_cells.filter(cell =>
        matches_cell_type(cell, filter.cell_type)
      );
    }

    if (filter.ids && filter.ids.length > 0) {
      filtered_cells = filtered_cells.filter(cell =>
        filter.ids.includes(cell.id)
      );
    }
  }

  const page = Math.max(0, options.page || 0);
  const page_size = Math.max(1, options.page_size || 50);
  const start_index = page * page_size;

  const paginated_ids = filtered_cells.slice(start_index, start_index + page_size).map((c: any) => c.id);

  const transformed_cells = [];

  for (const cell_id of paginated_ids) {
    const cell = cells[cell_id];
    if (cell) {
      const sanitized_cell = remove_circular_dependencies(cell);
      transformed_cells.push(sanitized_cell);
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
        locked: !layer.isConnectable()
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
    name: layer.getValue() || 'Unnamed Layer'
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
    throw new Error(`Target layer with ID ${options.target_layer_id} not found`);
  }
  
  model.beginUpdate();
  try {
    model.add(targetLayer, cell);
  } finally {
    model.endUpdate();
  }
  
  return {
    moved_cell: options.cell_id,
    to_layer: options.target_layer_id
  };
}

export function get_active_layer(ui: any) {
  const { editor } = ui;
  const { graph } = editor;
  const activeLayer = graph.getDefaultParent();
  
  return {
    id: activeLayer.getId(),
    name: activeLayer.getValue() || 'Default Layer'
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
    name: options.name
  };
}
