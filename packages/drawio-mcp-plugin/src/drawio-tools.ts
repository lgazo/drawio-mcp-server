/**
 * Draw.io Tools Module
 *
 * Tool implementations that run inside the Draw.io plugin
 */

import {
  getCategories,
  getShape,
  getShapesByCategory,
} from "./shape-library.js";
import type { MxGraphIsLayer } from "./types.js";

export type CellId = string;
export type CellStyle = string;
export type TargetPageSelector = {
  index?: number;
  id?: string;
};
export type PageInfo = {
  index: number;
  id: string;
  name: string;
  is_current: boolean;
};

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
  mode?: string;
  page?: number | TargetPageSelector;
  page_size?: number;
  filter?: any;
  points?: Array<{ x: number; y: number }>;
  target_page?: TargetPageSelector;
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

function ensure_pages_api(ui: any, selector_name: string) {
  if (!Array.isArray(ui?.pages) || ui.pages.length === 0) {
    throw new Error(
      `Draw.io pages are unavailable; cannot resolve \`${selector_name}\``,
    );
  }
}

function get_page_id(page: any): string {
  if (typeof page?.getId === "function") {
    return String(page.getId());
  }

  const id = page?.id ?? page?.node?.getAttribute?.("id");
  if (id === undefined || id === null || id === "") {
    throw new Error("Target page does not expose a stable ID");
  }

  return String(id);
}

function get_page_name(page: any, index: number): string {
  if (typeof page?.getName === "function") {
    const name = page.getName();
    if (name !== undefined && name !== null && name !== "") {
      return String(name);
    }
  }

  const fallback = page?.name ?? page?.node?.getAttribute?.("name");
  if (fallback !== undefined && fallback !== null && fallback !== "") {
    return String(fallback);
  }

  return `Page-${index + 1}`;
}

function get_page_rename_probe(ui: any, explicit_page?: any) {
  if (explicit_page) {
    return explicit_page;
  }

  if (ui?.currentPage) {
    return ui.currentPage;
  }

  if (Array.isArray(ui?.pages) && ui.pages.length > 0) {
    return ui.pages[0];
  }

  return null;
}

function assert_page_rename_supported(
  ui: any,
  action: string,
  explicit_page?: any,
) {
  const page = get_page_rename_probe(ui, explicit_page);

  if (typeof page?.setName !== "function") {
    throw new Error(
      `Draw.io page renaming is not supported in this version; cannot ${action}`,
    );
  }

  return page;
}

function rollback_created_page(ui: any, page: any) {
  if (!page || typeof ui?.removePage !== "function") {
    return;
  }

  try {
    ui.removePage(page);
  } catch (error) {
    console.warn("Could not roll back created page:", error);
  }
}

export function serialize_page_info(
  ui: any,
  page: any,
  index: number,
  isCurrent: boolean = (() => {
    if (ui?.currentPage === undefined || ui?.currentPage === null) {
      return false;
    }

    try {
      return get_page_id(page) === get_page_id(ui.currentPage);
    } catch {
      return false;
    }
  })(),
): PageInfo {
  return {
    index,
    id: get_page_id(page),
    name: get_page_name(page, index),
    is_current: isCurrent,
  };
}

export function resolve_target_page(
  ui: any,
  target_page?: TargetPageSelector,
  selector_name: string = "target_page",
) {
  ensure_pages_api(ui, selector_name);

  if (!target_page || typeof target_page !== "object") {
    throw new Error(`\`${selector_name}\` is required`);
  }

  const hasIndex = Number.isInteger(target_page.index);
  const hasId = typeof target_page.id === "string" && target_page.id.length > 0;

  if (hasIndex === hasId) {
    throw new Error(
      `\`${selector_name}\` must include exactly one of \`index\` or \`id\``,
    );
  }

  if (hasIndex) {
    const index = Number(target_page.index);
    if (index < 0 || index >= ui.pages.length) {
      throw new Error(
        `\`${selector_name}.index\` ${index} is out of range for ${ui.pages.length} pages`,
      );
    }

    return {
      page: ui.pages[index],
      index,
    };
  }

  const index = ui.pages.findIndex((page: any) => {
    try {
      return get_page_id(page) === target_page.id;
    } catch {
      return false;
    }
  });

  if (index === -1) {
    throw new Error(`Page with ID ${target_page.id} was not found`);
  }

  return {
    page: ui.pages[index],
    index,
  };
}

