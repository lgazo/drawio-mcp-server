import { shape_library_stub } from "./drawio_stub";
import {
  DrawioCellOptions,
  DrawioGraph,
  MxGraphCell,
  MxGraphIsLayer,
} from "./types";

export type CellId = string;
export type CellStyle = string;

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

export function add_new_rectangle(
  ui: any,
  options: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    style?: CellStyle;
  },
) {
  const { editor } = ui;
  const { graph } = editor;

  // Default values
  const x = options.x || 100;
  const y = options.y || 100;
  const width = options.width || 120;
  const height = options.height || 60;
  const text = options.text || "";
  const style =
    options.style ||
    "whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;";

  // Begin transaction for undo/redo support
  graph.getModel().beginUpdate();
  try {
    // Create the rectangle vertex
    const vertex = graph.insertVertex(
      graph.getDefaultParent(), // parent
      null, // ID (auto-generated if null)
      text, // value
      x,
      y, // position
      width,
      height, // size
      style, // style
    );

    return vertex;
  } finally {
    // End transaction
    graph.getModel().endUpdate();
  }
}

/**
 * Deletes a cell from the graph by its ID.
 * @param ui The draw.io UI instance
 * @param cellId The ID of the cell to delete
 * @returns true if the cell was found and deleted, false otherwise
 */
export function delete_cell_by_id(
  ui: any,
  options: DrawioCellOptions,
): boolean {
  const { editor } = ui;
  const { graph } = editor;

  // Get the cell by its ID
  const cell_id = options.cell_id as CellId;
  const cell = graph.getModel().getCell(cell_id);

  if (!cell) {
    return false;
  }

  // Begin transaction for undo/redo support
  graph.getModel().beginUpdate();
  try {
    // Remove the cell from the graph
    graph.removeCells([cell]);
    return true;
  } finally {
    // End transaction
    graph.getModel().endUpdate();
  }
}

/**
 * Adds an edge connecting two vertices in the graph.
 * @param ui The draw.io UI instance
 * @param options Parameters including style
 * @returns The created edge or null if vertices weren't found
 */
export function add_edge(ui: any, options: DrawioCellOptions): any | null {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();

  // Get source and target cells
  const source = model.getCell(options.source_id);
  const target = model.getCell(options.target_id);

  if (!source || !target) {
    return null;
  }

  // Default style for edge
  const defaultStyle = "endArrow=classic;html=1;rounded=0;";
  const style = options.style || defaultStyle;
  const text = options.text || "";

  // Begin transaction for undo/redo support
  model.beginUpdate();
  try {
    // Create the edge
    const edge = graph.insertEdge(
      graph.getDefaultParent(), // parent
      null, // ID (auto-generated if null)
      text, // value
      source, // source
      target, // target
      style, // style
    );

    return edge;
  } finally {
    // End transaction
    model.endUpdate();
  }
}

/**
 * Updates an existing vertex/shape cell by applying only the provided changes.
 * @param ui The draw.io UI instance
 * @param options Parameters describing the desired updates
 * @returns The updated cell
 */
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

/**
 * Updates an existing edge cell by applying only the provided changes.
 * @param ui The draw.io UI instance
 * @param options Parameters describing the desired updates
 * @returns The updated edge cell
 */
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

/**
 * Lists all available shape categories (palettes) in the sidebar
 * @param ui The draw.io UI instance
 * @returns Array of category names
 */
export function get_shape_categories(ui: any) {
  //: string[] {
  // const { sidebar } = ui;

  // if (!sidebar || !sidebar.palettes) {
  //   return [];
  // }

  // return (
  //   Object.entries(sidebar.palettes)
  //     // .filter((palette: any) => palette.visible !== false) // Skip hidden palettes
  //     .map((palette: any) => ({
  //       id: palette[0],
  //       title: palette[1][0].innerText || "Untitled",
  //     }))
  // );

  const categories = Object.values(shape_library_stub).reduce((acc, cur) => {
    acc.add(cur.category);
    return acc;
  }, new Set());
  return [...categories];
}

/**
 * Gets all shapes from a specific category
 * @param ui The draw.io UI instance
 * @param category_name The name of the category to list
 * @returns Array of shape names in the category or empty array if not found
 */
