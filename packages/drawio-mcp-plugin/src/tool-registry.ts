import type { DrawIOFunction } from "./types.js";
import {
  add_cell_of_shape,
  add_edge,
  add_new_rectangle,
  create_layer,
  create_page,
  delete_cell_by_id,
  edit_cell,
  edit_edge,
  export_diagram,
  get_active_layer,
  get_current_page,
  get_selected_cell,
  get_shape_by_name,
  get_shape_categories,
  get_shapes_in_category,
  import_diagram,
  list_layers,
  list_pages,
  list_paged_model,
  move_cell_to_layer,
  rename_page,
  resolve_target_page,
  set_active_layer,
  set_cell_data,
  set_cell_parent,
  set_cell_shape,
  switch_to_target_page,
  type DrawioCellOptions,
} from "./drawio-tools.js";

export type ToolDefinition = {
  name: string;
  params: Set<string>;
  handler: DrawIOFunction;
};

function with_target_page(
  handler: DrawIOFunction,
  options?: {
    skip?: (options: DrawioCellOptions) => boolean;
  },
): DrawIOFunction {
  return (ui, rawOptions) => {
    const drawioOptions = rawOptions as DrawioCellOptions;

    if (!options?.skip?.(drawioOptions)) {
      const resolved = resolve_target_page(ui, drawioOptions.target_page);
      switch_to_target_page(ui, resolved.page);
    }

    return handler(ui, drawioOptions);
  };
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "get-selected-cell",
    params: new Set(["target_page"]),
    handler: with_target_page(get_selected_cell),
  },
  {
    name: "add-rectangle",
    params: new Set([
      "x",
      "y",
      "width",
      "height",
      "text",
      "style",
      "parent_id",
      "target_page",
    ]),
    handler: with_target_page(add_new_rectangle),
  },
  {
    name: "add-edge",
    params: new Set([
      "source_id",
      "target_id",
      "style",
      "text",
      "parent_id",
      "points",
      "target_page",
    ]),
    handler: with_target_page(add_edge),
  },
  {
    name: "delete-cell-by-id",
    params: new Set(["cell_id", "target_page"]),
    handler: with_target_page(delete_cell_by_id),
  },
  {
    name: "get-shape-categories",
    params: new Set<string>([]),
    handler: get_shape_categories,
  },
  {
    name: "get-shapes-in-category",
    params: new Set(["category_id"]),
    handler: get_shapes_in_category,
  },
  {
    name: "get-shape-by-name",
    params: new Set(["shape_name"]),
    handler: get_shape_by_name,
  },
  {
    name: "add-cell-of-shape",
    params: new Set([
      "shape_name",
      "x",
      "y",
      "width",
      "height",
      "text",
      "style",
      "parent_id",
      "target_page",
    ]),
    handler: with_target_page(add_cell_of_shape),
  },
  {
    name: "set-cell-shape",
    params: new Set(["cell_id", "shape_name", "target_page"]),
    handler: with_target_page(set_cell_shape),
  },
  {
    name: "set-cell-data",
    params: new Set(["cell_id", "key", "value", "target_page"]),
    handler: with_target_page(set_cell_data),
  },
  {
    name: "list-paged-model",
    params: new Set(["page", "page_size", "filter", "target_page"]),
    handler: with_target_page(list_paged_model),
  },
  {
    name: "edit-cell",
    params: new Set([
      "cell_id",
      "text",
      "x",
      "y",
      "width",
      "height",
      "style",
      "target_page",
    ]),
    handler: with_target_page(edit_cell),
  },
  {
    name: "edit-edge",
    params: new Set([
      "cell_id",
      "text",
      "source_id",
      "target_id",
      "style",
      "points",
      "target_page",
    ]),
    handler: with_target_page(edit_edge),
  },
  {
    name: "list-layers",
    params: new Set(["target_page"]),
    handler: with_target_page(list_layers),
  },
  {
    name: "set-active-layer",
    params: new Set(["layer_id", "target_page"]),
    handler: with_target_page(set_active_layer),
  },
  {
    name: "move-cell-to-layer",
    params: new Set(["cell_id", "target_layer_id", "target_page"]),
    handler: with_target_page(move_cell_to_layer),
  },
  {
    name: "set-cell-parent",
    params: new Set(["cell_id", "parent_id", "target_page"]),
    handler: with_target_page(set_cell_parent),
  },
  {
    name: "get-active-layer",
    params: new Set(["target_page"]),
    handler: with_target_page(get_active_layer),
  },
  {
    name: "create-layer",
    params: new Set(["name", "target_page"]),
    handler: with_target_page(create_layer),
  },
  {
    name: "export-diagram",
    params: new Set([
      "format",
      "scale",
      "border",
      "background",
      "shadow",
      "crop",
      "selection_only",
      "transparent",
      "dpi",
      "embed_xml",
      "size",
      "target_page",
    ]),
    handler: with_target_page(export_diagram),
  },
  {
    name: "import-diagram",
    params: new Set(["data", "format", "mode", "filename", "target_page"]),
    handler: with_target_page(import_diagram, {
      skip: (options) => options.mode === "new-page",
    }),
  },
  {
    name: "list-pages",
    params: new Set<string>([]),
    handler: list_pages,
  },
  {
    name: "get-current-page",
    params: new Set<string>([]),
    handler: get_current_page,
  },
  {
    name: "create-page",
    params: new Set(["name"]),
    handler: create_page,
  },
  {
    name: "rename-page",
    params: new Set(["page", "name"]),
    handler: rename_page,
  },
];