export function switch_to_target_page(ui: any, page: any) {
  const currentId =
    ui?.currentPage !== undefined && ui?.currentPage !== null
      ? get_page_id(ui.currentPage)
      : null;
  const targetId = get_page_id(page);

  if (currentId !== null && currentId === targetId) {
    return;
  }

  if (typeof ui?.selectPage !== "function") {
    throw new Error("Draw.io page switching is not supported in this version");
  }

  ui.selectPage(page);
}

export function get_selected_cell(ui: any) {
  return ui.editor.graph.getSelectionCell() || "no cell selected";
}

export function list_pages(ui: any): PageInfo[] {
  ensure_pages_api(ui, "pages");

  return ui.pages.map((page: any, index: number) =>
    serialize_page_info(ui, page, index),
  );
}

export function get_current_page(ui: any): PageInfo {
  ensure_pages_api(ui, "current page");

  const currentId =
    ui?.currentPage !== undefined && ui?.currentPage !== null
      ? get_page_id(ui.currentPage)
      : null;
  const currentIndex = ui.pages.findIndex(
    (page: any) => currentId !== null && get_page_id(page) === currentId,
  );
  if (currentIndex === -1 || !ui.currentPage) {
    throw new Error("Current page is not available");
  }

  return serialize_page_info(ui, ui.currentPage, currentIndex, true);
}

export function create_page(ui: any, options: DrawioCellOptions): PageInfo {
  if (typeof ui?.insertPage !== "function") {
    throw new Error("Draw.io page creation is not supported in this version");
  }

  if (options.name) {
    assert_page_rename_supported(ui, "create a named page");
  }

  const newPage = ui.insertPage(null, ui.pages?.length);
  if (!newPage) {
    throw new Error("Failed to create a new page");
  }

  if (options.name) {
    try {
      assert_page_rename_supported(ui, "create a named page", newPage);
      newPage.setName(options.name);
    } catch (error) {
      rollback_created_page(ui, newPage);
      throw error;
    }
  }

  switch_to_target_page(ui, newPage);

  const newPageId = get_page_id(newPage);
  const index = Array.isArray(ui.pages)
    ? ui.pages.findIndex((page: any) => get_page_id(page) === newPageId)
    : -1;
  if (index === -1) {
    throw new Error("Created page is not present in the page list");
  }

  return serialize_page_info(ui, newPage, index, true);
}

export function rename_page(ui: any, options: DrawioCellOptions): PageInfo {
  const page_selector =
    typeof options.page === "number" ? { index: options.page } : options.page;
  const resolved = resolve_target_page(ui, page_selector, "page");
  switch_to_target_page(ui, resolved.page);

  if (!options.name) {
    throw new Error("`name` is required");
  }

  assert_page_rename_supported(ui, "rename a page", resolved.page);

  resolved.page.setName(options.name);

  return serialize_page_info(ui, resolved.page, resolved.index, true);
}

/**
 * Transforms a cell object to retain only essential fields and sanitize data
 */