export function get_shapes_in_category(ui: any, options: DrawioCellOptions) {
  //: string[] {
  // const { sidebar } = ui;

  // if (!sidebar || !sidebar.palettes) {
  //   return [];
  // }

  // const palette = Object.entries(sidebar.palettes).find(
  //   (p: any) => p[0].toLowerCase() === options.category_id.toLowerCase(),
  // );

  // if (!palette) return [];

  // return palette[1].entries.map((entry: any) => entry.title);
  return Object.entries(shape_library_stub)
    .filter(([_shape_key, shape_value]) => {
      return shape_value.category === options.category_id;
    })
    .map(([shape_key, shape_value]) => {
      return {
        id: shape_key,
        title: shape_value.title || shape_key,
      };
    });
}

/**
 * Finds a shape by name across all available categories
 * @param ui The draw.io UI instance
 * @param options shape_name The name of the shape to find
 * @returns The shape entry (with style and metadata) or null if not found
 */
export function get_shape_by_name(
  ui: any,
  options: DrawioCellOptions,
): any | null {
  // const shape_name = options.shape_name as string;
  // const lowerCaseName = shape_name.toLowerCase();

  // const { editor } = ui;
  // const { sidebar } = editor;

  // if (!sidebar?.palettes) return null;

  // // Search through all palettes
  // for (const palette of sidebar.palettes) {
  //   if (!palette.entries) continue;

  //   // Search through all entries in the palette
  //   const found = palette.entries.find(
  //     (entry: any) => entry.title?.toLowerCase() === lowerCaseName,
  //   );

  //   if (found) {
  //     return {
  //       ...found,
  //       category: palette.title || "Uncategorized",
  //     };
  //   }
  // }

  // return null;

  const shape = Object.entries(shape_library_stub).find(
    ([shape_key, shape_value]) => {
      return shape_key === options.shape_name;
    },
  );
  if (!shape) {
    return null;
  }
  return {
    id: shape[0],
    ...shape[1],
  };
}

/**
 * Creates a shape from the library by shape name
 * @param ui The draw.io UI instance
 * @param options Position, size and style options
 * @returns The created cell or null if shape not found
 */
export function add_cell_of_shape(ui: any, options: DrawioCellOptions) {
  const { editor } = ui;
  const { graph, sidebar } = editor;

  // Default values
  const shape_name = options.shape_name || "rectangle";
  const x = options.x || 100;
  const y = options.y || 100;
  const width = options.width || 120;
  const height = options.height || 80;
  const text = options.text || "";
  const style = (options.style || "") as CellStyle;

  // Find the General palette
  // const generalPalette = sidebar.palettes.find((p: any) =>
  //   p.title === 'General' || p.title === 'general'
  // );

  // if (!generalPalette) return null;

  // Find the shape by name
  // const shapeEntry = generalPalette.entries.find((entry: any) =>
  //   entry.title.toLowerCase() === shape_name.toLowerCase()
  // );
  const shape_entry = get_shape_by_name(ui, { shape_name });

  if (!shape_entry) return null;

  // Begin transaction
  graph.getModel().beginUpdate();
  try {
    // Create the shape using the found stencil
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
    // End transaction
    graph.getModel().endUpdate();
  }
}

/**
 * Applies a library shape's style to an existing cell.
 * @param ui The draw.io UI instance
 * @param options Includes target cell_id and shape_name to apply
 * @returns The updated cell
 */
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

  const shape_entry = get_shape_by_name(ui, { shape_name });
  if (!shape_entry || !shape_entry.style) {
    throw new Error(
      `set_cell_shape could not find a shape named '${shape_name}' with a style`,
    );
  }

  model.beginUpdate();
  try {
    graph.setCellStyle(shape_entry.style as CellStyle, [cell]);
  } finally {
    model.endUpdate();
  }

  return cell;
}

/**
 * Sets or updates a custom key-value pair on a cell's data.
 * @param ui The draw.io UI instance
 * @param options Includes cell_id, key, and value to store
 * @returns The updated cell
 */