export function transform_cell_for_display(cell: any): TransformedCell | null {
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
      const transformed_attributes =
        transform_cells_NamedNodeMap_to_attributes(cell);

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

function normalize_shape_style(shapeName: string, style: string): string {
  if (!style || !shapeName.startsWith("mxgraph.aws4.")) {
    return style;
  }

  const hasExplicitShape = style.includes("shape=");
  if (hasExplicitShape) {
    return style;
  }

  return `shape=${shapeName};${style}`;
}

function apply_style_to_cell(graph: any, cell: any, style: string) {
  if (!style || !cell) {
    return;
  }

  const model = graph.getModel();
  model.setStyle(cell, style);

  if (typeof cell.setStyle === "function") {
    cell.setStyle(style);
  }

  if (typeof graph.refresh === "function") {
    graph.refresh(cell);
  }
}

function create_basic_vertex(
  graph: any,
  options: {
    parent: any;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  },
) {
  return graph.insertVertex(
    options.parent,
    null,
    options.text,
    options.x,
    options.y,
    options.width,
    options.height,
    "rounded=0;whiteSpace=wrap;html=1;",
    false,
  );
}

function create_shape_vertex(
  graph: any,
  options: {
    parent: any;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    style: string;
  },
) {
  const mxCell = (window as any).mxCell;
  const mxGeometry = (window as any).mxGeometry;

  const cell = new mxCell(
    options.text,
    new mxGeometry(options.x, options.y, options.width, options.height),
    options.style,
  );
  cell.vertex = true;

  graph.addCell(cell, options.parent);
  return cell;
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
    const edge = graph.insertEdge(parent, null, text, source, target, style);

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

  const style = getShape(shape_name)?.style;
  if (!style) {
    throw new Error(
      `set_cell_shape could not find a shape named '${shape_name}'`,
    );
  }

  model.beginUpdate();
  try {
    apply_style_to_cell(graph, cell, style);
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

export function get_shape_categories(_ui: any) {
  return getCategories();
}

export function get_shapes_in_category(_ui: any, options: DrawioCellOptions) {
  return getShapesByCategory(options.category_id as string);
}

export function get_shape_by_name(
  _ui: any,
  options: DrawioCellOptions,
): any | null {
  const shape = getShape(options.shape_name as string);
  if (!shape) return null;
  return {
    id: options.shape_name,
    ...shape,
  };
}

export function add_cell_of_shape(ui: any, options: DrawioCellOptions) {
  const { editor } = ui;
  const { graph } = editor;

  const shape_name = options.shape_name;
  if (!shape_name) {
    throw new Error("add_cell_of_shape requires a shape_name");
  }

  const x = options.x || 100;
  const y = options.y || 100;
  const width = options.width || 120;
  const height = options.height || 80;
  const text = options.text || "";
  const style = (options.style || "") as CellStyle;
  const parent = resolve_parent(graph, options.parent_id);

  const shape_entry = get_shape_by_name(ui, { shape_name });

  if (!shape_entry) return null;

  const mergedStyle = normalize_shape_style(
    shape_name,
    [shape_entry.style, style]
      .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
      .join(";"),
  );

  graph.getModel().beginUpdate();
  try {
    const cell = create_shape_vertex(graph, {
      parent,
      text,
      x,
      y,
      width,
      height,
      style: mergedStyle,
    });
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

export function export_diagram(
  ui: any,
  options: ExportOptions,
): ExportResult | Promise<ExportResult> {
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
      return export_svg(ui, {
        scale,
        border,
        background,
        includeShadow,
        cropToDiagram,
        selectionOnly,
        embedXml,
        size,
      });
    case "png":
      return export_png(ui, {
        scale,
        border,
        background,
        includeShadow,
        cropToDiagram,
        selectionOnly,
        embedXml,
        size,
        dpi,
      });
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
  const {
    scale,
    border,
    background,
    includeShadow,
    selectionOnly,
    embedXml,
    size,
  } = params;

  const graph = ui.editor.graph;
  const ignoreSelection = !selectionOnly && size !== "selection";
  const bg = background !== "none" ? background : null;

  if (embedXml) {
    const currentPage = size === "page" || size === "selection";
    const svgString = ui.getFileData(
      false,
      true,
      null,
      null,
      ignoreSelection,
      currentPage,
    );
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

  const svgString =
    (Graph.xmlDeclaration || '<?xml version="1.0" encoding="UTF-8"?>') +
    "\n" +
    (Graph.svgDoctype || "") +
    "\n" +
    mxUtils.getXml(svgRoot);

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
    const {
      scale,
      border,
      background,
      includeShadow,
      selectionOnly,
      embedXml,
      size,
      dpi,
      cropToDiagram,
    } = params;

    const imageCache: Record<string, any> = {};
    const ignoreSelection = !selectionOnly && size !== "selection";

    let xml: string | null = null;
    if (embedXml) {
      xml = ui.getFileData(
        true,
        null,
        null,
        null,
        ignoreSelection,
        size === "page" || size === "selection",
      );
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

export interface ImportOptions {
  data: string;
  format: "xml" | "svg" | "png";
  mode?: "replace" | "add" | "new-page";
  filename?: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  pages?: number;
  cells?: number;
}

function extractXmlFromSvg(svgContent: string): string | null {
  try {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");

    // Look for metadata with mxfile
    const metadata = svgDoc.querySelector("metadata");
    if (metadata) {
      const mxfile = metadata.querySelector("mxfile");
      if (mxfile) {
        const serializer = new XMLSerializer();
        return serializer.serializeToString(mxfile);
      }
    }

    // Look for defs with mxfile
    const defs = svgDoc.querySelector("defs");
    if (defs) {
      const mxfile = defs.querySelector("mxfile");
      if (mxfile) {
        const serializer = new XMLSerializer();
        return serializer.serializeToString(mxfile);
      }
    }

    // Look for any mxfile element
    const mxfile = svgDoc.querySelector("mxfile");
    if (mxfile) {
      const serializer = new XMLSerializer();
      return serializer.serializeToString(mxfile);
    }

    return null;
  } catch (error) {
    console.error("[import-diagram] Error extracting XML from SVG:", error);
    return null;
  }
}

function extractXmlFromPng(base64Png: string): string | null {
  try {
    // Decode base64 to binary
    const binaryString = atob(base64Png);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // PNG signature
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

    // Check PNG signature
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== pngSignature[i]) {
        console.error("[import-diagram] Invalid PNG signature");
        return null;
      }
    }

    let offset = 8;

    while (offset < bytes.length) {
      // Read chunk length (4 bytes, big-endian)
      const length =
        (bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3];

      // Read chunk type (4 bytes)
      const chunkType = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7],
      );

      // Check for tEXt chunks
      if (chunkType === "tEXt") {
        const chunkData = bytes.slice(offset + 8, offset + 8 + length);

        // Find null separator
        let nullIndex = -1;
        for (let i = 0; i < chunkData.length; i++) {
          if (chunkData[i] === 0) {
            nullIndex = i;
            break;
          }
        }

        if (nullIndex !== -1) {
          const keyword = String.fromCharCode(...chunkData.slice(0, nullIndex));
          const text = String.fromCharCode(...chunkData.slice(nullIndex + 1));

          // Look for mxGraphModel or mxfile
          if (
            keyword === "mxGraphModel" ||
            keyword === "mxfile" ||
            text.includes("<mxfile") ||
            text.includes("<mxGraphModel")
          ) {
            return text;
          }
        }
      }

      // Check for zTXt chunks (compressed)
      if (chunkType === "zTXt") {
        const chunkData = bytes.slice(offset + 8, offset + 8 + length);

        // Find null separator
        let nullIndex = -1;
        for (let i = 0; i < chunkData.length; i++) {
          if (chunkData[i] === 0) {
            nullIndex = i;
            break;
          }
        }

        if (nullIndex !== -1) {
          const keyword = String.fromCharCode(...chunkData.slice(0, nullIndex));
          const compressionMethod = chunkData[nullIndex + 1];

          // Only handle compression method 0 (deflate)
          if (compressionMethod === 0) {
            const compressedData = chunkData.slice(nullIndex + 2);

            // Try to decompress using DecompressionStream (modern browsers)
            if (typeof DecompressionStream !== "undefined") {
              // Note: This would need async handling, but we're in a sync context
              // For now, skip zTXt chunks
              console.warn(
                "[import-diagram] zTXt chunk found but decompression not implemented in sync context",
              );
            }
          }
        }
      }

      // Move to next chunk (length + type + data + CRC)
      offset += 12 + length;
    }

    return null;
  } catch (error) {
    console.error("[import-diagram] Error extracting XML from PNG:", error);
    return null;
  }
}

export function import_diagram(
  ui: any,
  options: Record<string, unknown>,
): ImportResult {
  const {
    data,
    format,
    mode = "replace",
    filename,
  } = options as unknown as ImportOptions;

  if (!data) {
    return { success: false, message: "No data provided" };
  }

  let xml: string | null = null;

  // Extract XML based on format
  switch (format) {
    case "xml":
      xml = data;
      break;
    case "svg":
      // SVG might be base64 encoded or raw
      let svgContent = data;
      if (!data.trim().startsWith("<")) {
        try {
          svgContent = atob(data);
        } catch (e) {
          return { success: false, message: "Invalid base64 SVG data" };
        }
      }
      xml = extractXmlFromSvg(svgContent);
      if (!xml) {
        return { success: false, message: "Could not extract XML from SVG" };
      }
      break;
    case "png":
      // PNG should be base64 encoded
      xml = extractXmlFromPng(data);
      if (!xml) {
        return { success: false, message: "Could not extract XML from PNG" };
      }
      break;
    default:
      return { success: false, message: `Unsupported format: ${format}` };
  }

  if (!xml) {
    return { success: false, message: "Failed to extract XML from input" };
  }

  // Validate XML structure
  const mxUtils = (window as any).mxUtils;
  if (!mxUtils) {
    return { success: false, message: "mxUtils not available" };
  }

  try {
    // Parse XML to validate it
    const doc = mxUtils.parseXml(xml);
    if (!doc || !doc.documentElement) {
      return { success: false, message: "Invalid XML structure" };
    }

    // Check if it's a valid Draw.io XML
    const root = doc.documentElement;
    if (root.nodeName !== "mxfile" && root.nodeName !== "mxGraphModel") {
      return {
        success: false,
        message: `Invalid Draw.io XML: expected mxfile or mxGraphModel, got ${root.nodeName}`,
      };
    }

    const { editor } = ui;
    const { graph } = editor;
    const model = graph.getModel();

    // Count cells in imported XML
    let cellCount = 0;
    const cells = doc.getElementsByTagName("mxCell");
    cellCount = cells.length;

    // Handle different import modes
    switch (mode) {
      case "replace":
        // Extract the mxGraphModel from mxfile if needed
        let graphModelElement = doc.documentElement;
        if (graphModelElement.nodeName === "mxfile") {
          const diagram = graphModelElement.querySelector("diagram");
          if (diagram) {
            const mxGraphModel = diagram.querySelector("mxGraphModel");
            if (mxGraphModel) {
              graphModelElement = mxGraphModel;
            }
          }
        }

        // Clear current diagram first, then load new one
        // Use editor.setGraphXml which handles the reset internally
        if (editor.setGraphXml) {
          editor.setGraphXml(graphModelElement);
          // Refresh the graph view
          graph.refresh();
          graph.fit();
        } else {
          // Fallback: reset model and use mxCodec to decode
          model.clear();
          model.setRoot(new (window as any).mxCell());
          const codec = new (window as any).mxCodec(
            graphModelElement.ownerDocument,
          );
          codec.decode(graphModelElement, model);
        }

        return {
          success: true,
          message: `Diagram replaced successfully${filename ? ` from ${filename}` : ""}`,
          cells: cellCount,
        };

      case "add":
        // Merge imported cells into current diagram
        model.beginUpdate();
        try {
          // Parse the imported XML
          const importedDoc = mxUtils.parseXml(xml);
          const importedRoot = importedDoc.documentElement;

          // Get the root element (mxfile or mxGraphModel)
          let graphModel = importedRoot;
          if (importedRoot.nodeName === "mxfile") {
            // Find the first diagram
            const diagram = importedRoot.querySelector("diagram");
            if (diagram) {
              graphModel = diagram.querySelector("mxGraphModel") || diagram;
            }
          }

          // Get the root cell from imported model
          const importedRootCell = graphModel.querySelector("root");
          if (importedRootCell) {
            // Get current default parent
            const defaultParent = graph.getDefaultParent();

            // Import cells (skip root cells with id 0 and 1)
            const importedCells = importedRootCell.querySelectorAll("mxCell");
            const idMapping: Record<string, string> = {};

            importedCells.forEach((cell: any) => {
              const oldId = cell.getAttribute("id");

              // Skip root cells
              if (oldId === "0" || oldId === "1") {
                return;
              }

              // Create new cell
              const newCell = new (window as any).mxCell();
              newCell.setId(null); // Generate new ID

              // Copy attributes
              if (cell.hasAttribute("value")) {
                newCell.setValue(cell.getAttribute("value"));
              }
              if (cell.hasAttribute("style")) {
                newCell.setStyle(cell.getAttribute("style"));
              }
              if (cell.hasAttribute("vertex")) {
                newCell.vertex = cell.getAttribute("vertex") === "1";
              }
              if (cell.hasAttribute("edge")) {
                newCell.edge = cell.getAttribute("edge") === "1";
              }

              // Copy geometry
              const geo = cell.querySelector("mxGeometry");
              if (geo) {
                const geometry = new (window as any).mxGeometry(
                  parseFloat(geo.getAttribute("x") || "0"),
                  parseFloat(geo.getAttribute("y") || "0"),
                  parseFloat(geo.getAttribute("width") || "0"),
                  parseFloat(geo.getAttribute("height") || "0"),
                );
                if (geo.getAttribute("relative") === "1") {
                  geometry.relative = true;
                }
                newCell.setGeometry(geometry);
              }

              // Add to model
              model.add(defaultParent, newCell);
              idMapping[oldId] = newCell.getId();
            });

            // Update references (source, target, parent)
            importedCells.forEach((cell: any) => {
              const oldId = cell.getAttribute("id");
              const newId = idMapping[oldId];

              if (!newId) return;

              const newCell = model.getCell(newId);
              if (!newCell) return;

              // Update parent
              const parentId = cell.getAttribute("parent");
              if (parentId && idMapping[parentId]) {
                const parentCell = model.getCell(idMapping[parentId]);
                if (parentCell) {
                  model.add(parentCell, newCell);
                }
              }

              // Update source and target for edges
              if (newCell.edge) {
                const sourceId = cell.getAttribute("source");
                const targetId = cell.getAttribute("target");

                if (sourceId && idMapping[sourceId]) {
                  const sourceCell = model.getCell(idMapping[sourceId]);
                  if (sourceCell) {
                    model.setTerminal(newCell, sourceCell, true);
                  }
                }

                if (targetId && idMapping[targetId]) {
                  const targetCell = model.getCell(idMapping[targetId]);
                  if (targetCell) {
                    model.setTerminal(newCell, targetCell, false);
                  }
                }
              }
            });
          }
        } finally {
          model.endUpdate();
        }

        return {
          success: true,
          message: `Diagram imported successfully (added to current diagram)${filename ? ` from ${filename}` : ""}`,
          cells: cellCount,
        };

      case "new-page":
        // Create a new page with the imported diagram
        if (!ui.pages || !ui.insertPage) {
          return {
            success: false,
            message: "New page creation not supported in this Draw.io version",
          };
        }

        const importedPageName = filename
          ? filename.replace(/\.[^/.]+$/, "")
          : null;

        if (importedPageName) {
          try {
            assert_page_rename_supported(
              ui,
              "create a named imported page",
            );
          } catch (error) {
            return {
              success: false,
              message:
                error instanceof Error ? error.message : "Page renaming is not supported",
            };
          }
        }

        // Create new page
        const newPage = ui.insertPage();
        if (!newPage) {
          return { success: false, message: "Failed to create new page" };
        }

        if (importedPageName) {
          try {
            assert_page_rename_supported(
              ui,
              "create a named imported page",
              newPage,
            );
            newPage.setName(importedPageName);
          } catch (error) {
            rollback_created_page(ui, newPage);
            return {
              success: false,
              message:
                error instanceof Error ? error.message : "Page renaming is not supported",
            };
          }
        }

        // Switch to new page
        ui.selectPage(newPage);

        // Load diagram into new page
        model.beginUpdate();
        try {
          // Extract the mxGraphModel from mxfile if needed
          let pageGraphModel = doc.documentElement;
          if (pageGraphModel.nodeName === "mxfile") {
            const diagram = pageGraphModel.querySelector("diagram");
            if (diagram) {
              const mxGraphModel = diagram.querySelector("mxGraphModel");
              if (mxGraphModel) {
                pageGraphModel = mxGraphModel;
              }
            }
          }

          if (editor.setGraphXml) {
            editor.setGraphXml(pageGraphModel);
            // Refresh the graph view
            graph.refresh();
            graph.fit();
          } else {
            // Fallback: use mxCodec to decode into model
            const codec = new (window as any).mxCodec(
              pageGraphModel.ownerDocument,
            );
            codec.decode(pageGraphModel, model);
          }
        } finally {
          model.endUpdate();
        }

        return {
          success: true,
          message: `Diagram imported successfully (new page created)${filename ? `: ${filename}` : ""}`,
          pages: ui.pages.length,
          cells: cellCount,
        };

      default:
        return { success: false, message: `Unsupported import mode: ${mode}` };
    }
  } catch (error) {
    console.error("[import-diagram] Error importing diagram:", error);
    return {
      success: false,
      message: `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export type ImportMermaidOptions = {
  mermaid_source: string;
  mode?: "native" | "embed";
  insert_mode?: "replace" | "add" | "new-page";
};

export type ImportMermaidResult =
  | {
      success: true;
      mode: "native" | "embed";
      message: string;
      cells?: number;
      xml?: string;
    }
  | { success: false; message: string };

export function import_mermaid(
  ui: any,
  options: Record<string, unknown>,
): Promise<ImportMermaidResult> {
  const opts = options as unknown as ImportMermaidOptions;
  const mermaid_source = opts.mermaid_source;
  const mode = opts.mode ?? "native";
  const insert_mode = opts.insert_mode ?? "add";

  if (!mermaid_source || typeof mermaid_source !== "string") {
    return Promise.resolve({
      success: false,
      message: "mermaid_source must be a non-empty string",
    });
  }

  if (typeof ui?.parseMermaidDiagram !== "function") {
    return Promise.resolve({
      success: false,
      message:
        "ui.parseMermaidDiagram is not available — this Draw.io build does not expose Mermaid support.",
    });
  }

  const enableParser = mode === "native";

  return new Promise<ImportMermaidResult>((resolve) => {
    let settled = false;
    const settle = (result: ImportMermaidResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      ui.parseMermaidDiagram(
        mermaid_source,
        undefined,
        (xml: string) => {
          if (!xml || typeof xml !== "string") {
            settle({
              success: false,
              message: "Mermaid parser returned empty XML",
            });
            return;
          }
          try {
            const importResult = import_diagram(ui, {
              data: xml,
              format: "xml",
              mode: insert_mode,
            });
            if (!importResult.success) {
              settle({
                success: false,
                message: `Mermaid converted, but inserting into the diagram failed: ${importResult.message}`,
              });
              return;
            }
            settle({
              success: true,
              mode,
              message: importResult.message,
              cells: importResult.cells,
              xml,
            });
          } catch (err) {
            settle({
              success: false,
              message: `Insert after Mermaid conversion failed: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        },
        (err: any) => {
          settle({
            success: false,
            message: `Mermaid render failed: ${err?.message ?? String(err)}`,
          });
        },
        (err: any) => {
          settle({
            success: false,
            message: `Mermaid parse error: ${err?.message ?? String(err)}`,
          });
        },
        enableParser,
      );
    } catch (err) {
      settle({
        success: false,
        message: `parseMermaidDiagram threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}