export const set_cell_data = (mxUtils: any) => (ui: any, options: DrawioCellOptions) => {
  // console.debug(`[set-cell-data] options = `, options);
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();

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

  // console.debug(`[set-cell-data] cell = ${cell_id}, ${key}=${value}`);

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

/**
 * Removes circular dependencies and functions from a JavaScript object by replacing
 * circular references with a string indicating the circular path and omitting functions.
 * @param obj The object to remove circular references and functions from
 * @param visited Set of already visited objects (used internally for recursion)
 * @param path Current path in the object (used internally for recursion)
 * @returns A new object with circular references and functions removed
 */
export function remove_circular_dependencies<T>(
  obj: T,
  visited: WeakSet<object> = new WeakSet(),
  path: string[] = [],
): T {
  // Handle primitive values (they can't be circular or functions)
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    if (visited.has(obj)) {
      return `[Circular ${path.join(".")}]` as unknown as T;
    }

    visited.add(obj);
    return obj.map((item, index) =>
      remove_circular_dependencies(item, visited, [...path, `[${index}]`]),
    ) as unknown as T;
  }

  // Handle Date, RegExp, etc. - return as-is since they can't contain circular references or functions
  const tstr = Object.prototype.toString.call(obj);
  // console.debug(`[remove] special type ${tstr}`)
  if (tstr === "[object NamedNodeMap]") {
    return transform_NamedNodeMap_to_record(obj) as T;
  }
  if (tstr !== "[object Object]" && tstr !== "[object Element]") {
    return obj;
  }


  // Check for circular reference in plain objects
  if (visited.has(obj)) {
    return `[Circular ${path.join(".")}]` as unknown as T;
  }

  visited.add(obj);
  const result: Record<string, any> = {};

  // console.debug(`[remove] cleaned obj`, cleaned_obj);
  for (const key in obj) {
    const value = (obj as Record<string, any>)[key];
    // console.debug(`[remove] cleaning obj key=${key}`, value);
    // Skip functions
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

  // console.debug(`[remove] result`, result);
  return result as T;
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
  // Transform NamedNodeMap attributes to standard object
  if (cell.value.attributes && typeof cell.value.attributes === "object") {
    const attributes = cell.value.attributes;
    return transform_NamedNodeMap_to_record(attributes);
  }

  return {};
}

/**
 * Transforms a cell object to retain only essential fields and sanitize data
 * @param cell The cell object to transform
 * @returns Transformed cell with only essential fields
 */
export function transform_cell_for_display(
  cell: MxGraphCell,
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

  // Handle value field transformation
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
 * @param graph The graph instance
 * @param cell The cell to get layer information for
 * @returns Layer object with id and name, or null if no layer found
 */
export function get_cell_layer(
  graph: DrawioGraph,
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
    // Handle cases where getLayerForCell might not be available
    console.warn("Could not get layer for cell:", error);
  }

  return null;
}

/**
 * Reimplementation of draw.io's
 * @param root_cell
 * @returns
 */
function mx_isRoot(root_cell: MxGraphCell) {
  return function (cell: MxGraphCell): boolean {
    // return null != a && this.root == a
    return null != cell && cell == root_cell;
  };
}

function mx_isLayer(root_cell: MxGraphCell) {
  return function (cell: MxGraphCell): boolean {
    // return this.isRoot(this.getParent(a))
    return mx_isRoot(root_cell)(cell.getParent());
  };
}

/**
 * Lists paged model data from the graph with transformation and sanitization
 * @param ui The draw.io UI instance
 * @param options Page information and filtering options
 * @returns Array of transformed and sanitized cells
 */
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

  // Helper function to parse style string into key=value pairs
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

  // Helper function to extract attributes from cell value
  function extract_cell_attributes(cell: any): Record<string, any> {
    const attributes: Record<string, any> = {};

    // Add basic cell properties
    attributes.id = cell.id || "";
    attributes.edge = cell.edge || false;

    // Add style attributes
    if (cell.style) {
      Object.assign(attributes, parse_style_attributes(cell.style));
    }

    // Add value attributes if it's an object
    if (cell.value && typeof cell.value === "object" && cell.value.attributes) {
      const transformed_attributes = transform_cells_NamedNodeMap_to_attributes(cell);

      // const valueAttrs = cell.value.attributes;
      // if (Array.isArray(valueAttrs)) {
      //   for (let i = 0; i < valueAttrs.length; i++) {
      //     const attr = valueAttrs[i];
      //     if (attr && attr.name && attr.value !== undefined) {
      //       attributes[attr.name] = attr.value;
      //     }
      //   }
      // } else if (typeof valueAttrs === "object") {
      //   Object.assign(attributes, valueAttrs);
      // }

      Object.assign(attributes, transformed_attributes);
    }

    // Add text value as attribute
    if (cell.value && typeof cell.value === "string") {
      attributes.text = cell.value;
    }

    return attributes;
  }

  // Helper function to evaluate boolean logic expressions
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

  // Helper function to check cell type
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

  // Apply filtering
  let filtered_cells = Object.values(cells);

  if (options.filter) {
    // Merge layer_ids into parent_ids for filtering
    const filter = options.filter;
    const allParentIds = [
      ...(filter.parent_ids || []),
      ...(filter.layer_ids || []),
    ];

    filtered_cells = filtered_cells.filter((cell) => {
      // Check cell type filter
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

      // Check attributes filter
      if (options.filter?.attributes && options.filter.attributes.length > 0) {
        const cellAttributes = extract_cell_attributes(cell);
        if (
          !evaluate_filter_expression(options.filter.attributes, cellAttributes)
        ) {
          return false;
        }
      }

      // Check parent_ids / layer_ids filter
      if (allParentIds.length > 0) {
        const parent = cell.parent;
        if (!parent || !parent.id || !allParentIds.includes(parent.id)) {
          return false;
        }
      }

      // Check ids filter
      if (filter.ids && filter.ids.length > 0) {
        if (!filter.ids.includes(cell.id)) {
          return false;
        }
      }

      return true;
    });
  }

  // Default pagination values
  const page = Math.max(0, options.page || 0);
  const page_size = Math.max(1, options.page_size || 50);
  const start_index = page * page_size;

  // Get filtered cell IDs and slice for pagination
  const cell_ids = filtered_cells.map((cell) => cell.id);
  const paginated_ids = cell_ids.slice(start_index, start_index + page_size);

  // Transform and sanitize each cell
  const transformed_cells: TransformedCell[] = [];

  for (const cell_id of paginated_ids) {
    const cell = cells[cell_id];
    if (cell) {
      // Remove circular dependencies and transform
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

// Layer Management Functions

/**
 * Lists all layers in the diagram
 * @param ui The draw.io UI instance
 * @returns Array of layer objects with id, name, visible, and locked properties
 */
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

/**
 * Sets the active layer for new element creation
 * @param ui The draw.io UI instance
 * @param options Contains layer_id
 * @returns Information about the newly active layer
 */
export function set_active_layer(ui: any, options: DrawioCellOptions) {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();
  const layer = model.getCell(options.layer_id);
  
  if (!layer) {
    throw new Error(`Layer with ID ${options.layer_id} not found`);
  }
  
  // Set the default parent (active layer)
  graph.setDefaultParent(layer);
  
  return {
    id: layer.getId(),
    name: layer.getValue() || 'Unnamed Layer'
  };
}

/**
 * Moves a cell to a different layer
 * @param ui The draw.io UI instance
 * @param options Contains cell_id and target_layer_id
 * @returns Confirmation of the move operation
 */
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
    // Move the cell to the target layer
    model.add(targetLayer, cell);
  } finally {
    model.endUpdate();
  }
  
  return {
    moved_cell: options.cell_id,
    to_layer: options.target_layer_id
  };
}

/**
 * Gets the currently active layer
 * @param ui The draw.io UI instance
 * @returns Information about the current active layer
 */
export function get_active_layer(ui: any) {
  const { editor } = ui;
  const { graph } = editor;
  const activeLayer = graph.getDefaultParent();
  
  return {
    id: activeLayer.getId(),
    name: activeLayer.getValue() || 'Default Layer'
  };
}

/**
 * Creates a new layer in the diagram
 * @param ui The draw.io UI instance
 * @param options Contains name for the new layer
 * @returns Information about the newly created layer
 */
export function create_layer(ui: any, options: DrawioCellOptions) {
  const { editor } = ui;
  const { graph } = editor;
  const model = graph.getModel();
  const root = model.getRoot();
  
  model.beginUpdate();
  let newLayer;
  try {
    // Create new layer
    newLayer = new (window as any).mxCell(options.name);
    newLayer.setId(null); // Let Draw.io assign an ID
    model.add(root, newLayer);
  } finally {
    model.endUpdate();
  }
  
  return {
    id: newLayer.getId(),
    name: options.name
  };
}
